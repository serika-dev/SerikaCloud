import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Ensure /serika/documents folder path exists for a user, return the documents folder ID
async function ensureDocumentsFolder(userId: string): Promise<string> {
  // Find or create "serika" root folder
  let serikaFolder = await prisma.folder.findFirst({
    where: { userId, name: "serika", parentId: null },
  });
  if (!serikaFolder) {
    serikaFolder = await prisma.folder.create({
      data: { name: "serika", userId, parentId: null },
    });
  }

  // Find or create "documents" inside "serika"
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

// Sync a document as a .json file in /serika/documents
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

  // Upsert the cloud file entry
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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documents = await prisma.document.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      shareId: true,
    },
  });

  return NextResponse.json(documents);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const document = await prisma.document.create({
    data: {
      title: body.title || "Untitled Document",
      content: body.content || null,
      userId: session.user.id,
    },
  });

  // Sync to SerikaCloud /serika/documents
  await syncDocumentToCloud(
    session.user.id,
    document.id,
    document.title,
    document.content
  ).catch((err) => console.error("Failed to sync document to cloud:", err));

  return NextResponse.json(document);
}
