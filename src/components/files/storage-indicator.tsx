"use client";

import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import { CloudIcon } from "lucide-react";

interface StorageIndicatorProps {
  used: number;
  limit: number;
}

export function StorageIndicator({ used, limit }: StorageIndicatorProps) {
  const percentage = Math.min((used / limit) * 100, 100);
  const isNearFull = percentage > 80;
  const isFull = percentage > 95;

  return (
    <div className="space-y-2 px-1">
      <div className="flex items-center gap-2">
        <CloudIcon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Storage</span>
      </div>
      <Progress
        value={percentage}
        className={`h-2 ${isFull ? "[&>div]:bg-red-500" : isNearFull ? "[&>div]:bg-amber-500" : "[&>div]:bg-primary"}`}
      />
      <p className="text-xs text-muted-foreground">
        <span className={isFull ? "text-red-500 font-medium" : ""}>
          {formatBytes(used)}
        </span>
        {" "}of {formatBytes(limit)} used
      </p>
    </div>
  );
}
