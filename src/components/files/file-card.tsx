"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileActions } from "./file-actions";
import { formatBytes, getFileIcon } from "@/lib/utils";
import { format } from "date-fns";
import {
  File,
  Image,
  Video,
  Music,
  FileText,
  Sheet,
  Archive,
  Code,
  Folder,
  Presentation,
} from "lucide-react";
import { AudioMetadata, extractAudioMetadata } from "@/lib/audio-metadata";

const iconMap: Record<string, React.ElementType> = {
  file: File,
  image: Image,
  video: Video,
  music: Music,
  "file-text": FileText,
  sheet: Sheet,
  archive: Archive,
  code: Code,
  presentation: Presentation,
};

interface FileCardProps {
  file: {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    createdAt: string;
  };
  onPreview: () => void;
  onShare: () => void;
  onRefresh: () => void;
}

export function FileCard({ file, onPreview, onShare, onRefresh }: FileCardProps) {
  const iconName = getFileIcon(file.mimeType);
  const IconComponent = iconMap[iconName] || File;

  const isImage = file.mimeType.startsWith("image/");
  const isVideo = file.mimeType.startsWith("video/");
  const isAudio = file.mimeType.startsWith("audio/");
  const [audioMetadata, setAudioMetadata] = React.useState<AudioMetadata | null>(null);
  
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let currentPictureUrl: string | undefined;

    if (isAudio) {
      const url = `/api/files/${file.id}/${encodeURIComponent(file.name)}`;
      extractAudioMetadata(url).then((data) => {
        if (active && data) {
          setAudioMetadata(data);
          currentPictureUrl = data.picture;
        }
      });
    }
    return () => {
      active = false;
      if (currentPictureUrl) {
        URL.revokeObjectURL(currentPictureUrl);
      }
    };
  }, [file.id, file.name, isAudio]);

  return (
    <div
      className="group relative cursor-pointer transition-all duration-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-primary/30 rounded-2xl overflow-hidden flex flex-col h-full shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
      onClick={onPreview}
      onMouseEnter={() => {
        setIsHovered(true);
        videoRef.current?.play().catch(() => {});
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'file', id: file.id }));
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      {/* Thumbnail / Icon area */}
      <div className="relative h-40 w-full flex items-center justify-center overflow-hidden bg-black/40">
          {/* Subtle Dynamic Backdrop */}
          <div className="absolute inset-0 opacity-20 bg-gradient-to-br from-violet-600/20 via-transparent to-indigo-600/20" />
          
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/files/${file.id}/${encodeURIComponent(file.name)}`}
              alt={file.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          ) : isVideo ? (
            <video
              ref={videoRef}
              src={`/api/files/${file.id}/${encodeURIComponent(file.name)}#t=0.1`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              muted
              playsInline
              preload="metadata"
            />
          ) : isAudio ? (
            <div className="w-full h-full flex items-center justify-center relative">
              {audioMetadata?.picture ? (
                <>
                   {/* Blurred album art backdrop */}
                  <img 
                    src={audioMetadata.picture} 
                    alt="" 
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-40 scale-150" 
                  />
                  <img 
                    src={audioMetadata.picture} 
                    alt="Album art" 
                    className="relative z-10 h-24 w-24 rounded-lg shadow-2xl transition-transform duration-500 group-hover:scale-110 border border-white/10" 
                  />
                </>
              ) : (
                <div className="relative h-16 w-16 rounded-2xl bg-violet-500/10 border border-white/10 flex items-center justify-center backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:bg-violet-500/20">
                  <Music className="h-8 w-8 text-violet-400/60 group-hover:text-violet-400/80 transition-colors" />
                </div>
              )}
            </div>
          ) : (
            <div className="relative h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-md transition-all duration-300 group-hover:scale-110 group-hover:bg-white/10">
              <IconComponent className="h-8 w-8 text-muted-foreground/60 group-hover:text-muted-foreground/80 transition-colors" />
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

      {/* File info */}
      <div className="p-4 flex flex-col gap-1.5 flex-1 justify-center bg-black/20 backdrop-blur-sm border-t border-white/[0.02]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white/90 truncate flex-1 leading-tight" title={file.name}>
            {file.name}
          </p>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <FileActions
              type="file"
              id={file.id}
              name={file.name}
              onPreview={onPreview}
              onShare={onShare}
              onRefresh={onRefresh}
            />
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] font-medium text-white/40">
          <span className="flex items-center gap-1.5">{formatBytes(file.size)}</span>
          <span>{format(new Date(file.createdAt), "MMM d")}</span>
        </div>
      </div>
    </div>
  );
}

interface FolderCardProps {
  folder: {
    id: string;
    name: string;
    _count?: { files: number; children: number };
  };
  onClick: () => void;
  onRefresh: () => void;
}

export function FolderCard({ folder, onClick, onRefresh }: FolderCardProps) {
  const itemCount = (folder._count?.files || 0) + (folder._count?.children || 0);

  return (
    <div
      className="group relative cursor-pointer transition-all duration-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-primary/30 rounded-2xl overflow-hidden flex flex-col h-full shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id }));
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragEnter={(e) => {
        e.currentTarget.classList.add("ring-2", "ring-primary");
      }}
      onDragLeave={(e) => {
        e.currentTarget.classList.remove("ring-2", "ring-primary");
      }}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.classList.remove("ring-2", "ring-primary");
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));
          if (data.id === folder.id) return;
          
          if (data.type === 'file') {
            await fetch(`/api/files/${data.id}/${encodeURIComponent('file')}`, {
              method: "PATCH",
              body: JSON.stringify({ folderId: folder.id })
            });
          } else if (data.type === 'folder') {
            await fetch(`/api/folders/${data.id}`, {
              method: "PATCH",
              body: JSON.stringify({ parentId: folder.id })
            });
          }
          await onRefresh();
        } catch (err) {
          console.error("Drop failed", err);
        }
      }}
    >
      <div className="relative h-40 flex items-center justify-center overflow-hidden bg-black/40">
        {/* Subtle Dynamic Backdrop */}
        <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-primary/20 via-transparent to-primary/10" />
        
        <div className="relative h-20 w-20 rounded-3xl bg-primary/5 border border-primary/10 flex items-center justify-center backdrop-blur-md transition-all duration-500 group-hover:scale-110 group-hover:bg-primary/10 shadow-lg">
          <Folder className="h-10 w-10 text-primary/60 fill-primary/10 transition-colors group-hover:text-primary/80" />
        </div>


        {/* Soft bottom vignette */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      {/* Folder info */}
      <div className="p-4 flex flex-col gap-1.5 flex-1 justify-center bg-black/20 backdrop-blur-sm border-t border-white/[0.02]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-white/90 truncate flex-1 leading-tight" title={folder.name}>
            {folder.name}
          </p>
          <div onClick={(e) => e.stopPropagation()} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <FileActions
              type="folder"
              id={folder.id}
              name={folder.name}
              onRefresh={onRefresh}
            />
          </div>
        </div>
        <p className="text-[11px] font-medium text-white/40 pt-0.5">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </p>
      </div>
    </div>
  );
}
