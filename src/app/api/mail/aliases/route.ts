import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
    return NextResponse.json({ aliases: [] });
  }

  return NextResponse.json({ aliases: mailbox.aliases, mailbox: mailbox.address });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { address } = await req.json();

  if (!address || !address.includes("@")) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const mailbox = await prisma.mailbox.findFirst({
    where: { userId: session.user.id, isPrimary: true },
  });

  if (!mailbox) {
    return NextResponse.json({ error: "No mailbox found" }, { status: 400 });
  }

  // Check if alias already exists
  const existing = await prisma.emailAlias.findUnique({
    where: { address },
  });

  if (existing) {
    return NextResponse.json({ error: "Alias already in use" }, { status: 409 });
  }

  const alias = await prisma.emailAlias.create({
    data: {
      address,
      mailboxId: mailbox.id,
    },
  });

  return NextResponse.json(alias);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, displayName } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Alias ID required" }, { status: 400 });
  }

  const alias = await prisma.emailAlias.findFirst({
    where: { id, mailbox: { userId: session.user.id } },
  });

  if (!alias) {
    return NextResponse.json({ error: "Alias not found" }, { status: 404 });
  }

  const updated = await prisma.emailAlias.update({
    where: { id },
    data: { displayName: displayName || null },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const aliasId = searchParams.get("id");

  if (!aliasId) {
    return NextResponse.json({ error: "Alias ID required" }, { status: 400 });
  }

  const alias = await prisma.emailAlias.findFirst({
    where: {
      id: aliasId,
      mailbox: { userId: session.user.id },
    },
  });

  if (!alias) {
    return NextResponse.json({ error: "Alias not found" }, { status: 404 });
  }

  await prisma.emailAlias.delete({ where: { id: aliasId } });

  return NextResponse.json({ success: true });
}
