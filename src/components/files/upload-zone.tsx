"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Upload, X, FileIcon, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import { MAX_UPLOAD_RETRIES, uploadFile } from "@/lib/upload-client";
import { toast } from "sonner";

interface UploadZoneProps {
  folderId: string | null;
  onUploadComplete: () => void;
}

interface UploadTask {
  id: string;
  file: File;
  folderId: string | null;
}

interface UploadingFile extends UploadTask {
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  retries: number;
}

// Each file sends at most two bounded chunks at once.
const MAX_CONCURRENT_UPLOADS = 2;

export function UploadZone({ folderId, onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadsRef = useRef(0);
  const queueRef = useRef<UploadTask[]>([]);
  const onUploadCompleteRef = useRef(onUploadComplete);

  useEffect(() => {
    onUploadCompleteRef.current = onUploadComplete;
  }, [onUploadComplete]);

  const updateUpload = useCallback((id: string, updates: Partial<UploadingFile>) => {
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updates } : u))
    );
  }, []);

  const uploadSingleFile = useCallback(
    async (task: UploadTask): Promise<boolean> => {
      const { id, file } = task;
      updateUpload(id, { status: "uploading", progress: 0, retries: 0, error: undefined });
      try {
        await uploadFile(file, task.folderId, {
          onProgress: (progress) => updateUpload(id, { progress }),
          onRetry: (retries) => updateUpload(id, { retries }),
        });
        updateUpload(id, { progress: 100, status: "done", retries: 0 });
        toast.success(`Uploaded ${file.name}`);
        return true;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Upload failed";
        updateUpload(id, { status: "error", error: message, retries: 0 });
        toast.error(`Failed to upload ${file.name}: ${message}`);
        return false;
      }
    },
    [updateUpload]
  );

  const processQueue = useCallback(function processQueue() {
    while (queueRef.current.length > 0 && activeUploadsRef.current < MAX_CONCURRENT_UPLOADS) {
      const task = queueRef.current.shift();
      if (!task) continue;

      activeUploadsRef.current++;
      void uploadSingleFile(task).finally(() => {
        activeUploadsRef.current--;
        processQueue();
      });
    }

    // All done
    if (queueRef.current.length === 0 && activeUploadsRef.current === 0) {
      setTimeout(() => {
        onUploadCompleteRef.current();
        setUploads((prev) => prev.filter((u) => u.status !== "done"));
      }, 2000);
    }
  }, [uploadSingleFile]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const tasks = Array.from(files, (file) => ({ id: crypto.randomUUID(), file, folderId }));
      if (tasks.length === 0) return;

      // Add to state
      setUploads((prev) => [
        ...prev,
        ...tasks.map((task) => ({
          ...task,
          progress: 0,
          status: "queued" as const,
          retries: 0,
        })),
      ]);

      // Add to queue and start processing
      queueRef.current.push(...tasks);
      processQueue();
    },
    [folderId, processQueue]
  );

  const retryUpload = useCallback((upload: UploadingFile) => {
    updateUpload(upload.id, { status: "queued", error: undefined, progress: 0, retries: 0 });
    queueRef.current.push({ id: upload.id, file: upload.file, folderId: upload.folderId });
    processQueue();
  }, [processQueue, updateUpload]);

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
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Upload progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
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
                      : upload.status === "queued"
                      ? "Queued"
                      : upload.retries > 0
                      ? `Retry ${upload.retries}/${MAX_UPLOAD_RETRIES}`
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
                <>
                  <AlertCircle className="h-3 w-3 text-red-400" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label={`Retry upload of ${upload.file.name}`}
                    onClick={() => retryUpload(upload)}
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    aria-label={`Dismiss failed upload of ${upload.file.name}`}
                    onClick={() => setUploads((prev) => prev.filter((item) => item.id !== upload.id))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
