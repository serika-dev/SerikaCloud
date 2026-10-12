import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { generateB2Key } from "@/lib/utils";
import { checkUploadDestination, parseUploadMetadata, requireUploadUser, serializeUploadedFile, UploadError, uploadErrorResponse } from "@/lib/uploads";

export const runtime = "nodejs";

// Kept for empty files and existing API clients. The browser uses multipart for
// non-empty files so large uploads never need one oversized HTTP request.
export async function POST(request: Request) {
  let key: string | undefined;
  let saved = false;
  try {
    const userId = await requireUploadUser();
    const declaredSize = request.headers.get("x-file-size") ?? request.headers.get("content-length");
    if (declaredSize === null || !/^\d+$/.test(declaredSize)) {
      throw new UploadError("Provide the file size in X-File-Size or Content-Length.", 411);
    }
    const metadata = parseUploadMetadata({
      name: decodeURIComponent(request.headers.get("x-file-name") ?? ""),
      size: Number(declaredSize), type: request.headers.get("content-type"),
      folderId: request.headers.get("x-folder-id"),
    });
    const length = request.headers.get("content-length");
    if (length !== null && Number(length) !== metadata.size) throw new UploadError("File size does not match Content-Length.");
    if (!request.body && metadata.size !== 0) throw new UploadError("No file data was provided.");
    await checkUploadDestination(prisma, userId, metadata);
    key = generateB2Key(userId, randomUUID());
    let received = 0;
    const stream = Readable.from((async function* () {
      if (request.body) {
        for await (const chunk of Readable.fromWeb(request.body as import("node:stream/web").ReadableStream<Uint8Array>)) {
          received += chunk.length;
          if (received > metadata.size) throw new UploadError("File contains more bytes than declared.");
          yield chunk;
        }
      }
      if (received !== metadata.size) throw new UploadError("The upload was incomplete. Please retry.");
    })());
    await storage.uploadStream(key, stream, metadata.mimeType);
    if ((await storage.getFileHead(key)).contentLength !== metadata.size) throw new UploadError("The saved file size does not match the upload.", 409);
    const b2Key = key;
    const file = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const used = await checkUploadDestination(tx, userId, metadata);
      const record = await tx.file.create({ data: {
        name: metadata.name, mimeType: metadata.mimeType, size: BigInt(received),
        b2Key, folderId: metadata.folderId, userId,
      } });
      await tx.user.update({ where: { id: userId }, data: { storageUsed: used + BigInt(received) } });
      return record;
    });
    saved = true;
    return NextResponse.json(serializeUploadedFile(file), { status: 201 });
  } catch (error) {
    if (key && !saved) {
      // Do not remove a file if a DB commit succeeded but its response was lost.
      try {
        if (!await prisma.file.findUnique({ where: { b2Key: key } })) await storage.deleteFile(key);
      } catch (cleanupError) { console.error("Upload cleanup failed:", cleanupError); }
    }
    return uploadErrorResponse(error);
  }
}
