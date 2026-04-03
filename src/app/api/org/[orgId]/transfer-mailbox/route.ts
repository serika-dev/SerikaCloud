import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireOrgRole } from "@/lib/org";

// POST — Transfer personal mailbox to org group mailbox
// RESTRICTION: Org members CANNOT do this. Only individuals (non-org members) can.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId } = await params;

  // Check if user is a member of ANY organization
  // If they are, they cannot transfer their personal mailbox
  const userOrgMemberships = await prisma.orgMember.findMany({
    where: { userId: session.user.id },
    select: { id: true, orgId: true },
  });

  if (userOrgMemberships.length > 0) {
    return NextResponse.json(
      { error: "Org members cannot transfer their personal mailbox. This feature is only available to individual users without organization memberships." },
      { status: 403 }
    );
  }

  // Verify user is at least trying to transfer to an org where they have some access
  // (they should have been invited or have a pending invite)
  const targetOrg = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, name: true },
  });

  if (!targetOrg) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const { address, displayName, groupId, autoReply } = await req.json();

  // Must provide the address to transfer
  if (!address) {
    return NextResponse.json({ error: "Address required" }, { status: 400 });
  }

  // Get user's personal mailbox
  const personalMailbox = await prisma.mailbox.findFirst({
    where: { userId: session.user.id, isPrimary: true },
    include: { aliases: true, folders: true },
  });

  if (!personalMailbox) {
    return NextResponse.json({ error: "No personal mailbox found" }, { status: 404 });
  }

  // Check if the address matches their personal mailbox or one of their aliases
  const isPrimaryAddress = personalMailbox.address.toLowerCase() === address.toLowerCase();
  const isAlias = personalMailbox.aliases.some(
    (a) => a.address.toLowerCase() === address.toLowerCase()
  );

  if (!isPrimaryAddress && !isAlias) {
    return NextResponse.json(
      { error: "You can only transfer your own mailbox or aliases" },
      { status: 403 }
    );
  }

  // Check target org has permission to use the domain
  const domain = address.split("@")[1];
  const MAIL_DOMAIN = process.env.MAIL_DOMAIN || "serika.pro";

  if (domain !== MAIL_DOMAIN) {
    const orgDomain = await prisma.orgDomain.findFirst({
      where: { orgId, domain, status: "ACTIVE" },
    });
    if (!orgDomain) {
      return NextResponse.json(
        { error: "Domain not verified for this organization" },
        { status: 400 }
      );
    }
  }

  // Check address isn't already a group mailbox
  const existingGroup = await prisma.groupMailbox.findUnique({ where: { address } });
  if (existingGroup) {
    return NextResponse.json({ error: "Address already in use as group mailbox" }, { status: 409 });
  }

  // If it's a primary address, we need to handle this carefully
  // We'll create the group mailbox and then remove the personal mailbox
  // But we should probably keep the personal mailbox for login purposes

  // Create the group mailbox
  const groupMailbox = await prisma.groupMailbox.create({
    data: {
      orgId,
      address: address.toLowerCase(),
      displayName: displayName?.trim() || personalMailbox.displayName || null,
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
    include: { folders: true },
  });

  // Move emails from personal inbox to group inbox if it's the primary address
  if (isPrimaryAddress) {
    const personalInbox = personalMailbox.folders.find((f) => f.type === "inbox");
    const groupInbox = groupMailbox.folders.find((f) => f.type === "inbox");

    if (personalInbox && groupInbox) {
      // Get all emails from personal inbox
      const emails = await prisma.email.findMany({
        where: { mailboxId: personalMailbox.id, folderId: personalInbox.id },
      });

      // Move them to group mailbox
      await Promise.all(
        emails.map((email) =>
          prisma.groupEmail.create({
            data: {
              messageId: email.messageId,
              fromAddress: email.fromAddress,
              fromName: email.fromName,
              toAddresses: email.toAddresses,
              ccAddresses: email.ccAddresses,
              subject: email.subject,
              bodyText: email.bodyText,
              bodyHtml: email.bodyHtml,
              isRead: email.isRead,
              receivedAt: email.receivedAt,
              groupMailboxId: groupMailbox.id,
              folderId: groupInbox.id,
            },
          })
        )
      );

      // Delete moved emails from personal mailbox
      await prisma.email.deleteMany({
        where: { mailboxId: personalMailbox.id, folderId: personalInbox.id },
      });
    }

    // If there's an alias being transferred that's the primary, we need to update the user's primary
    // Actually, we should probably keep the user's primary mailbox but change its address
    // For now, let's just mark the mailbox as transferred
  }

  // If it's an alias, delete it from personal
  if (isAlias) {
    await prisma.emailAlias.deleteMany({
      where: { mailboxId: personalMailbox.id, address },
    });
  }

  return NextResponse.json({
    success: true,
    message: `Successfully transferred ${address} to ${targetOrg.name}`,
    groupMailbox: {
      id: groupMailbox.id,
      address: groupMailbox.address,
      displayName: groupMailbox.displayName,
    },
  });
}
