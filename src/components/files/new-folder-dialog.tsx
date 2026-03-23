"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string | null;
  onCreated: () => void;
}

export function NewFolderDialog({
  open,
  onOpenChange,
  parentId,
  onCreated,
}: NewFolderDialogProps) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create folder");
      }

      toast.success(`Folder "${name.trim()}" created`);
      setName("");
      onOpenChange(false);
      onCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
          <DialogDescription>
            Create a new folder to organize your files.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              placeholder="My Folder"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
