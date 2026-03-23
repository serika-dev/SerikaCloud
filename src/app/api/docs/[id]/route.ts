import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Ensure /serika/documents folder path exists for a user
async function ensureDocumentsFolder(userId: string): Promise<string> {
  let serikaFolder = await prisma.folder.findFirst({
    where: { userId, name: "serika", parentId: null },
  });
  if (!serikaFolder) {
    serikaFolder = await prisma.folder.create({
      data: { name: "serika", userId, parentId: null },
    });
  }
  let docsFolder = await prisma.folder.findFirst({
    where: { userId, name: "documents", parentId: serikaFolder.id },
  });
  if (!docsFolder) {
    docsFolder = await prisma.folder.create({
      data: { name: "documents", userId, parentId: serikaFolder.id },
    });
  }
  return docsFolder.id;
}

// Sync a document as a .sdoc file in /serika/documents
async function syncDocumentToCloud(
  userId: string,
  docId: string,
  title: string,
  content: any
) {
  const folderId = await ensureDocumentsFolder(userId);
  const fileName = `${title.replace(/[^a-zA-Z0-9 _-]/g, "").trim() || "Untitled"}.sdoc`;
  const b2Key = `serika/documents/${userId}/${docId}.sdoc`;
  const size = Buffer.byteLength(JSON.stringify(content || {}), "utf-8");

  const existing = await prisma.file.findFirst({
    where: { b2Key, userId },
  });

  if (existing) {
    await prisma.file.update({
      where: { id: existing.id },
      data: { name: fileName, size: BigInt(size) },
    });
  } else {
    await prisma.file.create({
      data: {
        name: fileName,
        mimeType: "application/json",
        size: BigInt(size),
        b2Key,
        userId,
        folderId,
      },
    });
  }
}

// Remove the cloud file entry for a deleted document
async function removeDocumentFromCloud(userId: string, docId: string) {
  const b2Key = `serika/documents/${userId}/${docId}.sdoc`;
  const existing = await prisma.file.findFirst({
    where: { b2Key, userId },
  });
  if (existing) {
    await prisma.file.delete({ where: { id: existing.id } });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const document = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(document);
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

  const existing = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const document = await prisma.document.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.content !== undefined && { content: body.content }),
      ...(body.shareId !== undefined && { shareId: body.shareId }),
    },
  });

  // Sync to SerikaCloud /serika/documents
  syncDocumentToCloud(
    session.user.id,
    document.id,
    document.title,
    document.content
  ).catch((err) => console.error("Failed to sync document to cloud:", err));

  return NextResponse.json(document);
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

  const existing = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.document.delete({ where: { id } });

  // Remove from SerikaCloud
  removeDocumentFromCloud(session.user.id, id).catch((err) =>
    console.error("Failed to remove document from cloud:", err)
  );

  return NextResponse.json({ success: true });
}
