"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  createdAt: string;
  _count?: { files: number; children: number };
}

interface FileListProps {
  files: FileData[];
  folders: FolderData[];
  onFilePreview: (file: FileData) => void;
  onFileShare: (file: FileData) => void;
  onFolderClick: (folderId: string) => void;
  onRefresh: () => void;
}

export function FileList({
  files,
  folders,
  onFilePreview,
  onFileShare,
  onFolderClick,
  onRefresh,
}: FileListProps) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-[50%]">Name</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Modified</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map((folder) => (
            <TableRow
              key={`folder-${folder.id}`}
              className="cursor-pointer transition-colors"
              onClick={() => onFolderClick(folder.id)}
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
                e.currentTarget.classList.add("bg-primary/10");
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove("bg-primary/10");
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.currentTarget.classList.remove("bg-primary/10");
                try {
                  const data = JSON.parse(e.dataTransfer.getData('application/json'));
                  if (data.id === folder.id) return;
                  
                  if (data.type === 'file') {
                    await fetch(`/api/files/${data.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ folderId: folder.id })
                    });
                  } else if (data.type === 'folder') {
                    await fetch(`/api/folders/${data.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ parentId: folder.id })
                    });
                  }
                  onRefresh();
                } catch (err) {}
              }}
            >
              <TableCell>
                <div className="flex items-center gap-3">
                  <Folder className="h-5 w-5 text-primary/70 fill-primary/10 shrink-0" />
                  <span className="font-medium truncate">{folder.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {(folder._count?.files || 0) + (folder._count?.children || 0)} items
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format(new Date(folder.createdAt), "MMM d, yyyy")}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <FileActions
                  type="folder"
                  id={folder.id}
                  name={folder.name}
                  onRefresh={onRefresh}
                />
              </TableCell>
            </TableRow>
          ))}
          {files.map((file) => {
            const iconName = getFileIcon(file.mimeType);
            const IconComponent = iconMap[iconName] || File;

            return (
              <TableRow
                key={`file-${file.id}`}
                className="cursor-pointer"
                onClick={() => onFilePreview(file)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/json', JSON.stringify({ type: 'file', id: file.id }));
                  e.dataTransfer.effectAllowed = 'move';
                }}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <IconComponent className="h-5 w-5 text-muted-foreground/70 shrink-0" />
                    <span className="font-medium truncate">{file.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatBytes(file.size)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(file.createdAt), "MMM d, yyyy")}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <FileActions
                    type="file"
                    id={file.id}
                    name={file.name}
                    onPreview={() => onFilePreview(file)}
                    onShare={() => onFileShare(file)}
                    onRefresh={onRefresh}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {folders.length === 0 && files.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                No files or folders here yet
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
