"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Download,
  Share2,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  Archive,
  Folder as FolderIcon,
  Magnet,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface FileActionsProps {
  type: "file" | "folder";
  id: string;
  name: string;
  onPreview?: () => void;
  onShare?: () => void;
  onRefresh: () => void;
}

export function FileActions({
  type,
  id,
  name,
  onPreview,
  onShare,
  onRefresh,
}: FileActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState(name);
  const [loading, setLoading] = useState(false);

  const handleDownload = () => {
    if (type === "file") {
      const a = document.createElement("a");
      a.href = `/api/files/${id}/${encodeURIComponent(name)}`;
      a.download = name;
      a.click();
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      const endpoint = type === "file" ? `/api/files/${id}/${encodeURIComponent(name)}` : `/api/folders/${id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to delete ${type}`);
      }
      toast.success(`${name} deleted`);
      setDeleteOpen(false);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to delete ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === name) {
      setRenameOpen(false);
      return;
    }
    setLoading(true);
    try {
      const endpoint = type === "file" ? `/api/files/${id}/${encodeURIComponent(name)}` : `/api/folders/${id}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to rename ${type}`);
      }
      toast.success(`Renamed to "${newName.trim()}"`);
      setRenameOpen(false);
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Failed to rename ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const handleZip = async () => {
    const toastId = toast.loading(`Zipping "${name}"... This may take a moment.`);
    setLoading(true);
    try {
      const res = await fetch("/api/files/zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: id }),
      });
      if (!res.ok) throw new Error("Failed to create ZIP");
      const data = await res.json();
      
      toast.success("Folder zipped and shared!", { id: toastId });
      
      if (data.shareUrl) {
        await navigator.clipboard.writeText(data.shareUrl);
        toast.info("Share link copied to clipboard");
      }
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to zip folder", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleUnzip = async () => {
    const toastId = toast.loading(`Extracting "${name}"...`);
    setLoading(true);
    try {
      const res = await fetch("/api/files/unzip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: id }),
      });
      if (!res.ok) throw new Error("Failed to extract ZIP");
      
      toast.success("ZIP extracted successfully!", { id: toastId });
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to extract ZIP", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleTorrent = async () => {
    const toastId = toast.loading(`Creating torrent for "${name}"...`);
    setLoading(true);
    try {
      const payload = type === "file" ? { fileId: id } : { folderId: id };
      const res = await fetch("/api/files/torrent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create torrent");
      }

      const data = await res.json();

      toast.success("Torrent created successfully!", { id: toastId });

      if (data.shareUrl) {
        await navigator.clipboard.writeText(data.shareUrl);
        toast.info("Torrent share link copied to clipboard");
      }

      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create torrent", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const isZip = type === "file" && name.toLowerCase().endsWith(".zip");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-colors" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-[#0a0a0c]/95 border-white/10 backdrop-blur-xl text-white/80 p-1.5 shadow-2xl rounded-xl">
          {type === "file" && onPreview && (
            <DropdownMenuItem onClick={onPreview} className="rounded-lg focus:bg-white/5 focus:text-white transition-colors cursor-pointer py-2 px-3">
              <Eye className="mr-3 h-4 w-4 text-violet-400" />
              Preview
            </DropdownMenuItem>
          )}
          {type === "file" && (
            <DropdownMenuItem onClick={handleDownload} className="rounded-lg focus:bg-white/5 focus:text-white transition-colors cursor-pointer py-2 px-3">
              <Download className="mr-3 h-4 w-4 text-blue-400" />
              Download
            </DropdownMenuItem>
          )}
          {type === "file" && onShare && (
            <DropdownMenuItem onClick={onShare} className="rounded-lg focus:bg-white/5 focus:text-white transition-colors cursor-pointer py-2 px-3">
              <Share2 className="mr-3 h-4 w-4 text-emerald-400" />
              Share
            </DropdownMenuItem>
          )}

          {/* Share as Torrent - available for both files and folders */}
          <DropdownMenuItem onClick={handleTorrent} disabled={loading} className="rounded-lg focus:bg-white/5 focus:text-white transition-colors cursor-pointer py-2 px-3 text-orange-100 focus:text-orange-100">
            <Magnet className="mr-3 h-4 w-4 text-orange-400" />
            {loading ? "Creating torrent..." : "Share as Torrent"}
          </DropdownMenuItem>
          
          {type === "folder" && (
            <DropdownMenuItem onClick={handleZip} disabled={loading} className="rounded-lg focus:bg-white/5 focus:text-white transition-colors cursor-pointer py-2 px-3 text-amber-100 focus:text-amber-100">
              <Archive className="mr-3 h-4 w-4 text-amber-400" />
              {loading ? "Zipping..." : "Zip & Share"}
            </DropdownMenuItem>
          )}

          {isZip && (
            <DropdownMenuItem onClick={handleUnzip} disabled={loading} className="rounded-lg focus:bg-white/5 focus:text-white transition-colors cursor-pointer py-2 px-3 text-indigo-100 focus:text-indigo-100">
              <FolderIcon className="mr-3 h-4 w-4 text-indigo-400" />
              {loading ? "Extracting..." : "Extract ZIP"}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator className="bg-white/5" />
          
          <DropdownMenuItem onClick={() => { setNewName(name); setRenameOpen(true); }} className="rounded-lg focus:bg-white/5 focus:text-white transition-colors cursor-pointer py-2 px-3">
            <Pencil className="mr-3 h-4 w-4 text-white/40" />
            Rename
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => setDeleteOpen(true)}
            className="rounded-lg focus:bg-red-500/10 text-red-400 focus:text-red-400 transition-colors cursor-pointer py-2 px-3"
          >
            <Trash2 className="mr-3 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="bg-[#0a0a0c] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {type}?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Are you sure you want to delete &ldquo;{name}&rdquo;? This action cannot be undone.
              {type === "folder" && " All files inside this folder will also be deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white border-none"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md bg-[#0a0a0c] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Rename {type}</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            className="bg-white/5 border-white/10 text-white focus:ring-primary"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={loading || !newName.trim()} className="bg-primary hover:bg-primary/90 text-white">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
