import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/org";

// GET — List group mailboxes, or get emails from a specific group mailbox
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "MEMBER");
  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mailboxId = searchParams.get("mailboxId");
  const folderType = searchParams.get("folder") || "inbox";

  // If no mailboxId, list all group mailboxes
  if (!mailboxId) {
    const mailboxes = await prisma.groupMailbox.findMany({
      where: { orgId },
      include: {
        group: { select: { id: true, name: true, color: true } },
        folders: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // Get unread counts
    const mailboxesWithCounts = await Promise.all(
      mailboxes.map(async (mb) => {
        const inboxFolder = mb.folders.find((f) => f.type === "inbox");
        const unreadCount = inboxFolder
          ? await prisma.groupEmail.count({
              where: { groupMailboxId: mb.id, folderId: inboxFolder.id, isRead: false },
            })
          : 0;
        return { ...mb, unreadCount };
      })
    );

    return NextResponse.json({ mailboxes: mailboxesWithCounts });
  }

  // Get emails for a specific group mailbox
  const mailbox = await prisma.groupMailbox.findUnique({
    where: { id: mailboxId },
    include: { folders: true },
  });

  if (!mailbox || mailbox.orgId !== orgId) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  const folder = mailbox.folders.find((f) => f.type === folderType);
  if (!folder) {
    return NextResponse.json({ emails: [], folders: mailbox.folders });
  }

  const emails = await prisma.groupEmail.findMany({
    where: { groupMailboxId: mailboxId, folderId: folder.id },
    orderBy: { receivedAt: "desc" },
    take: 50,
  });

  // Folder counts
  const folderCounts = await prisma.groupEmail.groupBy({
    by: ["folderId"],
    where: { groupMailboxId: mailboxId, isRead: false },
    _count: { id: true },
  });
  const unreadMap = Object.fromEntries(folderCounts.map((fc) => [fc.folderId, fc._count.id]));

  return NextResponse.json({
    emails,
    folders: mailbox.folders.map((f) => ({
      ...f,
      unreadCount: unreadMap[f.id] || 0,
    })),
    mailbox: { id: mailbox.id, address: mailbox.address, displayName: mailbox.displayName },
  });
}

// POST — Create a group mailbox (admin+)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "ADMIN");
  if (!membership) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { address, displayName, groupId, autoReply } = await req.json();
  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }

  // Validate address format
  if (!/^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\.[a-z]{2,}$/i.test(address)) {
    return NextResponse.json({ error: "Invalid email address format" }, { status: 400 });
  }

  // Check the domain is owned by the org or is the platform domain
  const domain = address.split("@")[1];
  const MAIL_DOMAIN = process.env.MAIL_DOMAIN || "serika.pro";

  if (domain !== MAIL_DOMAIN) {
    const orgDomain = await prisma.orgDomain.findFirst({
      where: { orgId, domain, status: "ACTIVE" },
    });
    if (!orgDomain) {
      return NextResponse.json(
        { error: "Domain not verified. Add and verify the domain first." },
        { status: 400 }
      );
    }
  }

  // Check if address is already in use
  const existingGroup = await prisma.groupMailbox.findUnique({ where: { address } });
  if (existingGroup) {
    return NextResponse.json({ error: "Address already in use" }, { status: 409 });
  }
  const existingPersonal = await prisma.mailbox.findUnique({ where: { address } });
  if (existingPersonal) {
    return NextResponse.json({ error: "Address already in use by a personal mailbox" }, { status: 409 });
  }
  const existingAlias = await prisma.emailAlias.findUnique({ where: { address } });
  if (existingAlias) {
    return NextResponse.json({ error: "Address already in use as an alias" }, { status: 409 });
  }

  // If groupId specified, verify it belongs to this org
  if (groupId) {
    const group = await prisma.userGroup.findUnique({ where: { id: groupId } });
    if (!group || group.orgId !== orgId) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }
    // Check group doesn't already have a mailbox
    const existingGroupMailbox = await prisma.groupMailbox.findUnique({ where: { groupId } });
    if (existingGroupMailbox) {
      return NextResponse.json({ error: "Group already has a mailbox" }, { status: 409 });
    }
  }

  const mailbox = await prisma.groupMailbox.create({
    data: {
      orgId,
      address: address.toLowerCase(),
      displayName: displayName?.trim() || null,
      groupId: groupId || null,
      autoReply: autoReply?.trim() || null,
      folders: {
        create: [
          { name: "Inbox", type: "inbox" },
          { name: "Sent", type: "sent" },
          { name: "Archive", type: "archive" },
          { name: "Spam", type: "spam" },
          { name: "Trash", type: "trash" },
        ],
      },
    },
    include: { folders: true, group: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ mailbox }, { status: 201 });
}

// PATCH — Update group mailbox settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "ADMIN");
  if (!membership) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { mailboxId, displayName, autoReply } = await req.json();
  if (!mailboxId) {
    return NextResponse.json({ error: "mailboxId required" }, { status: 400 });
  }

  const mailbox = await prisma.groupMailbox.findUnique({ where: { id: mailboxId } });
  if (!mailbox || mailbox.orgId !== orgId) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  const updated = await prisma.groupMailbox.update({
    where: { id: mailboxId },
    data: {
      ...(displayName !== undefined && { displayName: displayName?.trim() || null }),
      ...(autoReply !== undefined && { autoReply: autoReply?.trim() || null }),
    },
  });

  return NextResponse.json({ mailbox: updated });
}

// DELETE — Delete group mailbox
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;
  const membership = await requireOrgRole(session.user.id, orgId, "ADMIN");
  if (!membership) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mailboxId = searchParams.get("mailboxId");
  if (!mailboxId) {
    return NextResponse.json({ error: "mailboxId required" }, { status: 400 });
  }

  const mailbox = await prisma.groupMailbox.findUnique({ where: { id: mailboxId } });
  if (!mailbox || mailbox.orgId !== orgId) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  await prisma.groupMailbox.delete({ where: { id: mailboxId } });
  return NextResponse.json({ success: true });
}
