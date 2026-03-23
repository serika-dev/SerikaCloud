"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { useCallback, useRef, useState } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Download,
  Upload,
  Share2,
  Link as LinkIcon,
  Link2Off,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

// Custom fontSize extension for TextStyle
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
});

interface DocumentEditorProps {
  documentId: string;
  initialContent: any;
  initialShareId?: string | null;
  onSave: (content: any) => void;
}

export function DocumentEditor({ documentId, initialContent, initialShareId, onSave }: DocumentEditorProps) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const importRef = useRef<HTMLInputElement>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareId, setShareId] = useState<string | null>(initialShareId || null);
  const [sharingLoading, setShareLoading] = useState(false);

  const debouncedSave = useCallback(
    (content: any) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        onSave(content);
      }, 1000);
    },
    [onSave]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing your document...",
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-500 underline cursor-pointer hover:text-blue-400",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full rounded-lg mx-auto",
        },
      }),
      Highlight.configure({
        multicolor: true,
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      FontSize,
      Color,
      FontFamily,
      Subscript,
      Superscript,
    ],
    content: initialContent || undefined,
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-8rem)] px-12 py-12 sm:px-16 md:px-20 lg:px-24",
      },
    },
    onUpdate: ({ editor }) => {
      debouncedSave(editor.getJSON());
    },
    immediatelyRender: false,
  });

  // ─── Export ──────────────────────────────────────────────────────────
  const handleExport = (format: "sdoc" | "docx") => {
    const url = `/api/docs/${documentId}/export?format=${format}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `document.${format}`;
    a.click();
    toast.success(`Exporting as .${format}`);
  };

  // ─── Import ──────────────────────────────────────────────────────────
  const handleImport = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "sdoc") {
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.content && editor) {
          editor.commands.setContent(data.content);
          onSave(data.content);
          toast.success("Imported .sdoc content");
        }
      } catch {
        toast.error("Failed to parse .sdoc file");
      }
      return;
    }

    // For .docx, .txt, .md, .html — use server-side import API, then set content
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/docs/import", { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error || "Import failed");
        return;
      }
      const { id } = await res.json();
      // Fetch the imported document's content and load it into the editor
      const docRes = await fetch(`/api/docs/${id}`);
      if (docRes.ok) {
        const doc = await docRes.json();
        if (doc.content && editor) {
          editor.commands.setContent(doc.content);
          onSave(doc.content);
          toast.success(`Imported ${file.name}`);
        }
      }
    } catch {
      toast.error("Failed to import file");
    }
  };

  // ─── Share ───────────────────────────────────────────────────────────
  const handleShare = async () => {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/docs/${documentId}/share`, { method: "POST" });
      if (!res.ok) throw new Error();
      const { shareId: newId } = await res.json();
      setShareId(newId);
      const url = `${window.location.origin}/write/shared/${newId}`;
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard!");
    } catch {
      toast.error("Failed to create share link");
    } finally {
      setShareLoading(false);
    }
  };

  const handleUnshare = async () => {
    setShareLoading(true);
    try {
      await fetch(`/api/docs/${documentId}/share`, { method: "DELETE" });
      setShareId(null);
      toast.success("Share link revoked");
    } catch {
      toast.error("Failed to revoke share link");
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Document actions bar */}
      <div className="flex items-center justify-end gap-1.5 px-3 py-1 border-b border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50/50 dark:bg-[#080808] shrink-0">
        {/* Import */}
        <input
          ref={importRef}
          type="file"
          accept=".sdoc,.docx,.txt,.md,.html,.htm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImport(file);
            e.target.value = "";
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs h-7"
          onClick={() => importRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>

        {/* Export dropdown */}
        <div className="relative group">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 min-w-[140px] z-50 hidden group-hover:block">
            <button
              onClick={() => handleExport("sdoc")}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Download as .sdoc
            </button>
            <button
              onClick={() => handleExport("docx")}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Download as .docx
            </button>
          </div>
        </div>

        <Separator orientation="vertical" className="h-4" />

        {/* Share */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={() => setShowShareMenu(!showShareMenu)}
            disabled={sharingLoading}
          >
            {sharingLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
            Share
          </Button>
          {showShareMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg p-3 min-w-[260px] z-50">
              {shareId ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Anyone with the link can view:</p>
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/write/shared/${shareId}`}
                      readOnly
                      className="h-7 text-xs flex-1"
                      onFocus={(e) => e.target.select()}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs shrink-0"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/write/shared/${shareId}`);
                        toast.success("Copied!");
                      }}
                    >
                      <LinkIcon className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs h-7 text-red-500 hover:text-red-400 gap-1"
                    onClick={() => { handleUnshare(); setShowShareMenu(false); }}
                  >
                    <Link2Off className="h-3 w-3" />
                    Revoke Link
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">This document is private.</p>
                  <Button
                    size="sm"
                    className="w-full text-xs h-7 gap-1"
                    onClick={() => { handleShare(); }}
                  >
                    <LinkIcon className="h-3 w-3" />
                    Create Share Link
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <EditorToolbar editor={editor} />
      <div className="flex-1 overflow-auto bg-white dark:bg-[#0a0a0a]">
        {/* Page-style container */}
        <div className="max-w-[816px] mx-auto my-6 bg-white dark:bg-[#111] shadow-lg dark:shadow-zinc-900/50 rounded-sm min-h-[1056px] border border-zinc-200/50 dark:border-zinc-800/50">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}
