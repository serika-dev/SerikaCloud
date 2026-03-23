"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { ArrowLeft, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentEditor } from "@/components/docs/document-editor";
import { AppSwitcher } from "@/components/shared/app-switcher";

interface DocumentData {
  id: string;
  title: string;
  content: any;
  shareId?: string | null;
  updatedAt: string;
}

function DocEditorPage({ id }: { id: string }) {
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentData | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/docs/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data) => {
        setDoc(data);
        setTitle(data.title);
        setLastSaved(new Date(data.updatedAt));
      })
      .catch(() => router.push("/write"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const save = useCallback(
    async (content?: any, newTitle?: string) => {
      if (!doc) return;
      setSaving(true);
      try {
        const body: any = {};
        if (content !== undefined) body.content = content;
        if (newTitle !== undefined) body.title = newTitle;

        await fetch(`/api/docs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        setLastSaved(new Date());
      } finally {
        setSaving(false);
      }
    },
    [doc, id]
  );

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    save(undefined, newTitle);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!doc) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-zinc-200 dark:border-[#1a1a1a] px-4 py-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AppSwitcher current="write" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/write")}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="border-none bg-transparent text-base font-semibold h-8 px-2 focus:bg-zinc-100 dark:focus:bg-zinc-900 rounded-md max-w-sm"
            placeholder="Untitled Document"
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          {saving ? (
            <>
              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              Saving...
            </>
          ) : lastSaved ? (
            <>
              <Cloud className="h-3 w-3 text-green-500" />
              Saved
            </>
          ) : null}
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        <DocumentEditor
          documentId={id}
          initialContent={doc.content}
          initialShareId={doc.shareId}
          onSave={save}
        />
      </div>
    </div>
  );
}

export default function DocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <SessionProvider>
      <DocEditorPage id={id} />
    </SessionProvider>
  );
}
