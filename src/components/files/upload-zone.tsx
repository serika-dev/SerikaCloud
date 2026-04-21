"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, FileIcon, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import { toast } from "sonner";

interface UploadZoneProps {
  folderId: string | null;
  onUploadComplete: () => void;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  retries: number;
}

// Upload config
const MAX_CONCURRENT_UPLOADS = 4; // Upload 4 files at once
const MAX_RETRIES = 3;
const UPLOAD_TIMEOUT = 300000; // 5 minute timeout for large files

export function UploadZone({ folderId, onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadsRef = useRef(0);
  const queueRef = useRef<File[]>([]);

  const updateUpload = useCallback((file: File, updates: Partial<UploadingFile>) => {
    setUploads((prev) =>
      prev.map((u) => (u.file === file ? { ...u, ...updates } : u))
    );
  }, []);

  const uploadSingleFile = useCallback(
    async (file: File, attempt = 0): Promise<boolean> => {
      try {
        const xhr = new XMLHttpRequest();

        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              updateUpload(file, { progress: pct });
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              updateUpload(file, { progress: 100, status: "done" });
              resolve();
            } else {
              let errorMsg = "Upload failed";
              try {
                const resp = JSON.parse(xhr.responseText);
                errorMsg = resp.error || errorMsg;
              } catch {}
              reject(new Error(errorMsg));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Network error")));
          xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));
          xhr.addEventListener("timeout", () => reject(new Error("Upload timeout")));

          xhr.open("POST", "/api/files/upload");
          xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
          if (folderId) xhr.setRequestHeader("X-Folder-Id", folderId);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.timeout = UPLOAD_TIMEOUT;
          xhr.send(file);
        });

        toast.success(`Uploaded ${file.name}`);
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Upload failed";

        if (attempt < MAX_RETRIES) {
          updateUpload(file, { retries: attempt + 1 });
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          return uploadSingleFile(file, attempt + 1);
        }

        updateUpload(file, { status: "error", error: message });
        toast.error(`Failed to upload ${file.name}: ${message}`);
        return false;
      }
    },
    [folderId, updateUpload]
  );

  const processQueue = useCallback(async () => {
    while (queueRef.current.length > 0 && activeUploadsRef.current < MAX_CONCURRENT_UPLOADS) {
      const file = queueRef.current.shift();
      if (!file) continue;

      activeUploadsRef.current++;
      uploadSingleFile(file).finally(() => {
        activeUploadsRef.current--;
        processQueue();
      });
    }

    // All done
    if (queueRef.current.length === 0 && activeUploadsRef.current === 0) {
      setTimeout(() => {
        onUploadComplete();
        setUploads((prev) => prev.filter((u) => u.status !== "done"));
      }, 2000);
    }
  }, [uploadSingleFile, onUploadComplete]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // Add to state
      setUploads((prev) => [
        ...prev,
        ...fileArray.map((file) => ({
          file,
          progress: 0,
          status: "uploading" as const,
          retries: 0,
        })),
      ]);

      // Add to queue and start processing
      queueRef.current.push(...fileArray);
      processQueue();
    },
    [processQueue]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
          px-6 py-10 text-center cursor-pointer transition-all duration-200
          ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.02]"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
          }
        `}
      >
        <div
          className={`rounded-full p-3 transition-colors ${
            isDragging ? "bg-primary/10" : "bg-muted"
          }`}
        >
          <Upload className={`h-6 w-6 ${isDragging ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <div>
          <p className="text-sm font-medium">
            {isDragging ? "Drop files here" : "Drag & drop files here"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            or click to browse
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                upload.status === "error" ? "bg-red-500/10" : "bg-muted/50"
              }`}
            >
              <FileIcon className={`h-4 w-4 shrink-0 ${
                upload.status === "error" ? "text-red-400" : "text-muted-foreground"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate flex items-center gap-1">
                  {upload.file.name}
                  <span className="text-[10px] text-muted-foreground">
                    ({formatBytes(upload.file.size)})
                  </span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress 
                    value={upload.progress} 
                    className={`h-1 flex-1 ${upload.status === "error" ? "bg-red-200" : ""}`}
                  />
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {upload.status === "done"
                      ? "✓"
                      : upload.status === "error"
                      ? "✗"
                      : upload.retries > 0
                      ? `Retry ${upload.retries}/${MAX_RETRIES}`
                      : `${upload.progress}%`}
                  </span>
                </div>
                {upload.status === "error" && upload.error && (
                  <p className="text-[10px] text-red-400 mt-0.5">{upload.error}</p>
                )}
              </div>
              {upload.status === "uploading" && upload.retries === 0 && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
              {upload.status === "uploading" && upload.retries > 0 && (
                <RotateCcw className="h-3 w-3 animate-spin text-amber-400" />
              )}
              {upload.status === "error" && (
                <AlertCircle className="h-3 w-3 text-red-400" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
