"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { PresentationEditor } from "@/components/present/presentation-editor";

interface SlideData {
  id: string;
  order: number;
  content: any;
  notes: string | null;
  layout: string;
  background: string;
}

interface PresentationData {
  id: string;
  title: string;
  theme: string;
  shareId?: string | null;
  slides: SlideData[];
}

function EditorPage({ id }: { id: string }) {
  const router = useRouter();
  const [presentation, setPresentation] = useState<PresentationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/present/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(setPresentation)
      .catch(() => router.push("/present"))
      .finally(() => setLoading(false));
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    );
  }

  if (!presentation) return null;

  return (
    <PresentationEditor
      presentation={presentation}
      onUpdate={setPresentation}
    />
  );
}

export default function PresentEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <SessionProvider>
      <EditorPage id={id} />
    </SessionProvider>
  );
}
