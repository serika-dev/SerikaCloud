"use client";

import { Cloud, FileText, Mail, Presentation, Grid3X3 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const apps = [
  {
    name: "Cloud",
    description: "File storage",
    icon: Cloud,
    subdomain: "cloud",
    color: "text-violet-500",
    bg: "bg-violet-500/10 hover:bg-violet-500/20",
  },
  {
    name: "Write",
    description: "Documents",
    icon: FileText,
    subdomain: "write",
    color: "text-blue-500",
    bg: "bg-blue-500/10 hover:bg-blue-500/20",
  },
  {
    name: "Mail",
    description: "Email",
    icon: Mail,
    subdomain: "mail",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
  },
  {
    name: "Present",
    description: "Slides",
    icon: Presentation,
    subdomain: "present",
    color: "text-orange-500",
    bg: "bg-orange-500/10 hover:bg-orange-500/20",
  },
];

function getAppUrl(subdomain: string): string {
  if (typeof window === "undefined") return "/";
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    if (subdomain === "cloud") return "/";
    return `/${subdomain}`;
  }

  const parts = hostname.split(".");
  const baseDomain = parts.length >= 3 ? parts.slice(1).join(".") : hostname;
  return `${protocol}//${subdomain}.${baseDomain}`;
}

export function AppSwitcher({ current }: { current?: string }) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
        <Grid3X3 className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start" sideOffset={8}>
        <div className="grid grid-cols-2 gap-1.5">
          {apps.map((app) => {
            const isActive = current === app.subdomain;
            return (
              <a
                key={app.subdomain}
                href={getAppUrl(app.subdomain)}
                className={`flex flex-col items-center gap-1.5 rounded-lg p-3 transition-all ${
                  isActive
                    ? `${app.bg} ring-1 ring-current/10`
                    : "hover:bg-muted"
                }`}
              >
                <app.icon
                  className={`h-5 w-5 ${isActive ? app.color : "text-muted-foreground"}`}
                />
                <span
                  className={`text-xs font-semibold ${isActive ? app.color : ""}`}
                >
                  {app.name}
                </span>
              </a>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
