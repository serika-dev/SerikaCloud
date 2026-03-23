import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number | bigint, decimals = 2): string {
  const b = typeof bytes === "bigint" ? Number(bytes) : Number(bytes || 0);
  if (isNaN(b) || b <= 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Get file icon name based on MIME type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "music";
  if (mimeType === "application/pdf") return "file-text";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType === "text/csv"
  )
    return "sheet";
  if (mimeType.includes("document") || mimeType.includes("word"))
    return "file-text";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint"))
    return "presentation";
  if (mimeType.includes("zip") || mimeType.includes("compress") || mimeType.includes("tar"))
    return "archive";
  if (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("xml"))
    return "code";
  return "file";
}

/**
 * Check if a file can be previewed in the browser
 */
export function isPreviewable(mimeType: string): boolean {
  return (
    mimeType.startsWith("image/") ||
    mimeType.startsWith("video/") ||
    mimeType.startsWith("audio/") ||
    mimeType === "application/pdf" ||
    mimeType.startsWith("text/") ||
    mimeType === "application/json"
  );
}

/**
 * Format seconds to M:SS
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Generate a unique B2 key for a file
 */
export function generateB2Key(userId: string, fileName: string): string {
  const timestamp = Date.now();
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `users/${userId}/${timestamp}-${sanitized}`;
}
