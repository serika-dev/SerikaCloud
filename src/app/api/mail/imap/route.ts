import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const IMAP_HOST = process.env.IMAP_HOST || "imap.serika.pro";
const IMAP_PORT = process.env.IMAP_PORT || "993";

// GET — List IMAP credentials + connection info
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credentials = await prisma.imapCredential.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      label: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const mailbox = await prisma.mailbox.findFirst({
    where: { userId: session.user.id, isPrimary: true },
    select: { address: true },
  });

  return NextResponse.json({
    credentials,
    connectionInfo: {
      host: IMAP_HOST,
      port: parseInt(IMAP_PORT),
      security: "SSL/TLS",
      username: mailbox?.address || session.user.email,
      smtpHost: `smtp.${IMAP_HOST.replace("imap.", "")}`,
      smtpPort: 587,
      smtpSecurity: "STARTTLS",
    },
  });
}

// POST — Generate a new app password for IMAP
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { label } = await req.json();

  // Limit to 10 app passwords per user
  const count = await prisma.imapCredential.count({
    where: { userId: session.user.id },
  });
  if (count >= 10) {
    return NextResponse.json(
      { error: "Maximum 10 app passwords allowed" },
      { status: 400 }
    );
  }

  // Generate a secure app password (4 groups of 4 chars)
  const rawPassword = [nanoid(4), nanoid(4), nanoid(4), nanoid(4)].join("-");
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const credential = await prisma.imapCredential.create({
    data: {
      userId: session.user.id,
      label: label?.trim() || "App Password",
      passwordHash,
    },
    select: {
      id: true,
      label: true,
      createdAt: true,
    },
  });

  // Return the raw password only once — it cannot be retrieved again
  return NextResponse.json({
    credential,
    password: rawPassword,
    warning: "Save this password now. It will not be shown again.",
  }, { status: 201 });
}

// PATCH — Update label
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { credentialId, label } = await req.json();
  if (!credentialId || !label) {
    return NextResponse.json({ error: "credentialId and label required" }, { status: 400 });
  }

  const credential = await prisma.imapCredential.findUnique({ where: { id: credentialId } });
  if (!credential || credential.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.imapCredential.update({
    where: { id: credentialId },
    data: { label: label.trim() },
    select: { id: true, label: true, lastUsedAt: true, createdAt: true },
  });

  return NextResponse.json({ credential: updated });
}

// DELETE — Revoke an app password
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const credentialId = searchParams.get("id");
  if (!credentialId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const credential = await prisma.imapCredential.findUnique({ where: { id: credentialId } });
  if (!credential || credential.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.imapCredential.delete({ where: { id: credentialId } });
  return NextResponse.json({ success: true });
}
