"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import {
  Plus,
  FileText,
  Search,
  MoreHorizontal,
  Trash2,
  ExternalLink,
  Clock,
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

interface Document {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  shareId?: string | null;
}

function DocsHome() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchDocuments = async () => {
    try {
      const res = await fetch("/api/docs");
      if (res.ok) {
        setDocuments(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const createDocument = async () => {
    const res = await fetch("/api/docs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Untitled Document" }),
    });
    if (res.ok) {
      const doc = await res.json();
      router.push(`/write/${doc.id}`);
    }
  };

  const deleteDocument = async (id: string) => {
    await fetch(`/api/docs/${id}`, { method: "DELETE" });
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const filtered = documents.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-zinc-200 dark:border-[#1a1a1a] px-6 py-4">
        <div className="flex items-center gap-3">
          <AppSwitcher current="write" />
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            <h1 className="text-lg font-bold tracking-tight">SerikaDocs</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button onClick={createDocument} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4" />
            New Document
          </Button>
        </div>
      </header>

      {/* Search */}
      <div className="px-6 py-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Document Grid */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-zinc-100 dark:bg-zinc-900 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">
              {search ? "No documents match your search" : "No documents yet"}
            </p>
            {!search && (
              <Button
                variant="ghost"
                onClick={createDocument}
                className="mt-2 text-blue-500 hover:text-blue-400"
              >
                Create your first document
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((doc) => (
              <div
                key={doc.id}
                className="group relative flex flex-col rounded-xl border border-zinc-200 dark:border-[#1a1a1a] bg-white dark:bg-[#0a0a0a] hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all cursor-pointer"
                onClick={() => router.push(`/write/${doc.id}`)}
              >
                {/* Preview area */}
                <div className="h-32 rounded-t-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 flex items-center justify-center">
                  <FileText className="h-10 w-10 text-blue-300 dark:text-blue-800" />
                </div>
                {/* Info */}
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="font-semibold text-sm truncate">{doc.title}</h3>
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(doc.updatedAt), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
                {/* Actions */}
                <div
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 w-7 rounded-md bg-white/80 dark:bg-black/50 backdrop-blur-sm hover:bg-white dark:hover:bg-black transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/write/${doc.id}`)}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteDocument(doc.id)}
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

export default function DocsPage() {
  return (
    <SessionProvider>
      <DocsHome />
    </SessionProvider>
  );
}
