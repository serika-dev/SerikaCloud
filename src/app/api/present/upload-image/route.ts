import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToB2, getPresignedUrl } from "@/lib/storage";
import { generateB2Key } from "@/lib/utils";
import { lookup } from "mime-types";

// Ensure /serika/images folder path exists for a user
async function ensureImagesFolder(userId: string): Promise<string> {
  let serikaFolder = await prisma.folder.findFirst({
    where: { userId, name: "serika", parentId: null },
  });
  if (!serikaFolder) {
    serikaFolder = await prisma.folder.create({
      data: { name: "serika", userId, parentId: null },
    });
  }
  let imagesFolder = await prisma.folder.findFirst({
    where: { userId, name: "images", parentId: serikaFolder.id },
  });
  if (!imagesFolder) {
    imagesFolder = await prisma.folder.create({
      data: { name: "images", userId, parentId: serikaFolder.id },
    });
  }
  return imagesFolder.id;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    // Check storage quota
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { storageUsed: true, storageLimit: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const newTotal = Number(user.storageUsed) + file.size;
    if (newTotal > Number(user.storageLimit)) {
      return NextResponse.json({ error: "Storage quota exceeded" }, { status: 413 });
    }

    const folderId = await ensureImagesFolder(session.user.id);
    const b2Key = `serika/images/${session.user.id}/${Date.now()}_${file.name}`;
    const mimeType = lookup(file.name) || file.type;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadFileToB2(b2Key, buffer, mimeType, buffer.length);

    // Create file record in SerikaCloud
    const fileRecord = await prisma.file.create({
      data: {
        name: file.name,
        mimeType,
        size: BigInt(file.size),
        b2Key,
        userId: session.user.id,
        folderId,
      },
    });

    // Update storage used
    await prisma.user.update({
      where: { id: session.user.id },
      data: { storageUsed: BigInt(newTotal) },
    });

    // Get a presigned URL so the slide can display it
    const url = await getPresignedUrl(b2Key, 86400 * 7); // 7 days

    return NextResponse.json({
      id: fileRecord.id,
      url,
      name: file.name,
      size: Number(fileRecord.size),
    });
  } catch (error) {
    console.error("Image upload error:", error);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
