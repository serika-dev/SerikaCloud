import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import fs from "fs/promises";
import path from "path";
import { createReadStream, createWriteStream } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

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

export interface StorageProvider {
  uploadStream(key: string, body: ReadableStream | NodeJS.ReadableStream, contentType: string): Promise<any>;
  uploadFile(key: string, body: Buffer | Uint8Array, contentType: string, size: number): Promise<any>;
  getFile(key: string, range?: string): Promise<StorageResult>;
  deleteFile(key: string): Promise<any>;
  getPresignedUrl(key: string, expiresIn?: number): Promise<string>;
  getFileHead(key: string): Promise<{ contentLength?: number, contentType?: string }>;
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
}

class LocalProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(LOCAL_STORAGE_PATH);
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
