import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { uploadFile } from "./upload-client";

const originalFetch = globalThis.fetch;
const originalXhr = globalThis.XMLHttpRequest;
const originalTimeout = AbortSignal.timeout;

class FakeXhr extends EventTarget {
  static requests: FakeXhr[] = [];
  static handle: (request: FakeXhr, body: Blob) => void | Promise<void>;
  upload = new EventTarget();
  headers: Record<string, string> = {};
  method = "";
  url = "";
  status = 0;
  responseText = "";
  timeout = 0;
  aborted = false;
  body?: Blob;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  send(body: Blob) {
    this.body = body;
    FakeXhr.requests.push(this);
    queueMicrotask(() => void FakeXhr.handle(this, body));
  }

  respond(status: number, data: unknown) {
    if (this.aborted) return;
    this.status = status;
    this.responseText = typeof data === "string" ? data : JSON.stringify(data);
    this.dispatchEvent(new Event("load"));
  }

  progress(loaded: number) {
    const event = new Event("progress");
    Object.defineProperties(event, {
      lengthComputable: { value: true },
      loaded: { value: loaded },
    });
    this.upload.dispatchEvent(event);
  }

  abort() {
    this.aborted = true;
    this.dispatchEvent(new Event("abort"));
  }
}

function setup() {
  FakeXhr.requests = [];
  FakeXhr.handle = (request, body) => {
    request.progress(body.size);
    request.respond(200, { partNumber: Number(request.headers["X-Part-Number"]), size: body.size, etag: "etag" });
  };
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;
  const requests: { path: string; method: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    requests.push({ path, method: init?.method ?? "GET", body: JSON.parse(String(init?.body)) });
    if (path.endsWith("/init")) return Response.json({ token: "upload-token", chunkSize: 3 });
    if (path.endsWith("/complete")) return Response.json({ id: "file-id" }, { status: 201 });
    return Response.json({ ok: true });
  }) as typeof fetch;
  return requests;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.XMLHttpRequest = originalXhr;
  AbortSignal.timeout = originalTimeout;
});

test("sends bounded binary parts and preserves metadata before finalizing", async () => {
  const requests = setup();
  const file = new File([new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7])], "hello.bin", { type: "application/octet-stream" });
  const progress: number[] = [];
  await uploadFile(file, "folder-id", { onProgress: (value) => progress.push(value), onRetry: () => {} });

  assert.deepEqual(requests[0].body, { name: file.name, size: 8, type: file.type, folderId: "folder-id" });
  assert.deepEqual(FakeXhr.requests.map((request) => request.body?.size), [3, 3, 2]);
  assert.deepEqual(await Promise.all(FakeXhr.requests.map(async (request) => Array.from(new Uint8Array(await request.body!.arrayBuffer())))), [
    [0, 1, 2], [3, 4, 5], [6, 7],
  ]);
  assert.deepEqual(FakeXhr.requests.map((request) => request.headers["X-Part-Number"]), ["1", "2", "3"]);
  assert.ok(FakeXhr.requests.every((request) => request.method === "PUT" && request.headers["X-Upload-Token"] === "upload-token"));
  assert.deepEqual(requests[1], { path: "/api/files/upload/complete", method: "POST", body: { token: "upload-token" } });
  assert.ok(progress.slice(0, -1).every((value) => value <= 99));
  assert.equal(progress.at(-1), 100);
});

test("quota failures stop before any file bytes are sent", async () => {
  setup();
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts++;
    return Response.json({ error: "Storage quota exceeded" }, { status: 413 });
  }) as typeof fetch;
  await assert.rejects(uploadFile(new File(["data"], "file.txt"), null, { onProgress: () => {}, onRetry: () => {} }), /Storage quota exceeded/);
  assert.equal(attempts, 1);
  assert.equal(FakeXhr.requests.length, 0);
});

test("does not retry a proxy 413 and aborts parallel work before cleanup", async () => {
  const requests = setup();
  FakeXhr.handle = (request) => {
    if (request.headers["X-Part-Number"] === "1") request.respond(413, "<html>Request entity too large</html>");
  };
  await assert.rejects(uploadFile(new File(["abcdefghi"], "file.txt"), null, { onProgress: () => {}, onRetry: () => {} }), /request size limit/);
  assert.equal(FakeXhr.requests.length, 2);
  assert.equal(FakeXhr.requests[1].aborted, true);
  assert.ok(requests.some((request) => request.path.endsWith("/abort") && request.method === "DELETE"));
  assert.ok(!requests.some((request) => request.path.endsWith("/complete")));
});

test("retries only the failed chunk and reuses its part number", async () => {
  setup();
  let failed = false;
  FakeXhr.handle = (request, body) => {
    if (request.headers["X-Part-Number"] === "1" && !failed) {
      failed = true;
      request.respond(503, { error: "Try again" });
    } else {
      request.respond(200, { partNumber: Number(request.headers["X-Part-Number"]), size: body.size });
    }
  };
  const retries: number[] = [];
  await uploadFile(new File(["abcdef"], "file.txt"), null, { onProgress: () => {}, onRetry: (attempt) => retries.push(attempt) });
  assert.deepEqual(FakeXhr.requests.map((request) => request.headers["X-Part-Number"]), ["1", "2", "1"]);
  assert.ok(retries.includes(1));
});

test("retries finalization with the same token when its response is lost", async () => {
  setup();
  const baseFetch = globalThis.fetch;
  const tokens: unknown[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).endsWith("/complete")) {
      tokens.push(JSON.parse(String(init?.body)).token);
      if (tokens.length === 1) throw new TypeError("Connection lost");
    }
    return baseFetch(input, init);
  }) as typeof fetch;
  await uploadFile(new File(["abc"], "file.txt"), null, { onProgress: () => {}, onRetry: () => {} });
  assert.deepEqual(tokens, ["upload-token", "upload-token"]);
  assert.equal(FakeXhr.requests.length, 1);
});

test("times out a stalled completion and retries without resending file data", async () => {
  setup();
  const baseFetch = globalThis.fetch;
  const deadlines: number[] = [];
  const tokens: unknown[] = [];
  AbortSignal.timeout = (milliseconds) => {
    deadlines.push(milliseconds);
    const controller = new AbortController();
    if (deadlines.length === 2) {
      queueMicrotask(() => controller.abort(new DOMException("Request timed out", "TimeoutError")));
    }
    return controller.signal;
  };
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input).endsWith("/complete")) {
      tokens.push(JSON.parse(String(init?.body)).token);
      if (tokens.length === 1) {
        assert.ok(init?.signal);
        return new Promise<Response>((_resolve, reject) => {
          init.signal!.addEventListener("abort", () => reject(init.signal!.reason), { once: true });
        });
      }
    }
    return baseFetch(input, init);
  }) as typeof fetch;
  await uploadFile(new File(["abc"], "file.txt"), null, { onProgress: () => {}, onRetry: () => {} });
  assert.deepEqual(deadlines, [30_000, 300_000, 300_000]);
  assert.deepEqual(tokens, ["upload-token", "upload-token"]);
  assert.equal(FakeXhr.requests.length, 1);
});

test("empty files use the raw upload route with explicit zero size", async () => {
  const requests = setup();
  FakeXhr.handle = (request) => request.respond(201, { id: "empty-file-id" });
  await uploadFile(new File([], "empty.txt"), "folder-id", { onProgress: () => {}, onRetry: () => {} });
  assert.equal(requests.length, 0);
  assert.equal(FakeXhr.requests[0].url, "/api/files/upload");
  assert.equal(FakeXhr.requests[0].headers["X-File-Size"], "0");
  assert.equal(FakeXhr.requests[0].headers["X-Folder-Id"], "folder-id");
});
