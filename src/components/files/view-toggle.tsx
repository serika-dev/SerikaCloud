"use client";

import { LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ViewToggleProps {
  view: "grid" | "list";
  onViewChange: (view: "grid" | "list") => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
      <Button
        variant={view === "grid" ? "secondary" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onViewChange("grid")}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant={view === "list" ? "secondary" : "ghost"}
        size="icon"
        className="h-7 w-7"
        onClick={() => onViewChange("list")}
      >
        <List className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
