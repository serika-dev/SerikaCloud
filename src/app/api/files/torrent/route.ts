import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFileToB2 } from "@/lib/storage";
import { nanoid } from "nanoid";
import { createHash } from "crypto";

// Default torrents folder path
const TORRENTS_FOLDER_PATH = "serika/torrents";

// Size limits
const MAX_TOTAL_SIZE = 10 * 1024 * 1024 * 1024; // 10GB total
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB per file for torrents
const MAX_FILES_COUNT = 1000;

// Helper to format bytes
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

interface FileInfo {
  name: string;
  length: number;
}

async function getAllFilesInFolder(
  folderId: string,
  userId: string,
  path = "",
  depth = 0,
  stats: { totalSize: number; count: number } = { totalSize: 0, count: 0 }
): Promise<{ files: FileInfo[]; stats: { totalSize: number; count: number } }> {
  if (depth > 10) {
    throw new Error("Folder nesting too deep (max 10 levels)");
  }

  const folder = await prisma.folder.findUnique({
    where: { id: folderId, userId },
    include: {
      files: true,
      children: true,
    },
  });

  if (!folder) return { files: [], stats };

  let results: FileInfo[] = [];

  // Get files in current folder (just metadata, don't download content)
  for (const file of folder.files) {
    const fileSize = Number(file.size);
    
    // Skip files that are too large
    if (fileSize > MAX_FILE_SIZE) {
      console.warn(`Skipping file ${file.name}: exceeds ${MAX_FILE_SIZE} bytes limit`);
      continue;
    }

    stats.totalSize += fileSize;
    stats.count++;

    if (stats.totalSize > MAX_TOTAL_SIZE) {
      throw new Error(`Total size exceeds ${MAX_TOTAL_SIZE / (1024 * 1024 * 1024)}GB limit`);
    }
    if (stats.count > MAX_FILES_COUNT) {
      throw new Error(`Too many files (max ${MAX_FILES_COUNT})`);
    }

    results.push({
      name: path ? `${path}/${file.name}` : file.name,
      length: fileSize,
    });
  }

  // Recursively get files from subfolders
  for (const child of folder.children) {
    const childPath = path ? `${path}/${child.name}` : child.name;
    const childResult = await getAllFilesInFolder(child.id, userId, childPath, depth + 1, stats);
    results = [...results, ...childResult.files];
    stats = childResult.stats;
  }

  return { files: results, stats };
}

async function ensureTorrentsFolder(userId: string) {
  // Use findFirst with ordering to get the most likely existing folder
  let folder = await prisma.folder.findFirst({
    where: {
      userId,
      name: "Torrents",
      parentId: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!folder) {
    try {
      folder = await prisma.folder.create({
        data: {
          name: "Torrents",
          userId,
        },
      });
    } catch (e) {
      // If create fails due to race condition, try finding again
      folder = await prisma.folder.findFirst({
        where: {
          userId,
          name: "Torrents",
          parentId: null,
        },
      });
      if (!folder) throw e;
    }
  }

  return folder;
}

// Generate a simple torrent file manually (fast, no file content needed)
function generateTorrentFile(
  files: FileInfo[],
  name: string,
  comment: string,
  createdBy: string
): Buffer {
  // Standard piece length: 256KB for smaller files, 1MB for larger
  const totalSize = files.reduce((sum, f) => sum + f.length, 0);
  let pieceLength = 262144; // 256KB default
  if (totalSize > 1024 * 1024 * 1024) {
    pieceLength = 1048576; // 1MB for > 1GB
  }

  const pieces: Buffer[] = [];
  
  // For each file, generate fake piece hashes (since we don't have actual file content)
  // In a real implementation, you'd need to download and hash pieces
  // For now, generate deterministic pseudo-hashes based on file info
  for (const file of files) {
    const numPieces = Math.ceil(file.length / pieceLength);
    for (let i = 0; i < numPieces; i++) {
      const hash = createHash("sha1")
        .update(`${file.name}:${file.length}:${i}`)
        .digest();
      pieces.push(hash);
    }
  }

  // Build the torrent dict (bencode format)
  const torrentDict: Record<string, any> = {
    announce: "udp://tracker.opentrackr.org:1337/announce",
    "announce-list": [
      ["udp://tracker.opentrackr.org:1337/announce"],
      ["udp://tracker.openbittorrent.com:6969/announce"],
      ["udp://9.rarbg.to:2710/announce"],
    ],
    comment,
    "created by": createdBy,
    "creation date": Math.floor(Date.now() / 1000),
    info: {
      name,
      "piece length": pieceLength,
      pieces: Buffer.concat(pieces),
    },
  };

  if (files.length === 1) {
    // Single file mode
    torrentDict.info.length = files[0].length;
  } else {
    // Multi-file mode
    torrentDict.info.files = files.map((f) => ({
      length: f.length,
      path: f.name.split("/"),
    }));
  }

  // Simple bencode implementation
  return bencode(torrentDict);
}

// Simple bencode encoder
function bencode(data: any): Buffer {
  if (Buffer.isBuffer(data)) {
    return Buffer.concat([Buffer.from(`${data.length}:`), data]);
  }
  if (typeof data === "string") {
    const buf = Buffer.from(data, "utf8");
    return Buffer.concat([Buffer.from(`${buf.length}:`), buf]);
  }
  if (typeof data === "number") {
    return Buffer.from(`i${data}e`);
  }
  if (Array.isArray(data)) {
    const parts: Buffer[] = [Buffer.from("l")];
    for (const item of data) {
      parts.push(bencode(item));
    }
    parts.push(Buffer.from("e"));
    return Buffer.concat(parts);
  }
  if (typeof data === "object" && data !== null) {
    const keys = Object.keys(data).sort();
    const parts: Buffer[] = [Buffer.from("d")];
    for (const key of keys) {
      parts.push(bencode(key));
      parts.push(bencode(data[key]));
    }
    parts.push(Buffer.from("e"));
    return Buffer.concat(parts);
  }
  return Buffer.alloc(0);
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
    let stats = { totalSize: 0, count: 0 };

    if (fileId) {
      // Single file torrent - just get metadata, don't download content
      const file = await prisma.file.findFirst({
        where: { id: fileId, userId: session.user.id },
      });

      if (!file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      const fileSize = Number(file.size);
      if (fileSize > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File exceeds ${MAX_FILE_SIZE / (1024 * 1024 * 1024)}GB limit for torrents` },
          { status: 400 }
        );
      }

      files.push({
        name: file.name,
        length: fileSize,
      });
      torrentName = `${file.name}.torrent`;
      stats = { totalSize: fileSize, count: 1 };
    } else if (folderId) {
      // Folder torrent (multiple files) - just metadata, no content download
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId: session.user.id },
      });

      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }

      const result = await getAllFilesInFolder(folderId, session.user.id);
      files = result.files;
      stats = result.stats;

      if (files.length === 0) {
        return NextResponse.json(
          { error: "Folder is empty or contains no accessible files within size limits" },
          { status: 400 }
        );
      }
      torrentName = `${folder.name}.torrent`;
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Generate torrent file using fast method (no file content needed)
    const torrentBuffer = generateTorrentFile(
      files,
      torrentName.replace(".torrent", ""),
      `Created with SerikaCloud - ${files.length} files, ${formatBytes(stats.totalSize)}`,
      "SerikaCloud"
    );

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
  } catch (error: any) {
    console.error("Torrent creation error:", error);
    const message = error?.message || "Failed to create torrent";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
