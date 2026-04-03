import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MAIL_DOMAIN = process.env.MAIL_DOMAIN || "serika.pro";

// Get emails for a folder
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const folderType = searchParams.get("folder") || "inbox";
  const search = searchParams.get("search") || "";
  const starred = searchParams.get("starred") === "true";

  // Get user's primary mailbox — do NOT auto-create, user must set up their address
  const mailbox = await prisma.mailbox.findFirst({
    where: { userId: session.user.id, isPrimary: true },
    include: { folders: true, aliases: true },
  });

  if (!mailbox) {
    return NextResponse.json({
      emails: [],
      folders: [],
      mailbox: null,
      needsSetup: true,
    });
  }

  const folder = mailbox.folders.find((f) => f.type === folderType);
  if (!folder) {
    return NextResponse.json({
      emails: [],
      folders: mailbox.folders,
      mailbox: {
        id: mailbox.id,
        address: mailbox.address,
        isPrimary: mailbox.isPrimary,
        aliases: mailbox.aliases,
      },
    });
  }

  const where: any = {
    mailboxId: mailbox.id,
    folderId: folder.id,
  };

  if (starred) {
    where.isStarred = true;
    delete where.folderId;
  }

  if (search) {
    where.OR = [
      { subject: { contains: search, mode: "insensitive" } },
      { fromAddress: { contains: search, mode: "insensitive" } },
      { fromName: { contains: search, mode: "insensitive" } },
      { bodyText: { contains: search, mode: "insensitive" } },
    ];
  }

  const emails = await prisma.email.findMany({
    where,
    orderBy: { receivedAt: "desc" },
    include: {
      attachments: {
        select: { id: true, filename: true, mimeType: true, size: true },
      },
    },
    take: 50,
  });

  // Get unread counts per folder
  const folderCounts = await prisma.email.groupBy({
    by: ["folderId"],
    where: { mailboxId: mailbox.id, isRead: false },
    _count: { id: true },
  });
  const unreadMap = Object.fromEntries(
    folderCounts.map((fc) => [fc.folderId, fc._count.id])
  );

  // Get total counts per folder
  const totalCounts = await prisma.email.groupBy({
    by: ["folderId"],
    where: { mailboxId: mailbox.id },
    _count: { id: true },
  });
  const totalMap = Object.fromEntries(
    totalCounts.map((tc) => [tc.folderId, tc._count.id])
  );

  return NextResponse.json({
    emails: emails.map((e) => ({
      ...e,
      attachments: e.attachments.map((a) => ({
        ...a,
        size: Number(a.size),
      })),
    })),
    folders: mailbox.folders.map((f) => ({
      ...f,
      unreadCount: unreadMap[f.id] || 0,
      totalCount: totalMap[f.id] || 0,
    })),
    mailbox: {
      id: mailbox.id,
      address: mailbox.address,
      isPrimary: mailbox.isPrimary,
      aliases: mailbox.aliases,
    },
  });
}

// POST — Set up a new mailbox (choose address)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await req.json();

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  // Validate username format: only lowercase letters, numbers, dots, hyphens
  const usernameClean = username.toLowerCase().trim();
  if (!/^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/.test(usernameClean)) {
    return NextResponse.json(
      { error: "Invalid username. Use 3-30 characters: lowercase letters, numbers, dots, hyphens." },
      { status: 400 }
    );
  }

  // Reserved usernames
  const reserved = [
    "admin", "support", "help", "info", "contact", "noreply", "no-reply",
    "postmaster", "abuse", "security", "root", "webmaster", "hostmaster",
    "mailer-daemon", "mail", "email", "test", "dev", "api", "system",
  ];
  if (reserved.includes(usernameClean)) {
    return NextResponse.json({ error: "This username is reserved" }, { status: 409 });
  }

  const address = `${usernameClean}@${MAIL_DOMAIN}`;

  // Check existing user already has a mailbox
  const existingMailbox = await prisma.mailbox.findFirst({
    where: { userId: session.user.id, isPrimary: true },
  });
  if (existingMailbox) {
    return NextResponse.json({ error: "You already have a mailbox" }, { status: 409 });
  }

  // Check if address is taken
  const taken = await prisma.mailbox.findUnique({ where: { address } });
  if (taken) {
    return NextResponse.json({ error: "This address is already taken" }, { status: 409 });
  }

  // Also check aliases
  const aliasTaken = await prisma.emailAlias.findUnique({ where: { address } });
  if (aliasTaken) {
    return NextResponse.json({ error: "This address is already taken" }, { status: 409 });
  }

  // Create mailbox with default folders
  const mailbox = await prisma.mailbox.create({
    data: {
      address,
      userId: session.user.id,
      isPrimary: true,
      folders: {
        create: [
          { name: "Inbox", type: "inbox", icon: "inbox" },
          { name: "Sent", type: "sent", icon: "send" },
          { name: "Drafts", type: "drafts", icon: "file-edit" },
          { name: "Spam", type: "spam", icon: "alert-triangle" },
          { name: "Trash", type: "trash", icon: "trash-2" },
          { name: "Archive", type: "archive", icon: "archive" },
        ],
      },
    },
    include: { folders: true },
  });

  return NextResponse.json({
    mailbox: {
      id: mailbox.id,
      address: mailbox.address,
      isPrimary: mailbox.isPrimary,
    },
  });
}

// PATCH — Update mailbox displayName
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { displayName } = await req.json();

  const mailbox = await prisma.mailbox.findFirst({
    where: { userId: session.user.id, isPrimary: true },
  });

  if (!mailbox) {
    return NextResponse.json({ error: "No mailbox found" }, { status: 404 });
  }

  const updated = await prisma.mailbox.update({
    where: { id: mailbox.id },
    data: { displayName: displayName || null },
  });

  return NextResponse.json({ displayName: updated.displayName });
}

// Check address availability
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { username } = await req.json();
  const address = `${username?.toLowerCase().trim()}@${MAIL_DOMAIN}`;

  const taken =
    (await prisma.mailbox.findUnique({ where: { address } })) ||
    (await prisma.emailAlias.findUnique({ where: { address } }));

  return NextResponse.json({ available: !taken, address });
}
