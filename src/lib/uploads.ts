import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { lookup } from "mime-types";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storage } from "@/lib/storage";
import { generateB2Key } from "@/lib/utils";

const MiB = 1024 * 1024;
export const DEFAULT_CHUNK_SIZE = 16 * MiB;
export const MAX_CHUNK_SIZE = 64 * MiB;
export const MAX_UPLOAD_SIZE = MAX_CHUNK_SIZE * 10_000;
const TOKEN_LIFETIME = 24 * 60 * 60 * 1000;

export class UploadError extends Error {
  constructor(message: string, public status = 400, public code = "INVALID_UPLOAD") {
    super(message);
  }
}

export interface UploadMetadata {
  name: string;
  size: number;
  mimeType: string;
  folderId: string | null;
}

export interface UploadSession extends UploadMetadata {
  userId: string;
  key: string;
  uploadId: string;
  chunkSize: number;
  expiresAt: number;
}

export async function requireUploadUser() {
  const session = await auth();
  if (!session?.user?.id) throw new UploadError("Please sign in before uploading.", 401);
  return session.user.id;
}

export function parseUploadMetadata(value: unknown): UploadMetadata {
  if (!value || typeof value !== "object") throw new UploadError("Invalid upload details.");
  const { name, size, type, folderId } = value as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || name.length > 255 || /[\x00-\x1f]/.test(name)) {
    throw new UploadError("A filename of 1–255 characters is required.");
  }
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) {
    throw new UploadError("A valid file size is required.");
  }
  if (size > MAX_UPLOAD_SIZE) throw new UploadError("This file exceeds the 625 GiB upload limit.", 413);
  if (folderId != null && (typeof folderId !== "string" || !folderId || folderId.length > 128)) {
    throw new UploadError("Invalid destination folder.");
  }
  const mimeType = lookup(name) || (typeof type === "string" && /^[\w.+-]+\/[\w.+-]+$/.test(type)
    ? type : "application/octet-stream");
  return { name, size, mimeType, folderId: folderId as string | null | undefined ?? null };
}

export function getChunkSize(size: number) {
  // Stay below Cloudflare's 100 MB request limit and S3's 10,000-part limit.
  return Math.max(DEFAULT_CHUNK_SIZE, Math.ceil(size / 10_000 / MiB) * MiB);
}

function signingSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET or NEXTAUTH_SECRET is required for uploads.");
  return secret;
}

export function signUploadSession(session: UploadSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = createHmac("sha256", signingSecret()).update(`file-upload:${payload}`).digest("base64url");
  return `${payload}.${signature}`;
}

export function readUploadSession(token: unknown, userId: string): UploadSession {
  if (typeof token !== "string" || token.length > 8192) throw new UploadError("Invalid upload session.");
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) throw new UploadError("Invalid upload session.");
  const expected = createHmac("sha256", signingSecret()).update(`file-upload:${payload}`).digest();
  const supplied = Buffer.from(signature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new UploadError("Invalid upload session.");
  }
  let session: UploadSession;
  try { session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { throw new UploadError("Invalid upload session."); }
  if (session.userId !== userId) throw new UploadError("This upload belongs to another user.", 403);
  if (session.expiresAt <= Date.now()) throw new UploadError("Upload expired. Please select the file again.", 410);
  return session;
}

type Database = Prisma.TransactionClient;

export async function checkUploadDestination(db: Database, userId: string, metadata: UploadMetadata) {
  const user = await db.user.findUnique({
    where: { id: userId }, select: { storageLimit: true },
  });
  if (!user) throw new UploadError("User not found. Please sign in again.", 404);
  if (metadata.folderId && !await db.folder.findFirst({ where: { id: metadata.folderId, userId } })) {
    throw new UploadError("The destination folder no longer exists.", 404);
  }
  const aggregate = await db.file.aggregate({ where: { userId }, _sum: { size: true } });
  const used = aggregate._sum.size ?? BigInt(0);
  if (used + BigInt(metadata.size) > user.storageLimit) {
    const available = Math.max(0, Number(user.storageLimit - used)) / (1024 ** 3);
    throw new UploadError(`Not enough storage. ${available.toFixed(2)} GiB available. Free up space or increase your storage limit.`, 413, "STORAGE_QUOTA_EXCEEDED");
  }
  return used;
}

export async function initiateUpload(userId: string, metadata: UploadMetadata) {
  if (metadata.size === 0) throw new UploadError("Use the single-request endpoint for empty files.");
  signingSecret(); // Validate configuration before allocating storage.
  await checkUploadDestination(prisma, userId, metadata);
  // The original name lives in the DB; a short UUID avoids filesystem NAME_MAX
  // failures and collisions for simultaneous uploads with the same filename.
  const key = generateB2Key(userId, randomUUID());
  const uploadId = await storage.createMultipartUpload(key, metadata.mimeType);
  const session: UploadSession = {
    ...metadata, userId, key, uploadId, chunkSize: getChunkSize(metadata.size),
    expiresAt: Date.now() + TOKEN_LIFETIME,
  };
  return { token: signUploadSession(session), chunkSize: session.chunkSize };
}

export function expectedPartSize(session: UploadSession, partNumber: number) {
  const count = Math.ceil(session.size / session.chunkSize);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > count) {
    throw new UploadError("Invalid upload part number.");
  }
  return Math.min(session.chunkSize, session.size - (partNumber - 1) * session.chunkSize);
}

// A chunk is bounded in memory and validated before it reaches object storage.
// Never buffer a whole file, and never trust Content-Length for accounting.
export async function readPartBody(request: Request, expectedSize: number) {
  const length = request.headers.get("content-length");
  if (length !== null && Number(length) !== expectedSize) throw new UploadError("Upload part size does not match.");
  if (!request.body) throw new UploadError("Missing upload part.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > expectedSize) {
        await reader.cancel();
        throw new UploadError("Upload part is larger than expected.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (size !== expectedSize) throw new UploadError("Upload part was incomplete. Please retry.");
  return Buffer.concat(chunks, size);
}

export function isMissingStorageObject(error: unknown) {
  const e = error as { name?: string; code?: string; $metadata?: { httpStatusCode?: number } };
  return e?.code === "ENOENT" || ["NotFound", "NoSuchKey", "NoSuchUpload"].includes(e?.name ?? "") || e?.$metadata?.httpStatusCode === 404;
}

async function storedSize(key: string) {
  try { return (await storage.getFileHead(key)).contentLength; }
  catch (error) { if (isMissingStorageObject(error)) return undefined; throw error; }
}

export function serializeUploadedFile(file: { id: string; name: string; mimeType: string; size: bigint; createdAt: Date }) {
  return { id: file.id, name: file.name, mimeType: file.mimeType, size: Number(file.size), createdAt: file.createdAt };
}

export async function completeUpload(session: UploadSession) {
  return prisma.$transaction(async (tx) => {
    // All upload completions for this user share a lock. This keeps quota checks,
    // file insertion and accounting atomic, including simultaneous completions.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.userId} FOR UPDATE`;
    const existing = await tx.file.findUnique({ where: { b2Key: session.key } });
    if (existing) return serializeUploadedFile(existing);
    const used = await checkUploadDestination(tx, session.userId, session);

    // Recover if storage completed but the HTTP response or DB transaction failed.
    let size = await storedSize(session.key);
    if (size === undefined) {
      const parts = (await storage.listParts(session.key, session.uploadId)).sort((a, b) => a.partNumber - b.partNumber);
      const count = Math.ceil(session.size / session.chunkSize);
      if (parts.length !== count || parts.some((part, index) =>
        part.partNumber !== index + 1 || part.size !== expectedPartSize(session, index + 1))) {
        throw new UploadError("Some upload parts are missing or incomplete.", 409);
      }
      await storage.completeMultipartUpload(session.key, session.uploadId, parts, session.mimeType);
      size = await storedSize(session.key);
    }
    if (size !== session.size) throw new UploadError("The saved file size does not match the upload.", 409);
    const file = await tx.file.create({ data: {
      userId: session.userId, name: session.name, mimeType: session.mimeType,
      size: BigInt(size), b2Key: session.key, folderId: session.folderId,
    } });
    await tx.user.update({ where: { id: session.userId }, data: { storageUsed: used + BigInt(size) } });
    return serializeUploadedFile(file);
  }, { maxWait: 120_000, timeout: 120_000 });
}

export async function abortUpload(session: UploadSession) {
  await prisma.$transaction(async (tx) => {
    // Serialize abort against complete so a delayed cleanup cannot delete a saved file.
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${session.userId} FOR UPDATE`;
    if (await tx.file.findUnique({ where: { b2Key: session.key } })) return;
    try { await storage.abortMultipartUpload(session.key, session.uploadId); }
    catch (error) { if (!isMissingStorageObject(error)) throw error; }
    if (await storedSize(session.key) !== undefined) await storage.deleteFile(session.key);
  }, { maxWait: 120_000, timeout: 120_000 });
}

export async function receiveUploadPart(request: Request, session: UploadSession, partNumber: number) {
  const size = expectedPartSize(session, partNumber);
  const body = await readPartBody(request, size);
  return storage.uploadPart(session.key, session.uploadId, partNumber, body, size);
}

export function uploadErrorResponse(error: unknown) {
  if (error instanceof UploadError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof SyntaxError || error instanceof URIError) return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  if (isMissingStorageObject(error)) return NextResponse.json({ error: "Upload no longer exists. Please select the file again." }, { status: 410 });
  console.error("Upload error:", error);
  return NextResponse.json({ error: "Could not save the upload. Please try again." }, { status: 500 });
}
