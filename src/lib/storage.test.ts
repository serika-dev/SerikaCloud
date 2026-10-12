import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import { LocalProvider } from "./storage";

async function withStorage(run: (storage: LocalProvider, directory: string) => Promise<void>) {
  const directory = await mkdtemp(path.join(tmpdir(), "serika-multipart-"));
  try {
    await run(new LocalProvider(directory), directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("local multipart reassembles out-of-order parts and uses retried content", async () => {
  await withStorage(async (storage, directory) => {
    const key = "users/test-user/example.txt";
    const uploadId = await storage.createMultipartUpload(key, "text/plain");
    await storage.uploadPart(key, uploadId, 2, Buffer.from("world"), 5);
    await storage.uploadPart(key, uploadId, 1, Readable.from(["Wrong "]), 6);
    await storage.uploadPart(key, uploadId, 1, new Response("Hello ").body!, 6);
    const parts = await storage.listParts(key, uploadId);
    assert.deepEqual(parts.map((part) => [part.partNumber, part.size]), [[1, 6], [2, 5]]);
    await assert.rejects(stat(path.join(directory, key)), { code: "ENOENT" });

    await storage.completeMultipartUpload(key, uploadId, [...parts].reverse(), "text/plain");
    assert.equal(await readFile(path.join(directory, key), "utf8"), "Hello world");
    assert.deepEqual(await storage.getFileHead(key), { contentLength: 11 });
    assert.deepEqual(await readdir(path.join(directory, ".uploads")), []);
    assert.deepEqual(await readdir(path.dirname(path.join(directory, key))), ["example.txt"]);

    await storage.abortMultipartUpload(key, uploadId);
    await storage.deleteFile(key);
    await assert.rejects(stat(path.join(directory, key)), { code: "ENOENT" });
  });
});

test("local multipart rejects short and oversized bodies without replacing a good part", async () => {
  await withStorage(async (storage, directory) => {
    const key = "users/test-user/complete.txt";
    const uploadId = await storage.createMultipartUpload(key, "text/plain");
    const original = await storage.uploadPart(key, uploadId, 1, Readable.from(["good"]), 4);
    await assert.rejects(storage.uploadPart(key, uploadId, 1, Readable.from(["short"]), 6), /shorter/);
    await assert.rejects(storage.uploadPart(key, uploadId, 2, Readable.from(["oversized"]), 3), /exceeds/);
    assert.deepEqual(await storage.listParts(key, uploadId), [original]);
    const staging = await readdir(path.join(directory, ".uploads", uploadId));
    assert.equal(staging.filter((entry) => entry.endsWith(".part")).length, 1);
    assert.equal(staging.some((entry) => entry.endsWith(".tmp")), false);

    await storage.abortMultipartUpload(key, uploadId);
    assert.deepEqual(await readdir(path.join(directory, ".uploads")), []);
    await assert.rejects(stat(path.join(directory, key)), { code: "ENOENT" });
  });
});

test("local multipart refuses missing or changed parts and preserves existing files", async () => {
  await withStorage(async (storage, directory) => {
    const key = "users/test-user/file.txt";
    await storage.uploadFile(key, Buffer.from("previous"), "text/plain", 8);
    const uploadId = await storage.createMultipartUpload(key, "text/plain");
    const second = await storage.uploadPart(key, uploadId, 2, Readable.from(["world"]), 5);
    await assert.rejects(storage.completeMultipartUpload(key, uploadId, [second], "text/plain"), /incomplete/);
    await storage.uploadPart(key, uploadId, 1, Readable.from(["Hello "]), 6);
    const beforeRetry = await storage.listParts(key, uploadId);
    await storage.uploadPart(key, uploadId, 1, Readable.from(["Other "]), 6);
    await assert.rejects(storage.completeMultipartUpload(key, uploadId, beforeRetry, "text/plain"), /changed/);
    assert.equal(await readFile(path.join(directory, key), "utf8"), "previous");
    await storage.abortMultipartUpload(key, uploadId);
  });
});

test("local multipart validates upload ownership, paths, and part numbers", async () => {
  await withStorage(async (storage) => {
    const key = "users/test-user/file.txt";
    const uploadId = await storage.createMultipartUpload(key, "text/plain");
    await assert.rejects(storage.listParts("users/another-user/file.txt", uploadId), /does not belong/);
    await assert.rejects(storage.abortMultipartUpload("users/another-user/file.txt", uploadId), /does not belong/);
    await assert.rejects(storage.listParts(key, "../../outside"), /Invalid multipart upload ID/);
    await assert.rejects(storage.createMultipartUpload("../outside", "text/plain"), /Invalid multipart storage key/);
    await assert.rejects(storage.createMultipartUpload(".uploads/metadata", "text/plain"), /Invalid multipart storage key/);
    await assert.rejects(storage.uploadPart(key, uploadId, 0, Readable.from([]), 0), /part number/);
    await assert.rejects(storage.uploadPart(key, uploadId, 10001, Readable.from([]), 0), /part number/);
    await storage.abortMultipartUpload(key, uploadId);
  });
});

test("local multipart supports empty files", async () => {
  await withStorage(async (storage, directory) => {
    const key = "users/test-user/empty.txt";
    const uploadId = await storage.createMultipartUpload(key, "text/plain");
    const part = await storage.uploadPart(key, uploadId, 1, Readable.from([]), 0);
    await storage.completeMultipartUpload(key, uploadId, [part], "text/plain");
    assert.equal((await readFile(path.join(directory, key))).length, 0);
    assert.deepEqual(await readdir(path.join(directory, ".uploads")), []);
  });
});
