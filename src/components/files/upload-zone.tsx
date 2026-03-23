"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, X, FileIcon, Loader2 } from "lucide-react";
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
}

export function UploadZone({ folderId, onUploadComplete }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setUploads((prev) => [
        ...prev,
        { file, progress: 0, status: "uploading" },
      ]);

      try {
        const xhr = new XMLHttpRequest();

        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploads((prev) =>
                prev.map((u) =>
                  u.file === file ? { ...u, progress: pct } : u
                )
              );
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploads((prev) =>
                prev.map((u) =>
                  u.file === file ? { ...u, progress: 100, status: "done" } : u
                )
              );
              resolve();
            } else {
              const resp = JSON.parse(xhr.responseText);
              reject(new Error(resp.error || "Upload failed"));
            }
          });

          xhr.addEventListener("error", () => reject(new Error("Upload failed")));
          xhr.open("POST", "/api/files/upload");
          xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
          if (folderId) {
            xhr.setRequestHeader("X-Folder-Id", folderId);
          }
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.send(file);
        });

        toast.success(`Uploaded ${file.name}`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setUploads((prev) =>
          prev.map((u) =>
            u.file === file ? { ...u, status: "error", error: message } : u
          )
        );
        toast.error(`Failed to upload ${file.name}: ${message}`);
      }
    },
    [folderId]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        await uploadFile(file);
      }
      onUploadComplete();
      // Clean completed uploads after 3 seconds
      setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.status === "uploading"));
      }, 3000);
    },
    [uploadFile, onUploadComplete]
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
              className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2"
            >
              <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{upload.file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={upload.progress} className="h-1 flex-1" />
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {upload.status === "done"
                      ? "✓"
                      : upload.status === "error"
                      ? "✗"
                      : `${upload.progress}%`}
                  </span>
                </div>
              </div>
              {upload.status === "uploading" && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
