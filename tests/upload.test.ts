// Bun supplies its test runner at runtime; the app does not require Bun-specific types.
// @ts-expect-error bun:test is supplied by the Bun test runtime.
import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

type FileRecord = {
  id: string;
  name: string;
  mimeType: string;
  size: bigint;
  b2Key: string;
  folderId: string | null;
  userId: string;
  createdAt: Date;
};
type Part = { partNumber: number; etag: string; size: number };

let userId: string | null = "user-1";
let userExists = true;
let folderExists = true;
let storageUsed = BigInt(0);
let storageLimit = BigInt(15 * 1024 ** 3);
let existingFileBytes = BigInt(0);
let nextUploadId = 0;
let transactionTail = Promise.resolve();
const files = new Map<string, FileRecord>();
const multipart = new Map<string, Part[]>();
const objects = new Map<string, number>();

const auth = mock(async () => userId ? { user: { id: userId } } : null);
const storage = {
  createMultipartUpload: mock(async () => {
    const id = `upload-${++nextUploadId}`;
    multipart.set(id, []);
    return id;
  }),
  uploadPart: mock(async (_key: string, id: string, partNumber: number, _body: unknown, size: number) => {
    const part = { partNumber, etag: `etag-${partNumber}`, size };
    multipart.set(id, [...(multipart.get(id) || []).filter((p) => p.partNumber !== partNumber), part]);
    return part;
  }),
  listParts: mock(async (_key: string, id: string) => multipart.get(id) || []),
  completeMultipartUpload: mock(async (key: string, _id: string, parts: Part[]) => {
    objects.set(key, parts.reduce((sum, part) => sum + part.size, 0));
  }),
  abortMultipartUpload: mock(async (_key: string, id: string) => { multipart.delete(id); }),
  getFileHead: mock(async (key: string) => {
    if (!objects.has(key)) throw Object.assign(new Error("Not found"), { code: "ENOENT", name: "NotFound", $metadata: { httpStatusCode: 404 } });
    return { contentLength: objects.get(key) };
  }),
  deleteFile: mock(async (key: string) => { objects.delete(key); }),
  uploadFile: mock(async (key: string, body: Uint8Array) => { objects.set(key, body.byteLength); }),
  uploadStream: mock(async (key: string, body: ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>) => {
    let size = 0;
    if ("getReader" in body) {
      const reader = body.getReader();
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        size += result.value.byteLength;
      }
    } else {
      for await (const chunk of body) size += chunk.byteLength;
    }
    objects.set(key, size);
  }),
};

const database = {
  user: {
    findUnique: mock(async () => userExists ? { id: userId, storageUsed, storageLimit } : null),
    update: mock(async (args: { data: { storageUsed: bigint | { increment?: bigint; decrement?: bigint } } }) => {
      const value = args.data.storageUsed;
      storageUsed = typeof value === "bigint" ? value : storageUsed + (value.increment || BigInt(0)) - (value.decrement || BigInt(0));
      return { id: userId, storageUsed, storageLimit };
    }),
    updateMany: mock(async (args: { where?: { storageUsed?: { lte?: bigint } }; data: { storageUsed: { increment: bigint } } }) => {
      const maximum = args.where?.storageUsed?.lte;
      if (!userExists || (maximum !== undefined && storageUsed > maximum)) return { count: 0 };
      storageUsed += args.data.storageUsed.increment;
      return { count: 1 };
    }),
  },
  folder: {
    findFirst: mock(async () => folderExists ? { id: "folder-1", userId } : null),
  },
  file: {
    aggregate: mock(async () => ({ _sum: { size: [...files.values()].reduce((sum, file) => sum + file.size, existingFileBytes) } })),
    findUnique: mock(async (args: { where: { b2Key: string } }) => files.get(args.where.b2Key) || null),
    findFirst: mock(async (args: { where: { b2Key: string } }) => files.get(args.where.b2Key) || null),
    create: mock(async (args: { data: Omit<FileRecord, "id" | "createdAt"> }) => {
      if (files.has(args.data.b2Key)) throw Object.assign(new Error("Duplicate key"), { code: "P2002" });
      const file = { ...args.data, id: `file-${files.size + 1}`, createdAt: new Date() };
      files.set(file.b2Key, file);
      return file;
    }),
  },
  $queryRaw: mock(async () => [{ id: userId, storageUsed, storageLimit }]),
  $executeRaw: mock(async () => 1),
};
const prisma = {
  ...database,
  // Emulate serialized transactions and rollback without a real database.
  $transaction: async <T>(run: (tx: typeof database) => Promise<T>): Promise<T> => {
    const previous = transactionTail;
    let unlock!: () => void;
    transactionTail = new Promise<void>((resolve) => { unlock = resolve; });
    await previous;
    const previousUsed = storageUsed;
    const previousFiles = new Map(files);
    try {
      return await run(database);
    } catch (error) {
      storageUsed = previousUsed;
      files.clear();
      for (const [key, file] of previousFiles) files.set(key, file);
      throw error;
    } finally {
      unlock();
    }
  },
};

process.env.AUTH_SECRET = "upload-regression-tests-only-secret";
process.env.NEXTAUTH_SECRET = process.env.AUTH_SECRET;
mock.module("../src/lib/auth", () => ({ auth }));
mock.module("../src/lib/db", () => ({ prisma }));
mock.module("../src/lib/storage", () => ({
  storage,
  uploadStreamToB2: storage.uploadStream,
  uploadFileToB2: storage.uploadFile,
  getFileHead: storage.getFileHead,
  deleteFileFromB2: storage.deleteFile,
}));

const { POST: initialize } = await import("../src/app/api/files/upload/init/route");
const { PUT: uploadPart } = await import("../src/app/api/files/upload/part/route");
const { POST: complete } = await import("../src/app/api/files/upload/complete/route");
const { DELETE: abort } = await import("../src/app/api/files/upload/abort/route");
const { POST: legacyUpload } = await import("../src/app/api/files/upload/route");

function jsonRequest(path: string, body: unknown, method = "POST") {
  return new Request(`http://localhost/api/files/upload/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function initUpload(size = 3, name = "document.txt") {
  const response = await initialize(jsonRequest("init", { name, size, type: "application/octet-stream" }));
  expect(response.status).toBe(201);
  return await response.json() as { token: string; chunkSize: number };
}

function partRequest(token: string, partNumber: number | string, bytes: Uint8Array, contentLength?: number) {
  const headers = new Headers({ "X-Upload-Token": token, "X-Part-Number": String(partNumber) });
  if (contentLength !== undefined) headers.set("Content-Length", String(contentLength));
  return new Request("http://localhost/api/files/upload/part", {
    method: "PUT", headers, body: new Blob([bytes as Uint8Array<ArrayBuffer>]),
  });
}

async function uploadSmallFile(token: string) {
  const response = await uploadPart(partRequest(token, 1, new Uint8Array([1, 2, 3])));
  expect(response.status).toBe(200);
}

beforeEach(() => {
  userId = "user-1";
  userExists = true;
  folderExists = true;
  storageUsed = BigInt(0);
  storageLimit = BigInt(15 * 1024 ** 3);
  existingFileBytes = BigInt(0);
  nextUploadId = 0;
  transactionTail = Promise.resolve();
  files.clear();
  multipart.clear();
  objects.clear();
  for (const operation of Object.values(storage)) operation.mockClear();
  for (const model of [prisma.user, prisma.folder, prisma.file]) {
    for (const operation of Object.values(model)) operation.mockClear();
  }
  prisma.$queryRaw.mockClear();
});

describe("upload initialization", () => {
  test("requires authentication before allocating storage", async () => {
    userId = null;
    const response = await initialize(jsonRequest("init", { name: "x.txt", size: 3 }));
    expect(response.status).toBe(401);
    expect(storage.createMultipartUpload).not.toHaveBeenCalled();
  });

  test("accepts a 5.50 GB upload while keeping individual requests below common proxy limits", async () => {
    const upload = await initUpload(Math.round(5.5 * 1024 ** 3), "large-video.mp4");
    expect(upload.token).toBeString();
    expect(upload.chunkSize).toBeGreaterThanOrEqual(5 * 1024 ** 2);
    expect(upload.chunkSize).toBeLessThan(100 * 1024 ** 2);
    expect(storage.createMultipartUpload).toHaveBeenCalledTimes(1);
  });

  test("rejects an upload exceeding remaining quota before allocating storage", async () => {
    storageLimit = BigInt(5);
    storageUsed = BigInt(3);
    existingFileBytes = BigInt(3);
    const response = await initialize(jsonRequest("init", { name: "x.txt", size: 3 }));
    expect(response.status).toBe(413);
    expect(storage.createMultipartUpload).not.toHaveBeenCalled();
  });

  test("uses actual file totals when the cached storage counter is stale", async () => {
    storageLimit = BigInt(5);
    storageUsed = BigInt(100);
    existingFileBytes = BigInt(0);
    await initUpload();
    expect(storage.createMultipartUpload).toHaveBeenCalledTimes(1);
  });

  test("rejects a folder owned by another user", async () => {
    folderExists = false;
    const response = await initialize(jsonRequest("init", { name: "x.txt", size: 3, folderId: "foreign-folder" }));
    expect(response.status).toBe(404);
    expect(prisma.folder.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "foreign-folder", userId: "user-1" } }));
    expect(storage.createMultipartUpload).not.toHaveBeenCalled();
  });

  test.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1, "3"])("rejects invalid declared size %p", async (size: unknown) => {
    const response = await initialize(jsonRequest("init", { name: "x.txt", size }));
    expect(response.status).toBe(400);
    expect(storage.createMultipartUpload).not.toHaveBeenCalled();
  });
});

describe("signed upload authorization", () => {
  test("does not allow another authenticated user to reuse an upload token", async () => {
    const { token } = await initUpload();
    userId = "user-2";
    const response = await uploadPart(partRequest(token, 1, new Uint8Array([1, 2, 3])));
    expect([400, 401, 403]).toContain(response.status);
    expect(storage.uploadPart).not.toHaveBeenCalled();
  });

  test("rejects a modified token", async () => {
    const { token } = await initUpload();
    const first = token[0] === "a" ? "b" : "a";
    const response = await uploadPart(partRequest(first + token.slice(1), 1, new Uint8Array([1, 2, 3])));
    expect([400, 401, 403]).toContain(response.status);
    expect(storage.uploadPart).not.toHaveBeenCalled();
  });

  test("rejects an expired token", async () => {
    const { token } = await initUpload();
    const clock = spyOn(Date, "now").mockReturnValue(Date.now() + 365 * 24 * 60 * 60 * 1000);
    try {
      const response = await uploadPart(partRequest(token, 1, new Uint8Array([1, 2, 3])));
      expect([400, 401, 403, 410]).toContain(response.status);
      expect(storage.uploadPart).not.toHaveBeenCalled();
    } finally {
      clock.mockRestore();
    }
  });
});

describe("upload parts", () => {
  test("accepts the final chunk without Content-Length", async () => {
    const { token } = await initUpload();
    await uploadSmallFile(token);
    expect(storage.uploadPart).toHaveBeenCalledTimes(1);
  });

  test.each([0, -1, 2, "1.5", "abc"])("rejects out-of-range or invalid part number %p", async (partNumber: number | string) => {
    const { token } = await initUpload();
    const response = await uploadPart(partRequest(token, partNumber, new Uint8Array([1, 2, 3])));
    expect(response.status).toBe(400);
    expect(storage.uploadPart).not.toHaveBeenCalled();
  });

  test("rejects a short request body", async () => {
    const { token } = await initUpload();
    const response = await uploadPart(partRequest(token, 1, new Uint8Array([1, 2])));
    expect(response.status).toBe(400);
    expect(storage.uploadPart).not.toHaveBeenCalled();
  });

  test("rejects extra bytes even when Content-Length claims the expected length", async () => {
    const { token } = await initUpload();
    const response = await uploadPart(partRequest(token, 1, new Uint8Array([1, 2, 3, 4]), 3));
    expect([400, 413]).toContain(response.status);
    expect(storage.uploadPart).not.toHaveBeenCalled();
  });
});

describe("upload completion and cancellation", () => {
  test("does not create a file or charge quota when chunks are missing", async () => {
    const { token } = await initUpload();
    const response = await complete(jsonRequest("complete", { token }));
    expect([400, 409]).toContain(response.status);
    expect(files.size).toBe(0);
    expect(storageUsed).toBe(BigInt(0));
    expect(storage.completeMultipartUpload).not.toHaveBeenCalled();
  });

  test("stores correct metadata and numeric JSON size and charges quota once", async () => {
    const { token } = await initUpload();
    await uploadSmallFile(token);
    const response = await complete(jsonRequest("complete", { token }));
    expect(response.status).toBe(201);
    const file = await response.json();
    expect(file.name).toBe("document.txt");
    expect(file.mimeType).toBe("text/plain");
    expect(file.size).toBe(3);
    expect(storageUsed).toBe(BigInt(3));
    expect(files.size).toBe(1);
    expect([...files.values()][0].size).toBe(BigInt(3));
  });

  test("retrying completion returns the same file without double charging quota", async () => {
    const { token } = await initUpload();
    await uploadSmallFile(token);
    const firstResponse = await complete(jsonRequest("complete", { token }));
    const first = await firstResponse.json();
    const secondResponse = await complete(jsonRequest("complete", { token }));
    const second = await secondResponse.json();
    expect([200, 201]).toContain(secondResponse.status);
    expect(second.id).toBe(first.id);
    expect(files.size).toBe(1);
    expect(storageUsed).toBe(BigInt(3));
    expect(storage.completeMultipartUpload).toHaveBeenCalledTimes(1);
  });

  test("does not record a stored object whose actual size differs from the declared size", async () => {
    const { token } = await initUpload();
    await uploadSmallFile(token);
    storage.completeMultipartUpload.mockImplementationOnce(async (key: string) => { objects.set(key, 2); });
    const response = await complete(jsonRequest("complete", { token }));
    expect(response.status).toBe(409);
    expect(files.size).toBe(0);
    expect(storageUsed).toBe(BigInt(0));
  });

  test("recovers a completed storage object when the previous database transaction failed", async () => {
    const { token } = await initUpload();
    await uploadSmallFile(token);
    prisma.file.create.mockImplementationOnce(async () => { throw new Error("Temporary database failure"); });
    const errorLog = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const first = await complete(jsonRequest("complete", { token }));
      expect(first.status).toBe(500);
      expect(files.size).toBe(0);
      expect(storageUsed).toBe(BigInt(0));
      expect(objects.size).toBe(1);
      const retry = await complete(jsonRequest("complete", { token }));
      expect(retry.status).toBe(201);
      expect((await retry.json()).size).toBe(3);
      expect(storageUsed).toBe(BigInt(3));
      expect(storage.completeMultipartUpload).toHaveBeenCalledTimes(1);
    } finally {
      errorLog.mockRestore();
    }
  });

  test("rechecks quota when another upload has consumed the available space", async () => {
    storageLimit = BigInt(5);
    const { token } = await initUpload();
    await uploadSmallFile(token);
    storageUsed = BigInt(4);
    existingFileBytes = BigInt(4);
    const response = await complete(jsonRequest("complete", { token }));
    expect(response.status).toBe(413);
    expect(files.size).toBe(0);
    expect(storageUsed).toBe(BigInt(4));
  });

  test("simultaneous completions cannot both consume the same remaining quota", async () => {
    storageLimit = BigInt(5);
    const first = await initUpload();
    const second = await initUpload();
    await uploadSmallFile(first.token);
    await uploadSmallFile(second.token);
    const responses = await Promise.all([
      complete(jsonRequest("complete", { token: first.token })),
      complete(jsonRequest("complete", { token: second.token })),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 413]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(files.size).toBe(1);
    expect(storageUsed).toBe(BigInt(3));
  });

  test("cancellation removes pending parts without charging quota", async () => {
    const { token } = await initUpload();
    await uploadSmallFile(token);
    const response = await abort(jsonRequest("abort", { token }, "DELETE"));
    expect([200, 204]).toContain(response.status);
    expect(storage.abortMultipartUpload).toHaveBeenCalledTimes(1);
    expect(multipart.size).toBe(0);
    expect(files.size).toBe(0);
    expect(storageUsed).toBe(BigInt(0));
  });

  test("a delayed cancellation cannot delete a file that already completed", async () => {
    const { token } = await initUpload();
    await uploadSmallFile(token);
    expect((await complete(jsonRequest("complete", { token }))).status).toBe(201);
    expect((await abort(jsonRequest("abort", { token }, "DELETE"))).status).toBe(200);
    expect(storage.abortMultipartUpload).not.toHaveBeenCalled();
    expect(storage.deleteFile).not.toHaveBeenCalled();
    expect(files.size).toBe(1);
    expect(objects.size).toBe(1);
  });
});

describe("single-request compatibility", () => {
  test("creates zero-byte files", async () => {
    const response = await legacyUpload(new Request("http://localhost/api/files/upload", {
      method: "POST", headers: { "X-File-Name": "empty.txt", "X-File-Size": "0" },
    }));
    expect(response.status).toBe(201);
    expect((await response.json()).size).toBe(0);
    expect(files.size).toBe(1);
    expect(storageUsed).toBe(BigInt(0));
  });

  test("uses X-File-Size when the proxy omits Content-Length", async () => {
    const response = await legacyUpload(new Request("http://localhost/api/files/upload", {
      method: "POST", headers: { "X-File-Name": "old-client.txt", "X-File-Size": "3" }, body: "abc",
    }));
    expect(response.status).toBe(201);
    expect((await response.json()).size).toBe(3);
    expect(storageUsed).toBe(BigInt(3));
  });

  test("does not silently record a nonempty file as zero bytes when its size is missing", async () => {
    const response = await legacyUpload(new Request("http://localhost/api/files/upload", {
      method: "POST", headers: { "X-File-Name": "old-client.txt" }, body: "abc",
    }));
    expect(response.status).toBe(411);
    expect(files.size).toBe(0);
    expect(storage.uploadStream).not.toHaveBeenCalled();
  });

  test.each(["ab", "abcd"])("rejects a body %p that does not match the declared size", async (body: string) => {
    const response = await legacyUpload(new Request("http://localhost/api/files/upload", {
      method: "POST", headers: { "X-File-Name": "old-client.txt", "X-File-Size": "3" }, body,
    }));
    expect(response.status).toBe(400);
    expect(files.size).toBe(0);
    expect(storageUsed).toBe(BigInt(0));
    expect(storage.deleteFile).toHaveBeenCalledTimes(1);
  });
});
