import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFileFromB2, uploadStreamToB2, bodyToBuffer } from "@/lib/storage";
import unzipper from "unzipper";
import { generateB2Key } from "@/lib/utils";
import { lookup } from "mime-types";

const DANGEROUS_EXTENSIONS = [
  '.exe', '.msi', '.bat', '.cmd', '.sh', '.vbs', '.ps1', '.scr', '.com', '.pif', '.gadget', '.jar', '.bin'
];

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { fileId } = await req.json();
    if (!fileId) {
      return NextResponse.json({ error: "File ID required" }, { status: 400 });
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId, userId: session.user.id }
    });

    if (!file || !file.name.toLowerCase().endsWith(".zip")) {
      return NextResponse.json({ error: "Invalid ZIP file" }, { status: 400 });
    }

    // Create target folder
    const baseFolderName = file.name.slice(0, -4); // Remove .zip
    const targetFolder = await prisma.folder.create({
      data: {
        name: baseFolderName,
        userId: session.user.id,
        parentId: file.folderId
      }
    });

    // Get ZIP from storage
    const b2Response = await getFileFromB2(file.b2Key);
    if (!b2Response.body) {
      throw new Error("Could not fetch ZIP from storage");
    }

    // Unzipper (Open.buffer works well with our unified bodyToBuffer helper)
    const directory = await unzipper.Open.buffer(await bodyToBuffer(b2Response.body));
    
    const folderCache: Record<string, string> = { "": targetFolder.id };

    for (const entry of directory.files) {
      if (entry.type === 'Directory') continue;
      
      const parts = entry.path.split('/');
      const fileName = parts.pop() || "";
      if (!fileName) continue;

      const isDangerous = DANGEROUS_EXTENSIONS.some(ext => fileName.toLowerCase().endsWith(ext));
      if (isDangerous) {
        console.warn(`[UNZIP] Skipping blacklisted file: ${entry.path}`);
        continue;
      }

      // Ensure parents exist
      let currentParentId = targetFolder.id;
      let pathAcc = "";
      for (const part of parts) {
        pathAcc += (pathAcc ? "/" : "") + part;
        if (!folderCache[pathAcc]) {
          const newFolder = await prisma.folder.create({
            data: {
              name: part,
              userId: session.user.id,
              parentId: currentParentId
            }
          });
          folderCache[pathAcc] = newFolder.id;
        }
        currentParentId = folderCache[pathAcc];
      }

      // Upload extracted file
      const b2Key = generateB2Key(session.user.id, fileName);
      
      // Robust MIME detection
      const mimeType = lookup(fileName) || "application/octet-stream";

      await uploadStreamToB2(b2Key, entry.stream(), mimeType);

      // Create File Record
      const size = entry.uncompressedSize;
      await prisma.file.create({
        data: {
          name: fileName,
          mimeType: mimeType,
          size: BigInt(size),
          b2Key: b2Key,
          userId: session.user.id,
          folderId: currentParentId
        }
      });

      // Update User Storage
      await prisma.user.update({
        where: { id: session.user.id },
        data: { storageUsed: { increment: BigInt(size) } }
      });
    }

    return NextResponse.json({ success: true, folderId: targetFolder.id });

  } catch (error) {
    console.error("Unzip Error:", error);
    return NextResponse.json({ error: "Failed to extract ZIP" }, { status: 500 });
  }
}
