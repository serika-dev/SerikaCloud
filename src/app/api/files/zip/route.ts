import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFileFromB2, uploadStreamToB2 } from "@/lib/storage";
import archiver from "archiver";
import { PassThrough } from "stream";
import { generateB2Key } from "@/lib/utils";
import { nanoid } from "nanoid";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { folderId } = await req.json();
    if (!folderId) {
      return NextResponse.json({ error: "Folder ID required" }, { status: 400 });
    }

    const folder = await prisma.folder.findUnique({
      where: { id: folderId, userId: session.user.id },
      include: {
        files: true,
        children: {
          include: {
            files: true,
            children: true,
          }
        }
      }
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Recursive function to get all files in a folder structure
    async function getAllFiles(fid: string, path = ""): Promise<{ file: any; path: string }[]> {
      const currentFolder = await prisma.folder.findUnique({
        where: { id: fid },
        include: { files: true, children: true }
      });

      if (!currentFolder) return [];

      let results: { file: any; path: string }[] = [];
      
      // Add files in current folder
      for (const file of currentFolder.files) {
        results.push({ file, path: `${path}${file.name}` });
      }

      // Recursively add children
      for (const child of currentFolder.children) {
        const childFiles = await getAllFiles(child.id, `${path}${child.name}/`);
        results = [...results, ...childFiles];
      }

      return results;
    }

    const allFiles = await getAllFiles(folderId);
    if (allFiles.length === 0) {
      return NextResponse.json({ error: "Folder is empty" }, { status: 400 });
    }

    // Setup Archive Stream
    const archive = archiver("zip", { zlib: { level: 9 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    // ZIP Name
    const zipName = `${folder.name}.zip`;
    const b2Key = generateB2Key(session.user.id, zipName);

    // Add files to archive
    for (const item of allFiles) {
      const b2File = await getFileFromB2(item.file.b2Key);
      if (b2File.body) {
        archive.append(b2File.body as any, { name: item.path });
      }
    }

    // Finalize Archive (async)
    const finalizePromise = archive.finalize();

    // Upload Stream to Storage
    const uploadPromise = uploadStreamToB2(b2Key, passThrough, "application/zip");

    await Promise.all([finalizePromise, uploadPromise]);

    // Create File Record
    const zipSize = archive.pointer();
    const newFile = await prisma.file.create({
      data: {
        name: zipName,
        mimeType: "application/zip",
        size: BigInt(zipSize),
        b2Key: b2Key,
        userId: session.user.id,
        folderId: folder.parentId, 
      }
    });

    // Update Storage Used
    await prisma.user.update({
      where: { id: session.user.id },
      data: { storageUsed: { increment: BigInt(zipSize) } }
    });

    // Create Share Link
    const shareLink = await prisma.shareLink.create({
      data: {
        shortId: nanoid(10),
        fileId: newFile.id,
        userId: session.user.id,
      }
    });

    return NextResponse.json({ 
      success: true, 
      file: newFile, 
      shareUrl: `${process.env.NEXTAUTH_URL}/s/${shareLink.shortId}` 
    });

  } catch (error) {
    console.error("ZIP Error:", error);
    return NextResponse.json({ error: "Failed to create ZIP" }, { status: 500 });
  }
}
