"use client";

import { ChevronRight, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (folderId: string | null) => void;
  onDropItem?: (type: string, id: string, targetFolderId: string | null) => void;
}

export function Breadcrumbs({ items, onNavigate, onDropItem }: BreadcrumbsProps) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDragEnter = (e: React.DragEvent) => {
    e.currentTarget.classList.add("ring-2", "ring-primary");
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("ring-2", "ring-primary");
  };
  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("ring-2", "ring-primary");
    if (!onDropItem) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.id === targetFolderId) return;
      onDropItem(data.type, data.id, targetFolderId);
    } catch {}
  };

  return (
    <nav className="flex items-center gap-1 text-sm overflow-x-auto" aria-label="Breadcrumb">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 px-2 shrink-0"
        onClick={() => onNavigate(null)}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        <Home className="h-3.5 w-3.5" />
        <span>My Files</span>
      </Button>

      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-1 shrink-0">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <Button
            variant={index === items.length - 1 ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2"
            onClick={() => onNavigate(item.id)}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, item.id)}
          >
            {item.name}
          </Button>
        </div>
      ))}
    </nav>
  );
}
