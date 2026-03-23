import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const email = await prisma.email.findFirst({
    where: {
      id,
      mailbox: { userId: session.user.id },
    },
    include: {
      attachments: true,
      folder: true,
    },
  });

  if (!email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Mark as read
  if (!email.isRead) {
    await prisma.email.update({
      where: { id },
      data: { isRead: true },
    });
  }

  return NextResponse.json({
    ...email,
    attachments: email.attachments.map((a) => ({
      ...a,
      size: Number(a.size),
    })),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: session.user.id } },
  });

  if (!email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: any = {};

  if (body.isRead !== undefined) updateData.isRead = body.isRead;
  if (body.isStarred !== undefined) updateData.isStarred = body.isStarred;

  // Move to folder
  if (body.folderType) {
    const mailbox = await prisma.mailbox.findFirst({
      where: { userId: session.user.id, isPrimary: true },
      include: { folders: true },
    });
    const targetFolder = mailbox?.folders.find((f) => f.type === body.folderType);
    if (targetFolder) {
      updateData.folderId = targetFolder.id;
    }
  }

  const updated = await prisma.email.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const email = await prisma.email.findFirst({
    where: { id, mailbox: { userId: session.user.id } },
    include: { folder: true },
  });

  if (!email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If already in trash, permanently delete
  if (email.folder.type === "trash") {
    await prisma.email.delete({ where: { id } });
    return NextResponse.json({ success: true, permanent: true });
  }

  // Otherwise move to trash
  const mailbox = await prisma.mailbox.findFirst({
    where: { userId: session.user.id, isPrimary: true },
    include: { folders: true },
  });

  const trashFolder = mailbox?.folders.find((f) => f.type === "trash");
  if (trashFolder) {
    await prisma.email.update({
      where: { id },
      data: { folderId: trashFolder.id },
    });
  }

  return NextResponse.json({ success: true, permanent: false });
}
