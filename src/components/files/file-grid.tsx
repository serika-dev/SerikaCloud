"use client";

import { FileCard, FolderCard } from "./file-card";

interface FileData {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

interface FolderData {
  id: string;
  name: string;
  _count?: { files: number; children: number };
}

interface FileGridProps {
  files: FileData[];
  folders: FolderData[];
  onFilePreview: (file: FileData) => void;
  onFileShare: (file: FileData) => void;
  onFolderClick: (folderId: string) => void;
  onRefresh: () => void;
}

export function FileGrid({
  files,
  folders,
  onFilePreview,
  onFileShare,
  onFolderClick,
  onRefresh,
}: FileGridProps) {
  if (folders.length === 0 && files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <div className="rounded-full bg-muted p-4 mb-4">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
        </div>
        <p className="font-medium">No files or folders</p>
        <p className="text-sm mt-1">Upload files or create a folder to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {folders.map((folder) => (
        <FolderCard
          key={`folder-${folder.id}`}
          folder={folder}
          onClick={() => onFolderClick(folder.id)}
          onRefresh={onRefresh}
        />
      ))}
      {files.map((file) => (
        <FileCard
          key={`file-${file.id}`}
          file={file}
          onPreview={() => onFilePreview(file)}
          onShare={() => onFileShare(file)}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}
