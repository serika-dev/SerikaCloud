import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// POST /api/admin/migrate-email-domain - Migrate @serika.email to @serika.pro
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only allow the user to migrate their own mailbox (for safety)
  // Admin endpoint - could be extended to check admin role

  const { userId, forceAddress } = await req.json().catch(() => ({}));
  const targetUserId = userId || session.user.id;

  // Get the user's current mailbox
  const mailbox = await prisma.mailbox.findFirst({
    where: { userId: targetUserId, isPrimary: true },
  });

  if (!mailbox) {
    return NextResponse.json({ error: "No mailbox found" }, { status: 404 });
  }

  // Check if already using @serika.pro
  if (mailbox.address.endsWith("@serika.pro")) {
    return NextResponse.json({
      success: true,
      message: "Already using @serika.pro",
      address: mailbox.address,
    });
  }

  // Determine new address
  let newUsername: string;

  // Special case: if current username is "pikachu+user" or similar, give them "serika"
  const currentUsername = mailbox.address.split("@")[0];

  if (forceAddress) {
    // Use the forced address (for admin overrides)
    newUsername = forceAddress.replace("@serika.pro", "").replace("@serika.email", "");
  } else if (currentUsername === "pikachu+user" || currentUsername === "pikachu") {
    newUsername = "serika";
  } else {
    // Use the same username but on .pro domain
    newUsername = currentUsername;
  }

  const newAddress = `${newUsername}@serika.pro`;

  // Check if target address is available
  const existing = await prisma.mailbox.findUnique({
    where: { address: newAddress },
  });

  if (existing && existing.id !== mailbox.id) {
    return NextResponse.json({
      error: "Target address already taken",
      requested: newAddress,
      available: false,
    }, { status: 409 });
  }

  // Update the mailbox address
  await prisma.mailbox.update({
    where: { id: mailbox.id },
    data: { address: newAddress },
  });

  // Also update any aliases that were @serika.email
  const aliases = await prisma.emailAlias.findMany({
    where: { mailboxId: mailbox.id },
  });

  const updatedAliases = [];
  for (const alias of aliases) {
    if (alias.address.endsWith("@serika.email")) {
      const aliasUsername = alias.address.split("@")[0];
      const newAliasAddress = `${aliasUsername}@serika.pro`;

      // Check if new alias address is available
      const existingAlias = await prisma.emailAlias.findUnique({
        where: { address: newAliasAddress },
      });

      if (!existingAlias) {
        await prisma.emailAlias.update({
          where: { id: alias.id },
          data: { address: newAliasAddress },
        });
        updatedAliases.push({ old: alias.address, new: newAliasAddress });
      }
    }
  }

  return NextResponse.json({
    success: true,
    oldAddress: mailbox.address,
    newAddress,
    updatedAliases,
  });
}

// GET /api/admin/migrate-email-domain - Promote alias to primary and fix mailbox address
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { userId: session.user.id, isPrimary: true },
    include: { aliases: true },
  });

  if (!mailbox) {
    return NextResponse.json({ error: "No primary mailbox" }, { status: 404 });
  }

  // If primary is already @serika.pro, nothing to do
  if (mailbox.address.endsWith("@serika.pro")) {
    return NextResponse.json({
      success: true,
      message: "Already using @serika.pro",
      address: mailbox.address,
    });
  }

  // Find a @serika.pro alias to promote
  const proAlias = mailbox.aliases.find((a) => a.address.endsWith("@serika.pro"));

  if (!proAlias) {
    // No alias - just rename the primary
    const newAddress = mailbox.address.replace("@serika.email", "@serika.pro");
    const existing = await prisma.mailbox.findUnique({ where: { address: newAddress } });
    if (existing) {
      return NextResponse.json({ error: `${newAddress} already taken`, available: false }, { status: 409 });
    }
    await prisma.mailbox.update({ where: { id: mailbox.id }, data: { address: newAddress } });
    return NextResponse.json({ success: true, oldAddress: mailbox.address, newAddress });
  }

  // Promote the alias to primary address, delete the alias record
  const newPrimaryAddress = proAlias.address;
  await prisma.$transaction([
    prisma.mailbox.update({ where: { id: mailbox.id }, data: { address: newPrimaryAddress } }),
    prisma.emailAlias.delete({ where: { id: proAlias.id } }),
  ]);

  return NextResponse.json({
    success: true,
    oldAddress: mailbox.address,
    newAddress: newPrimaryAddress,
    removedAlias: proAlias.address,
    remainingAliases: mailbox.aliases.filter((a) => a.id !== proAlias.id).map((a) => a.address),
  });
}
