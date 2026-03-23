"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import {
  Plus,
  Presentation,
  Search,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Clock,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppSwitcher } from "@/components/shared/app-switcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatDistanceToNow } from "date-fns";

interface PresentationItem {
  id: string;
  title: string;
  theme: string;
  createdAt: string;
  updatedAt: string;
  shareId?: string | null;
  _count: { slides: number };
  slides: { id: string; content: any; background: string }[];
}

function PresentHome() {
  const router = useRouter();
  const [presentations, setPresentations] = useState<PresentationItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchPresentations = async () => {
    try {
      const res = await fetch("/api/present");
      if (res.ok) {
        setPresentations(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresentations();
  }, []);

  const createPresentation = async () => {
    const res = await fetch("/api/present", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Presentation" }),
    });
    if (res.ok) {
      const pres = await res.json();
      router.push(`/present/${pres.id}`);
    }
  };

  const deletePresentation = async (id: string) => {
    await fetch(`/api/present/${id}`, { method: "DELETE" });
    setPresentations((prev) => prev.filter((p) => p.id !== id));
  };

  const filtered = presentations.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 dark:border-[#1a1a1a] px-6 py-4">
        <div className="flex items-center gap-3">
          <AppSwitcher current="present" />
          <div className="flex items-center gap-2">
            <Presentation className="h-5 w-5 text-orange-500" />
            <h1 className="text-lg font-bold tracking-tight">SerikaPresent</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            onClick={createPresentation}
            className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Plus className="h-4 w-4" />
            New Presentation
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="px-6 py-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search presentations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Presentation Grid */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="aspect-video rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Presentation className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">
              {search
                ? "No presentations match your search"
                : "No presentations yet"}
            </p>
            {!search && (
              <Button
                variant="ghost"
                onClick={createPresentation}
                className="mt-2 text-orange-500 hover:text-orange-400"
              >
                Create your first presentation
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((pres) => (
              <div
                key={pres.id}
                className="group relative flex flex-col rounded-xl border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/5 transition-all cursor-pointer overflow-hidden"
                onClick={() => router.push(`/present/${pres.id}`)}
              >
                {/* Slide preview */}
                <div
                  className="aspect-video flex items-center justify-center"
                  style={{
                    backgroundColor:
                      pres.slides[0]?.background || "#000000",
                  }}
                >
                  <Presentation className="h-8 w-8 text-white/20" />
                </div>
                {/* Info */}
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-semibold text-sm truncate">
                    {pres.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(pres.updatedAt), {
                        addSuffix: true,
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {pres._count.slides} slides
                    </span>
                  </div>
                </div>
                {/* Actions */}
                <div
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-black/30 backdrop-blur-sm hover:bg-black/50 text-white transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/present/${pres.id}`)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deletePresentation(pres.id)}
                        className="text-red-500"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PresentPage() {
  return (
    <SessionProvider>
      <PresentHome />
    </SessionProvider>
  );
}
