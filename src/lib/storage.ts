import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs/promises";
import path from "path";
import { createReadStream, createWriteStream } from "fs";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { createHash, randomUUID } from "crypto";

// Configuration
const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "s3";
const BACKBLAZE_S3 = process.env.BACKBLAZE_S3;
const BACKBLAZE_KEYID = process.env.BACKBLAZE_KEYID;
const BACKBLAZE_AKEY = process.env.BACKBLAZE_AKEY;
const BACKBLAZE_BUCKET = process.env.BACKBLAZE_BUCKET;

const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || "./storage";

export interface StorageResult {
  body: any;
  contentType?: string;
  contentLength?: number;
  contentRange?: string;
}

export interface MultipartPart {
  partNumber: number;
  etag: string;
  size: number;
}

type UploadBody = ReadableStream<Uint8Array> | NodeJS.ReadableStream | Uint8Array;

function nodeUploadBody(body: UploadBody): Readable {
  if (body instanceof Uint8Array) return Readable.from([body]);
  return "getReader" in body
    ? Readable.fromWeb(body as import("stream/web").ReadableStream<Uint8Array>)
    : body as Readable;
}

async function multipartBytes(body: UploadBody, size: number): Promise<Uint8Array> {
  if (body instanceof Uint8Array) {
    if (body.byteLength !== size) throw new Error("Uploaded part does not match its declared size");
    return body;
  }
  const chunks: Buffer[] = [];
  let actualSize = 0;
  for await (const chunk of nodeUploadBody(body)) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    actualSize += bytes.length;
    if (actualSize > size) throw new Error("Uploaded part exceeds its declared size");
    chunks.push(bytes);
  }
  if (actualSize !== size) throw new Error("Uploaded part is shorter than its declared size");
  return Buffer.concat(chunks, actualSize);
}

function validatePart(partNumber: number, size: number) {
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
    throw new Error("Invalid multipart part number");
  }
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error("Invalid multipart part size");
  }
}

export interface StorageProvider {
  uploadStream(key: string, body: ReadableStream | NodeJS.ReadableStream, contentType: string): Promise<any>;
  uploadFile(key: string, body: Buffer | Uint8Array, contentType: string, size: number): Promise<any>;
  getFile(key: string, range?: string): Promise<StorageResult>;
  deleteFile(key: string): Promise<any>;
  getPresignedUrl(key: string, expiresIn?: number): Promise<string>;
  getFileHead(key: string): Promise<{ contentLength?: number, contentType?: string }>;
  createMultipartUpload(key: string, contentType: string): Promise<string>;
  uploadPart(key: string, uploadId: string, partNumber: number, body: UploadBody, size: number): Promise<MultipartPart>;
  listParts(key: string, uploadId: string): Promise<MultipartPart[]>;
  completeMultipartUpload(key: string, uploadId: string, parts: MultipartPart[], contentType: string): Promise<void>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
}

class S3Provider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const region = BACKBLAZE_S3?.split(".")[1] || "eu-central-003";
    this.client = new S3Client({
      endpoint: `https://${BACKBLAZE_S3}`,
      region,
      credentials: {
        accessKeyId: BACKBLAZE_KEYID!,
        secretAccessKey: BACKBLAZE_AKEY!,
      },
      forcePathStyle: true,
    });
    this.bucket = BACKBLAZE_BUCKET!;
  }

  async uploadStream(key: string, body: any, contentType: string) {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: "AES256",
      },
    });
    return upload.done();
  }

  async uploadFile(key: string, body: any, contentType: string, size: number) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: size,
      ServerSideEncryption: "AES256",
    });
    return this.client.send(command);
  }

  async getFile(key: string, range?: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Range: range,
    });
    const response = await this.client.send(command);
    return {
      body: response.Body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      contentRange: response.ContentRange,
    };
  }

  async deleteFile(key: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return this.client.send(command);
  }

  async getPresignedUrl(key: string, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async getFileHead(key: string) {
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    const response = await this.client.send(command);
    return {
      contentLength: response.ContentLength,
      contentType: response.ContentType,
    };
  }

  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    const result = await this.client.send(new CreateMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    }));
    if (!result.UploadId) throw new Error("Storage did not create an upload session");
    return result.UploadId;
  }

  async uploadPart(key: string, uploadId: string, partNumber: number, body: UploadBody, size: number): Promise<MultipartPart> {
    validatePart(partNumber, size);
    // Upload requests are bounded chunks. Supplying bytes lets the SDK send its
    // integrity checksum in a header. Its default aws-chunked checksum trailers
    // for Node streams are not accepted by all S3-compatible stores (including B2).
    const bytes = await multipartBytes(body, size);
    const result = await this.client.send(new UploadPartCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: bytes,
      ContentLength: size,
    }));
    if (!result.ETag) throw new Error("Storage did not acknowledge the uploaded part");
    return { partNumber, etag: result.ETag, size };
  }

  async listParts(key: string, uploadId: string): Promise<MultipartPart[]> {
    const parts: MultipartPart[] = [];
    let marker: string | undefined;
    do {
      const result = await this.client.send(new ListPartsCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: marker,
      }));
      for (const part of result.Parts ?? []) {
        if (part.PartNumber === undefined || !part.ETag || part.Size === undefined) {
          throw new Error("Storage returned invalid multipart metadata");
        }
        parts.push({ partNumber: part.PartNumber, etag: part.ETag, size: part.Size });
      }
      if (!result.IsTruncated) break;
      if (!result.NextPartNumberMarker || result.NextPartNumberMarker === marker) {
        throw new Error("Storage returned an invalid multipart continuation");
      }
      marker = result.NextPartNumberMarker;
    } while (true);
    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: MultipartPart[], _contentType: string): Promise<void> {
    // S3 keeps the content type supplied when the multipart session is created.
    void _contentType;
    await this.client.send(new CompleteMultipartUploadCommand({
      Bucket: this.bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: [...parts].sort((a, b) => a.partNumber - b.partNumber).map((part) => ({
          PartNumber: part.partNumber,
          ETag: part.etag,
        })),
      },
    }));
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      await this.client.send(new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      }));
    } catch (error) {
      // Completed or already-aborted sessions need no further cleanup.
      if (!(error instanceof Error) || error.name !== "NoSuchUpload") throw error;
    }
  }
}

interface LocalPart extends MultipartPart {
  file: string;
}

export class LocalProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir = LOCAL_STORAGE_PATH) {
    this.baseDir = path.resolve(baseDir);
  }

  private getFilePath(key: string) {
    // Prevent directory traversal
    const safeKey = key.replace(/\.\.\//g, "");
    return path.join(this.baseDir, safeKey);
  }

  async uploadStream(key: string, body: any, _contentType: string) {
    const filePath = this.getFilePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    
    const nodeStream = body.getReader ? Readable.fromWeb(body as any) : body;
    const writeStream = createWriteStream(filePath);
    await pipeline(nodeStream, writeStream);
    return { Key: key };
  }

  async uploadFile(key: string, body: any, _contentType: string, _size: number) {
    const filePath = this.getFilePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, body);
    return { Key: key };
  }

  async getFile(key: string, range?: string) {
    const filePath = this.getFilePath(key);
    const stats = await fs.stat(filePath);
    
    if (range) {
      // Basic range support: "bytes=start-end"
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      
      return {
        body: createReadStream(filePath, { start, end }),
        contentLength: end - start + 1,
        contentRange: `bytes ${start}-${end}/${stats.size}`,
        contentType: undefined,
      };
    }

    return {
      body: createReadStream(filePath),
      contentLength: stats.size,
      contentRange: undefined,
      contentType: undefined,
    };
  }

  async deleteFile(key: string) {
    const filePath = this.getFilePath(key);
    try {
      await fs.unlink(filePath);
      
      // Clean up empty parent directories
      let currentDir = path.dirname(filePath);
      while (currentDir !== this.baseDir) {
        const files = await fs.readdir(currentDir);
        if (files.length === 0) {
          await fs.rmdir(currentDir);
          currentDir = path.dirname(currentDir);
        } else {
          break;
        }
      }
    } catch (e) {
      console.warn(`File not found for deletion or cleanup: ${key}`);
    }
  }

  async getPresignedUrl(key: string, _expiresIn = 3600) {
    // For local storage, we return a direct API endpoint path
    return `/api/files/download?key=${encodeURIComponent(key)}`;
  }

  async getFileHead(key: string) {
    const filePath = this.getFilePath(key);
    const stats = await fs.stat(filePath);
    return {
      contentLength: stats.size,
    };
  }

  private multipartFilePath(key: string) {
    const filePath = path.resolve(this.baseDir, key);
    const relative = path.relative(this.baseDir, filePath);
    if (!key || path.isAbsolute(key) || filePath === this.baseDir || !filePath.startsWith(`${this.baseDir}${path.sep}`) || key.split(/[\\/]/).includes("..") || relative.split(path.sep)[0] === ".uploads") {
      throw new Error("Invalid multipart storage key");
    }
    return filePath;
  }

  private uploadDirectory(uploadId: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uploadId)) {
      throw new Error("Invalid multipart upload ID");
    }
    return path.join(this.baseDir, ".uploads", uploadId);
  }

  private async getUploadDirectory(key: string, uploadId: string) {
    this.multipartFilePath(key);
    const directory = this.uploadDirectory(uploadId);
    const metadata = JSON.parse(await fs.readFile(path.join(directory, "upload.json"), "utf8"));
    if (metadata.key !== key) throw new Error("Multipart upload does not belong to this file");
    return directory;
  }

  private async readParts(directory: string): Promise<LocalPart[]> {
    const entries = await fs.readdir(directory);
    const parts: LocalPart[] = [];
    for (const entry of entries) {
      const match = /^([1-9]\d{0,4})\.json$/.exec(entry);
      if (!match) continue;
      const part: LocalPart = JSON.parse(await fs.readFile(path.join(directory, entry), "utf8"));
      validatePart(part.partNumber, part.size);
      if (part.partNumber !== Number(match[1]) || typeof part.etag !== "string" || !/^\"[a-f0-9]{64}\"$/.test(part.etag) || typeof part.file !== "string" || !/^[0-9a-f-]{36}\.part$/.test(part.file)) {
        throw new Error("Invalid local multipart metadata");
      }
      const stats = await fs.stat(path.join(directory, part.file));
      if (!stats.isFile() || stats.size !== part.size) {
        throw new Error("Stored multipart part has an unexpected size");
      }
      parts.push({ ...part, size: stats.size });
    }
    return parts.sort((a, b) => a.partNumber - b.partNumber);
  }

  async createMultipartUpload(key: string, contentType: string): Promise<string> {
    this.multipartFilePath(key);
    const uploadId = randomUUID();
    const directory = this.uploadDirectory(uploadId);
    await fs.mkdir(directory, { recursive: true });
    try {
      await fs.writeFile(path.join(directory, "upload.json"), JSON.stringify({ key, contentType }), { flag: "wx" });
      return uploadId;
    } catch (error) {
      await fs.rm(directory, { recursive: true, force: true });
      throw error;
    }
  }

  async uploadPart(key: string, uploadId: string, partNumber: number, body: UploadBody, size: number): Promise<MultipartPart> {
    validatePart(partNumber, size);
    const directory = await this.getUploadDirectory(key, uploadId);
    const attemptId = randomUUID();
    const temporary = path.join(directory, `${attemptId}.tmp`);
    const file = `${attemptId}.part`;
    const partPath = path.join(directory, file);
    const manifestTemporary = path.join(directory, `${attemptId}.json.tmp`);
    const hash = createHash("sha256");
    let actualSize = 0;
    const validate = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        actualSize += chunk.length;
        if (actualSize > size) return callback(new Error("Uploaded part exceeds its declared size"));
        hash.update(chunk);
        callback(null, chunk);
      },
      flush(callback) {
        callback(actualSize === size ? undefined : new Error("Uploaded part is shorter than its declared size"));
      },
    });
    try {
      await pipeline(nodeUploadBody(body), validate, createWriteStream(temporary, { flags: "wx" }));
      await fs.rename(temporary, partPath);
      const part = { partNumber, etag: `"${hash.digest("hex")}"`, size: actualSize };
      await fs.writeFile(manifestTemporary, JSON.stringify({ ...part, file }), { flag: "wx" });
      // Readers see either the previous complete part or this complete retry.
      // Keep previous immutable versions until completion so an in-flight
      // finalization can safely finish reading its selected parts.
      await fs.rename(manifestTemporary, path.join(directory, `${partNumber}.json`));
      return part;
    } catch (error) {
      await Promise.all([
        fs.rm(temporary, { force: true }),
        fs.rm(partPath, { force: true }),
        fs.rm(manifestTemporary, { force: true }),
      ]);
      throw error;
    }
  }

  async listParts(key: string, uploadId: string): Promise<MultipartPart[]> {
    const directory = await this.getUploadDirectory(key, uploadId);
    return (await this.readParts(directory)).map(({ partNumber, etag, size }) => ({ partNumber, etag, size }));
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: MultipartPart[], _contentType: string): Promise<void> {
    void _contentType;
    const directory = await this.getUploadDirectory(key, uploadId);
    const actual = await this.readParts(directory);
    const requested = [...parts].sort((a, b) => a.partNumber - b.partNumber);
    if (actual.length !== requested.length || actual.some((part, index) => {
      const expected = requested[index];
      return part.partNumber !== index + 1 || part.partNumber !== expected.partNumber || part.etag !== expected.etag || part.size !== expected.size;
    })) {
      throw new Error("Multipart upload is incomplete or has changed; retry completion");
    }

    const filePath = this.multipartFilePath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${randomUUID()}.tmp`);
    async function* assembledParts() {
      for (const part of actual) {
        for await (const chunk of createReadStream(path.join(directory, part.file))) {
          yield chunk;
        }
      }
    }
    try {
      await pipeline(Readable.from(assembledParts()), createWriteStream(temporary, { flags: "wx" }));
      await fs.rename(temporary, filePath);
    } catch (error) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
    await fs.rm(directory, { recursive: true, force: true });
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    let directory: string;
    try {
      directory = await this.getUploadDirectory(key, uploadId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
    await fs.rm(directory, { recursive: true, force: true });
  }
}

export const storage = STORAGE_PROVIDER === "local" ? new LocalProvider() : new S3Provider();

// Legacy compatibility exports
export const uploadStreamToB2 = (key: string, body: any, contentType: string) => storage.uploadStream(key, body, contentType);
export const uploadFileToB2 = (key: string, body: any, contentType: string, size: number) => storage.uploadFile(key, body, contentType, size);
export const getFileFromB2 = (key: string, range?: string) => storage.getFile(key, range);
export const deleteFileFromB2 = (key: string) => storage.deleteFile(key);
export const getPresignedUrl = (key: string, expiresIn?: number) => storage.getPresignedUrl(key, expiresIn);
export const getFileHead = (key: string) => storage.getFileHead(key);

/**
 * Helper to convert any storage body (S3 stream/web stream/fs stream) to a Buffer.
 * Useful for unzipping or legacy libraries.
 */
export async function bodyToBuffer(body: any): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);

  // S3 SDK v3 Body (StreamingBlobPayloadOutputTypes) has transformToByteArray
  if (typeof body.transformToByteArray === "function") {
    const uint8Array = await body.transformToByteArray();
    return Buffer.from(uint8Array);
  }

  // Handle NodeJS Readable Stream or PassThrough
  if (typeof body.pipe === "function" && typeof body._read === "function") {
    const chunks: any[] = [];
    for await (const chunk of body) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
  }

  // Handle Web ReadableStream
  if (typeof body.getReader === "function") {
    const reader = (body as ReadableStream).getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return Buffer.from(new Uint8Array(new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0))));
  }

  return Buffer.from(body);
}
