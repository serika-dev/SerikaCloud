import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFileFromB2, uploadFileToB2, bodyToBuffer } from "@/lib/storage";
import { generateB2Key } from "@/lib/utils";
import { nanoid } from "nanoid";
import createTorrent from "create-torrent";
import { Readable } from "stream";

// Default torrents folder path
const TORRENTS_FOLDER_PATH = "serika/torrents";

interface FileInfo {
  name: string;
  length: number;
  data: Buffer;
}

async function getAllFilesInFolder(
  folderId: string,
  userId: string,
  path = ""
): Promise<FileInfo[]> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId, userId },
    include: {
      files: true,
      children: true,
    },
  });

  if (!folder) return [];

  let results: FileInfo[] = [];

  // Get files in current folder
  for (const file of folder.files) {
    try {
      const b2File = await getFileFromB2(file.b2Key);
      if (b2File.body) {
        const buffer = await bodyToBuffer(b2File.body);
        results.push({
          name: path ? `${path}/${file.name}` : file.name,
          length: Number(file.size),
          data: buffer,
        });
      }
    } catch (e) {
      console.error(`Failed to get file ${file.name}:`, e);
    }
  }

  // Recursively get files from subfolders
  for (const child of folder.children) {
    const childPath = path ? `${path}/${child.name}` : child.name;
    const childFiles = await getAllFilesInFolder(child.id, userId, childPath);
    results = [...results, ...childFiles];
  }

  return results;
}

async function ensureTorrentsFolder(userId: string) {
  // Check if torrents folder exists
  let folder = await prisma.folder.findFirst({
    where: {
      userId,
      name: "Torrents",
      parentId: null,
    },
  });

  if (!folder) {
    folder = await prisma.folder.create({
      data: {
        name: "Torrents",
        userId,
      },
    });
  }

  return folder;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { fileId, folderId } = await req.json();

    if (!fileId && !folderId) {
      return NextResponse.json(
        { error: "File ID or Folder ID required" },
        { status: 400 }
      );
    }

    let files: FileInfo[] = [];
    let torrentName: string;

    if (fileId) {
      // Single file torrent
      const file = await prisma.file.findFirst({
        where: { id: fileId, userId: session.user.id },
      });

      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      const b2File = await getFileFromB2(file.b2Key);
      if (!b2File.body) {
        return NextResponse.json(
          { error: "Failed to retrieve file" },
          { status: 500 }
        );
      }

      const buffer = await bodyToBuffer(b2File.body);
      files.push({
        name: file.name,
        length: Number(file.size),
        data: buffer,
      });
      torrentName = `${file.name}.torrent`;
    } else if (folderId) {
      // Folder torrent (multiple files)
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId: session.user.id },
      });

      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }

      files = await getAllFilesInFolder(folderId, session.user.id);
      if (files.length === 0) {
        return NextResponse.json(
          { error: "Folder is empty or contains no accessible files" },
          { status: 400 }
        );
      }
      torrentName = `${folder.name}.torrent`;
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Create torrent using create-torrent
    const torrentBuffer = await new Promise<Buffer>((resolve, reject) => {
      const fileInputs = files.map((f) => ({
        name: f.name,
        length: f.length,
        createReadStream: () => Readable.from([f.data]),
      }));

      createTorrent(
        fileInputs,
        {
          name: torrentName.replace(".torrent", ""),
          comment: `Created with SerikaCloud - ${new Date().toISOString()}`,
          createdBy: "SerikaCloud",
          private: false,
        },
        (err: Error | null, torrent?: Buffer) => {
          if (err) reject(err);
          else if (!torrent) reject(new Error("Failed to create torrent"));
          else resolve(torrent);
        }
      );
    });

    // Ensure torrents folder exists
    const torrentsFolder = await ensureTorrentsFolder(session.user.id);

    // Upload torrent file to storage
    const torrentB2Key = `${TORRENTS_FOLDER_PATH}/${session.user.id}/${nanoid()}-${torrentName}`;
    await uploadFileToB2(
      torrentB2Key,
      torrentBuffer,
      "application/x-bittorrent",
      torrentBuffer.length
    );

    // Create file record in database
    const torrentFile = await prisma.file.create({
      data: {
        name: torrentName,
        mimeType: "application/x-bittorrent",
        size: BigInt(torrentBuffer.length),
        b2Key: torrentB2Key,
        userId: session.user.id,
        folderId: torrentsFolder.id,
      },
    });

    // Update storage used
    await prisma.user.update({
      where: { id: session.user.id },
      data: { storageUsed: { increment: BigInt(torrentBuffer.length) } },
    });

    // Create share link for the torrent
    const shareLink = await prisma.shareLink.create({
      data: {
        shortId: nanoid(10),
        fileId: torrentFile.id,
        userId: session.user.id,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL
      ? new URL(process.env.NEXTAUTH_URL).origin
      : new URL(req.url).origin;

    return NextResponse.json({
      success: true,
      file: {
        id: torrentFile.id,
        name: torrentFile.name,
        size: Number(torrentFile.size),
      },
      shareUrl: `${baseUrl}/s/${shareLink.shortId}`,
      downloadUrl: `${baseUrl}/api/files/${torrentFile.id}/${encodeURIComponent(torrentFile.name)}`,
    });
  } catch (error) {
    console.error("Torrent creation error:", error);
    return NextResponse.json(
      { error: "Failed to create torrent" },
      { status: 500 }
    );
  }
}
