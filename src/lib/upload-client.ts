export const MAX_UPLOAD_RETRIES = 3;

const UPLOAD_TIMEOUT = 300_000;
const CONCURRENT_PARTS = 2;

interface UploadCallbacks {
  onProgress: (progress: number) => void;
  onRetry: (attempt: number) => void;
}

type JsonObject = Record<string, unknown>;

class UploadError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
    this.name = "UploadError";
  }
}

function errorMessage(status: number): string {
  switch (status) {
    case 401:
      return "Your session has expired. Sign in again to upload files.";
    case 403:
      return "You do not have permission to upload this file.";
    case 404:
      return "The upload destination was not found. Refresh the page and try again.";
    case 413:
      return "The server rejected this upload because it exceeds the request size limit.";
    case 429:
      return "Too many uploads. Please try again in a moment.";
    default:
      return `Upload failed (HTTP ${status}).`;
  }
}

function parseResponse(status: number, text: string): JsonObject {
  let response: JsonObject | undefined;
  try {
    const value: unknown = JSON.parse(text);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      response = value as JsonObject;
    }
  } catch {
    // Reverse proxies can return HTML error pages instead of JSON.
  }

  if (status < 200 || status >= 300) {
    const message = typeof response?.error === "string" ? response.error : errorMessage(status);
    throw new UploadError(message, status === 408 || status === 429 || status >= 500);
  }
  if (!response) {
    throw new UploadError("The server did not confirm this upload. Refresh the page to check your files.");
  }
  return response;
}

async function requestJson(path: string, method: "POST" | "DELETE", body: JsonObject): Promise<JsonObject> {
  let response: Response;
  let text: string;
  // Completion can include a storage operation and a database lock wait. Allow
  // time for both, while still recovering when a response never arrives.
  const timeout = method === "DELETE" ? 10_000 : path.endsWith("/init") ? 30_000 : 300_000;
  try {
    response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    });
    text = await response.text();
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new UploadError("The server took too long to respond. Please try again.", true);
    }
    throw new UploadError("Network error. Check your connection and try again.", true);
  }
  return parseResponse(response.status, text);
}

function waitForRetry(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadError("Upload aborted"));
      return;
    }
    const abort = () => {
      clearTimeout(timer);
      reject(new UploadError("Upload aborted"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

async function withRetry<T>(
  request: () => Promise<T>,
  onRetry: (attempt: number) => void,
  signal?: AbortSignal
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new UploadError("Upload aborted");
    onRetry(attempt);
    try {
      const response = await request();
      onRetry(0);
      return response;
    } catch (error) {
      if (!(error instanceof UploadError) || !error.retryable || attempt >= MAX_UPLOAD_RETRIES || signal?.aborted) {
        throw error;
      }
      onRetry(attempt + 1);
      await waitForRetry(1000 * (attempt + 1), signal);
    }
  }
}

function sendBytes(
  path: string,
  method: "POST" | "PUT",
  body: Blob,
  headers: Record<string, string>,
  onProgress: (loaded: number) => void,
  signal?: AbortSignal
): Promise<JsonObject> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadError("Upload aborted"));
      return;
    }
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const cleanup = () => signal?.removeEventListener("abort", abort);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.min(body.size, event.loaded));
    });
    xhr.addEventListener("load", () => {
      cleanup();
      try {
        resolve(parseResponse(xhr.status, xhr.responseText));
      } catch (error) {
        reject(error);
      }
    });
    xhr.addEventListener("error", () => {
      cleanup();
      reject(new UploadError("Network error. Check your connection and try again.", true));
    });
    xhr.addEventListener("abort", () => {
      cleanup();
      reject(new UploadError("Upload aborted"));
    });
    xhr.addEventListener("timeout", () => {
      cleanup();
      reject(new UploadError("The upload timed out. Please try again.", true));
    });
    xhr.open(method, path);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.timeout = UPLOAD_TIMEOUT;
    signal?.addEventListener("abort", abort, { once: true });
    xhr.send(body);
  });
}

function confirmFile(response: JsonObject): void {
  if (typeof response.id !== "string" || !response.id) {
    throw new UploadError("The server did not confirm this upload. Refresh the page to check your files.");
  }
}

export async function uploadFile(file: File, folderId: string | null, callbacks: UploadCallbacks): Promise<void> {
  callbacks.onProgress(0);
  callbacks.onRetry(0);

  // Multipart object storage requires at least one nonempty part.
  if (file.size === 0) {
    const headers: Record<string, string> = {
      "X-File-Name": encodeURIComponent(file.name),
      "X-File-Size": "0",
      "Content-Type": file.type || "application/octet-stream",
    };
    if (folderId) headers["X-Folder-Id"] = folderId;
    const response = await sendBytes("/api/files/upload", "POST", file, headers, () => {});
    confirmFile(response);
    callbacks.onProgress(100);
    return;
  }

  // Check quota and destination before sending file data. Initialization is not
  // retried automatically because a lost response could leave an orphan session.
  const session = await requestJson("/api/files/upload/init", "POST", {
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    folderId,
  });
  if (typeof session.token !== "string" || !session.token || typeof session.chunkSize !== "number" ||
      !Number.isSafeInteger(session.chunkSize) || session.chunkSize <= 0) {
    throw new UploadError("The server returned an invalid upload session. Refresh the page and try again.");
  }

  const { token, chunkSize } = session;
  const controller = new AbortController();
  const partCount = Math.ceil(file.size / chunkSize);
  const loadedBytes = Array<number>(partCount).fill(0);
  const retries = Array<number>(partCount).fill(0);
  let nextPart = 0;
  const reportProgress = () => {
    const uploaded = loadedBytes.reduce((total, loaded) => total + loaded, 0);
    callbacks.onProgress(Math.min(99, Math.round((uploaded / file.size) * 100)));
  };

  const worker = async () => {
    while (nextPart < partCount && !controller.signal.aborted) {
      const index = nextPart++;
      const body = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
      const part = await withRetry(() => {
        loadedBytes[index] = 0;
        reportProgress();
        return sendBytes("/api/files/upload/part", "PUT", body, {
          "X-Upload-Token": token,
          "X-Part-Number": String(index + 1),
          "Content-Type": "application/octet-stream",
        }, (loaded) => {
          loadedBytes[index] = loaded;
          reportProgress();
        }, controller.signal);
      }, (attempt) => {
        retries[index] = attempt;
        callbacks.onRetry(retries.reduce((highest, retry) => Math.max(highest, retry), 0));
      }, controller.signal);

      if (part.partNumber !== index + 1 || part.size !== body.size) {
        throw new UploadError("The server did not confirm all of the uploaded data. Please try again.");
      }
      loadedBytes[index] = body.size;
      reportProgress();
    }
  };

  const workers = Array.from({ length: Math.min(CONCURRENT_PARTS, partCount) }, () => worker());
  try {
    await Promise.all(workers);
    const response = await withRetry(
      () => requestJson("/api/files/upload/complete", "POST", { token }),
      callbacks.onRetry
    );
    confirmFile(response);
    callbacks.onProgress(100);
  } catch (error) {
    controller.abort();
    await Promise.allSettled(workers);
    // Cleanup is best effort; retain the original failure for the user.
    await requestJson("/api/files/upload/abort", "DELETE", { token }).catch(() => {});
    throw error;
  }
}
