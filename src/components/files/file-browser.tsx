"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderPlus, Upload } from "lucide-react";
import { toast } from "sonner";

import { Breadcrumbs } from "@/components/files/breadcrumbs";
import { SearchBar } from "@/components/files/search-bar";
import { ViewToggle } from "@/components/files/view-toggle";
import { FileGrid } from "@/components/files/file-grid";
import { FileList } from "@/components/files/file-list";
import { FilePreview } from "@/components/files/file-preview";
import { ShareDialog } from "@/components/files/share-dialog";
import { NewFolderDialog } from "@/components/files/new-folder-dialog";
import { UploadZone } from "@/components/files/upload-zone";

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

interface BreadcrumbItem {
  id: string;
  name: string;
}

export function FileBrowser({ folderId, isRecent = false }: { folderId: string | null; isRecent?: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<FileData[]>([]);
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [viewLoaded, setViewLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileData | null>(null);
  const [shareFile, setShareFile] = useState<FileData | null>(null);

  const fetchUserViewPreference = useCallback(async () => {
    try {
      const res = await fetch("/api/user");
      if (res.ok) {
        const data = await res.json();
        if (data.viewPreference === "grid" || data.viewPreference === "list") {
          setView(data.viewPreference);
        }
      }
    } catch (e) {}
    setViewLoaded(true);
  }, []);

  const handleViewChange = async (newView: "grid" | "list") => {
    setView(newView);
    try {
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewPreference: newView }),
      });
    } catch (e) {}
  };

  const fetchFiles = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (folderId) params.set("folderId", folderId);
      if (searchQuery) params.set("search", searchQuery);
      if (isRecent) params.set("recent", "true");

      const res = await fetch(`/api/files?${params}`);
      if (!res.ok) throw new Error("Failed to fetch files");

      const data = await res.json();
      setFiles(data.files);
      setFolders(data.folders);
    } catch (err) {
      toast.error("Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [folderId, searchQuery, isRecent]);

  const fetchBreadcrumbs = useCallback(async () => {
    if (!folderId || isRecent) {
      setBreadcrumbs([]);
      return;
    }
    try {
      const res = await fetch(`/api/folders/breadcrumbs?folderId=${folderId}`);
      const data = await res.json();
      setBreadcrumbs(data.breadcrumbs);
    } catch {
      setBreadcrumbs([]);
    }
  }, [folderId, isRecent]);

  useEffect(() => {
    setLoading(true);
    fetchFiles();
    fetchBreadcrumbs();
    if (!viewLoaded) fetchUserViewPreference();
  }, [fetchFiles, fetchBreadcrumbs, viewLoaded, fetchUserViewPreference]);

  const handleNavigate = (targetFolderId: string | null) => {
    if (targetFolderId) {
      router.push(`/folder/${targetFolderId}`);
    } else {
      router.push("/");
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setLoading(true);
  };

  const handleRefresh = () => {
    setLoading(true);
    fetchFiles();
    fetchBreadcrumbs();
  };

  const handleDropItem = async (type: string, id: string, targetFolderId: string | null) => {
    try {
      if (type === 'file') {
        const res = await fetch(`/api/files/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ folderId: targetFolderId })
        });
        if (!res.ok) throw new Error();
      } else if (type === 'folder') {
        const res = await fetch(`/api/folders/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ parentId: targetFolderId })
        });
        if (!res.ok) throw new Error();
      }
      handleRefresh();
      toast.success("Moved successfully");
    } catch (err) {
      toast.error("Failed to move item");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Container */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600/10 via-indigo-600/10 to-transparent p-6 sm:p-8 border border-muted-foreground/10">
        <div className="absolute right-0 top-0 -mt-16 -mr-16 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 w-64 h-64 rounded-full blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              {isRecent ? "Recent Files" : searchQuery ? "Search Results" : folderId ? breadcrumbs[breadcrumbs.length - 1]?.name || "Folder" : "My Files"}
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-lg">
              {isRecent 
                ? "Your recently uploaded or modified files."
                : searchQuery
                ? `Results for "${searchQuery}"`
                : "Manage your cloud files, share them securely, and organize your digital life."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isRecent && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewFolderOpen(true)}
                  className="bg-background/50 backdrop-blur-sm"
                >
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New Folder
                </Button>
                <Button
                  size="sm"
                  onClick={() => setShowUpload(!showUpload)}
                  className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Upload zone */}
      {showUpload && (
        <UploadZone folderId={folderId} onUploadComplete={handleRefresh} />
      )}

      {/* Breadcrumbs + Search + View toggle */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {!isRecent ? <Breadcrumbs items={breadcrumbs} onNavigate={handleNavigate} onDropItem={handleDropItem} /> : <div className="text-sm font-medium text-muted-foreground">Most recent uploads</div>}
        <div className="flex items-center gap-2">
          <SearchBar onSearch={handleSearch} />
          <ViewToggle view={view} onViewChange={handleViewChange} />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-32 w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : view === "grid" ? (
        <FileGrid
          files={files}
          folders={folders}
          onFilePreview={(file) => setPreviewFile(file)}
          onFileShare={(file) => setShareFile(file)}
          onFolderClick={handleNavigate}
          onRefresh={handleRefresh}
        />
      ) : (
        <FileList
          files={files}
          folders={folders}
          onFilePreview={(file) => setPreviewFile(file)}
          onFileShare={(file) => setShareFile(file)}
          onFolderClick={handleNavigate}
          onRefresh={handleRefresh}
        />
      )}

      {/* Dialogs */}
      <FilePreview
        open={!!previewFile}
        onOpenChange={(open) => !open && setPreviewFile(null)}
        file={previewFile}
      />
      {shareFile && (
        <ShareDialog
          open={!!shareFile}
          onOpenChange={(open) => !open && setShareFile(null)}
          fileId={shareFile.id}
          fileName={shareFile.name}
        />
      )}
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        parentId={folderId}
        onCreated={handleRefresh}
      />
    </div>
  );
}
