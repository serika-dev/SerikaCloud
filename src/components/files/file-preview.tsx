"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { isPreviewable } from "@/lib/utils";
import dynamic from "next/dynamic";
import { AudioPlayer } from "./audio-player";

const VideoPlayer = dynamic(
  () => import("serika-dev-player").then((mod) => mod.VideoPlayer),
  { ssr: false }
);

interface FilePreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
  } | null;
}

export function FilePreview({ open, onOpenChange, file }: FilePreviewProps) {
  const [activeFile, setActiveFile] = React.useState(file);
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    if (file) {
      setActiveFile(file);
    }
  }, [file]);

  const displayFile = file || activeFile;

  if (!displayFile) return null;

  const previewUrl = `/api/files/${displayFile.id}/${encodeURIComponent(displayFile.name)}`;
  const canPreview = isPreviewable(displayFile.mimeType);

  const renderPreview = () => {
    if (!canPreview) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <p className="text-sm">Preview not available for this file type</p>
          <p className="text-xs mt-1">{displayFile.mimeType}</p>
        </div>
      );
    }

    if (displayFile.mimeType.startsWith("image/")) {
      return (
        <div className="flex items-center justify-center max-h-[70vh] overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={displayFile.name}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
          />
        </div>
      );
    }

    if (isClient && displayFile.mimeType.startsWith("video/")) {
      return (
        <div className="w-full aspect-video rounded-lg overflow-hidden bg-black/40 border border-white/5">
          <VideoPlayer
            src={previewUrl}
            width="100%"
            height="100%"
            autoPlay={true}
            muted={false}
            controls={true}
          />
        </div>
      );
    }

    if (isClient && displayFile.mimeType.startsWith("audio/")) {
      return <AudioPlayer src={previewUrl} name={displayFile.name} />;
    }

    if (displayFile.mimeType === "application/pdf") {
      return (
        <iframe
          src={previewUrl}
          className="w-full h-[70vh] rounded-lg border"
          title={displayFile.name}
        />
      );
    }

    if (displayFile.mimeType.startsWith("text/") || displayFile.mimeType === "application/json") {
      return (
        <iframe
          src={previewUrl}
          className="w-full h-[70vh] rounded-lg border bg-muted font-mono"
          title={displayFile.name}
        />
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-hidden p-0 bg-[#0a0a0c]/95 backdrop-blur-xl border-white/10 shadow-2xl rounded-2xl flex flex-col">
        <DialogHeader className="p-4 flex flex-row items-center justify-between border-b border-white/5 pr-12 shrink-0">
          <DialogTitle className="text-sm font-semibold text-white/90 truncate max-w-[70%]">
            {displayFile.name}
          </DialogTitle>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="h-8 bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all gap-2 px-3"
              onClick={() => {
                const a = document.createElement("a");
                a.href = previewUrl;
                a.download = displayFile.name;
                a.click();
              }}
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Download</span>
            </Button>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center min-h-[40vh]">
          <div className="w-full max-w-full">
            {renderPreview()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
