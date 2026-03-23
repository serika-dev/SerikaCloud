import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadStreamToB2 } from "@/lib/storage";
import { generateB2Key } from "@/lib/utils";
import { lookup } from "mime-types";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const filenameRaw = request.headers.get("x-file-name");
    const filename = filenameRaw ? decodeURIComponent(filenameRaw) : null;
    const folderId = request.headers.get("x-folder-id");
    const contentType = request.headers.get("content-type") || "application/octet-stream";
    const contentLength = Number(request.headers.get("content-length") || "0");

    if (!filename) {
      return NextResponse.json({ error: "No filename provided in x-file-name header" }, { status: 400 });
    }
    if (!request.body) {
      return NextResponse.json({ error: "No request body provided" }, { status: 400 });
    }

    // Check storage quota
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { storageUsed: true, storageLimit: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newTotal = Number(user.storageUsed) + contentLength;
    if (newTotal > Number(user.storageLimit)) {
      const limitGB = Math.round(Number(user.storageLimit) / (1024 * 1024 * 1024) * 10) / 10;
      return NextResponse.json(
        { error: `Storage quota exceeded. You have reached your ${limitGB}GB limit.` },
        { status: 413 }
      );
    }

    // Validate folder belongs to user if specified
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId: session.user.id },
      });
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
    }

    // Upload to B2 via streaming (minimizes server memory for 1TB files)
    const b2Key = generateB2Key(session.user.id, filename);
    const mimeType = lookup(filename) || contentType;

    await uploadStreamToB2(b2Key, request.body, mimeType);

    // Create file record
    const fileRecord = await prisma.file.create({
      data: {
        name: filename,
        mimeType,
        size: BigInt(contentLength),
        b2Key,
        folderId: folderId || null,
        userId: session.user.id,
      },
    });

    // Update storage used
    await prisma.user.update({
      where: { id: session.user.id },
      data: { storageUsed: BigInt(newTotal) },
    });

    return NextResponse.json(
      {
        id: fileRecord.id,
        name: fileRecord.name,
        mimeType: fileRecord.mimeType,
        size: Number(fileRecord.size),
        createdAt: fileRecord.createdAt,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
