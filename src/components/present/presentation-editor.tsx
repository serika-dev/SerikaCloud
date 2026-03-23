"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Play,
  Trash2,
  ChevronUp,
  ChevronDown,
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Bold,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Download,
  Upload,
  Share2,
  Link,
  Link2Off,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { AppSwitcher } from "@/components/shared/app-switcher";
import { SlideCanvas } from "./slide-canvas";
import type { SlideElement, SlideData } from "./slide-canvas";
import { PresentMode } from "./present-mode";
import { toast } from "sonner";

interface PresentationData {
  id: string;
  title: string;
  theme: string;
  shareId?: string | null;
  slides: SlideData[];
}

interface PresentationEditorProps {
  presentation: PresentationData;
  onUpdate: (p: PresentationData) => void;
}

const BG_COLORS = [
  "#000000", "#111827", "#1e1b4b", "#0c0a09", "#0f172a",
  "#ffffff", "#f8fafc", "#fef3c7", "#dbeafe", "#dcfce7",
  "#7c3aed", "#2563eb", "#059669", "#ea580c", "#dc2626",
];

const ELEMENT_COLORS = [
  "#ffffff", "#000000", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];

const FONT_FAMILIES = [
  { label: "Default", value: "inherit" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Impact", value: "Impact, sans-serif" },
  { label: "Trebuchet MS", value: "Trebuchet MS, sans-serif" },
];

// ─── Element Properties Panel ────────────────────────────────────────────────
function PropertiesPanel({
  element,
  onUpdate,
  onDelete,
  onDuplicate,
}: {
  element: SlideElement;
  onUpdate: (updates: Partial<SlideElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <div className="w-56 shrink-0 border-l border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50 dark:bg-[#0a0a0a] overflow-auto">
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-[#1a1a1a]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {element.type === "text" ? "Text" : element.type === "image" ? "Image" : "Shape"} Properties
        </h3>
      </div>

      <div className="p-3 space-y-4">
        {/* Text properties */}
        {element.type === "text" && (
          <>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Font</label>
              <select
                value={element.fontFamily || "inherit"}
                onChange={(e) => onUpdate({ fontFamily: e.target.value })}
                className="w-full h-7 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs px-2"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Size</label>
                <select
                  value={element.fontSize || 24}
                  onChange={(e) => onUpdate({ fontSize: Number(e.target.value) })}
                  className="w-full h-7 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs px-2"
                >
                  {FONT_SIZES.map((s) => (
                    <option key={s} value={s}>{s}px</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-0.5">
                <button
                  onClick={() => onUpdate({ fontWeight: element.fontWeight === "bold" ? "normal" : "bold" })}
                  className={`h-7 w-7 rounded-md flex items-center justify-center text-xs ${
                    element.fontWeight === "bold"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Bold className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Align</label>
              <div className="flex gap-0.5">
                {(["left", "center", "right"] as const).map((align) => {
                  const Icon = align === "left" ? AlignLeft : align === "center" ? AlignCenter : AlignRight;
                  return (
                    <button
                      key={align}
                      onClick={() => onUpdate({ textAlign: align })}
                      className={`h-7 w-7 rounded-md flex items-center justify-center ${
                        element.textAlign === align
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Text Color</label>
              <div className="grid grid-cols-5 gap-1">
                {ELEMENT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onUpdate({ color })}
                    className={`h-6 w-6 rounded border ${
                      element.color === color ? "border-blue-500 ring-1 ring-blue-500" : "border-zinc-300 dark:border-zinc-700"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Shape properties */}
        {element.type === "shape" && (
          <>
            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Fill Color</label>
              <div className="grid grid-cols-5 gap-1">
                {ELEMENT_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => onUpdate({ backgroundColor: color })}
                    className={`h-6 w-6 rounded border ${
                      element.backgroundColor === color ? "border-blue-500 ring-1 ring-blue-500" : "border-zinc-300 dark:border-zinc-700"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Corner Radius</label>
              <input
                type="range"
                min="0"
                max="50"
                value={element.borderRadius || 0}
                onChange={(e) => onUpdate({ borderRadius: Number(e.target.value) })}
                className="w-full h-1.5 accent-blue-500"
              />
              <span className="text-[10px] text-muted-foreground">{element.borderRadius || 0}px</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-medium text-muted-foreground uppercase">Border Width</label>
              <input
                type="range"
                min="0"
                max="10"
                value={element.borderWidth || 0}
                onChange={(e) => onUpdate({ borderWidth: Number(e.target.value) })}
                className="w-full h-1.5 accent-blue-500"
              />
              <span className="text-[10px] text-muted-foreground">{element.borderWidth || 0}px</span>
            </div>
          </>
        )}

        {/* Image properties */}
        {element.type === "image" && (
          <div className="space-y-2">
            <label className="text-[10px] font-medium text-muted-foreground uppercase">Image</label>
            {element.src && (
              <div className="rounded overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <img src={element.src} alt="" className="w-full h-auto object-cover" />
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7 gap-1"
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async (ev) => {
                  const file = (ev.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  const form = new FormData();
                  form.append("file", file);
                  try {
                    const res = await fetch("/api/present/upload-image", { method: "POST", body: form });
                    if (!res.ok) throw new Error("Upload failed");
                    const data = await res.json();
                    onUpdate({ src: data.url });
                  } catch { /* toast handled in parent */ }
                };
                input.click();
              }}
            >
              <Upload className="h-3 w-3" />
              {element.src ? "Replace Image" : "Upload Image"}
            </Button>
          </div>
        )}

        <Separator />

        {/* Opacity */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium text-muted-foreground uppercase">Opacity</label>
          <input
            type="range"
            min="0"
            max="100"
            value={(element.opacity ?? 1) * 100}
            onChange={(e) => onUpdate({ opacity: Number(e.target.value) / 100 })}
            className="w-full h-1.5 accent-blue-500"
          />
          <span className="text-[10px] text-muted-foreground">{Math.round((element.opacity ?? 1) * 100)}%</span>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDuplicate}
            className="flex-1 gap-1 text-xs h-7"
          >
            <Copy className="h-3 w-3" />
            Duplicate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="flex-1 gap-1 text-xs h-7 text-red-500 hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────
export function PresentationEditor({ presentation, onUpdate }: PresentationEditorProps) {
  const router = useRouter();
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [title, setTitle] = useState(presentation.title);
  const [presenting, setPresenting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareId, setShareId] = useState<string | null>(presentation.shareId || null);
  const [sharingLoading, setShareLoading] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const slides = presentation.slides;
  const activeSlide = slides[activeSlideIndex];
  const selectedElement = activeSlide?.content?.elements?.find(
    (el) => el.id === selectedElementId
  ) || null;

  const saveTitle = async (newTitle: string) => {
    setTitle(newTitle);
    await fetch(`/api/present/${presentation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    });
  };

  const saveSlide = useCallback(async (slide: SlideData) => {
    setSaving(true);
    try {
      await fetch(`/api/present/${presentation.id}/slides`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideId: slide.id,
          content: slide.content,
          background: slide.background,
          notes: slide.notes,
          layout: slide.layout,
        }),
      });
    } finally {
      setSaving(false);
    }
  }, [presentation.id]);

  const addSlide = async () => {
    const res = await fetch(`/api/present/${presentation.id}/slides`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const newSlide = await res.json();
      const updated = {
        ...presentation,
        slides: [...slides, newSlide],
      };
      onUpdate(updated);
      setActiveSlideIndex(updated.slides.length - 1);
      setSelectedElementId(null);
    }
  };

  const deleteSlide = async (slideId: string) => {
    if (slides.length <= 1) return;
    await fetch(`/api/present/${presentation.id}/slides?slideId=${slideId}`, {
      method: "DELETE",
    });
    const updated = {
      ...presentation,
      slides: slides.filter((s) => s.id !== slideId),
    };
    onUpdate(updated);
    setSelectedElementId(null);
    if (activeSlideIndex >= updated.slides.length) {
      setActiveSlideIndex(Math.max(0, updated.slides.length - 1));
    }
  };

  const updateSlideContent = (elements: SlideElement[]) => {
    if (!activeSlide) return;
    const updatedSlide = { ...activeSlide, content: { elements } };
    const updatedSlides = slides.map((s, i) =>
      i === activeSlideIndex ? updatedSlide : s
    );
    onUpdate({ ...presentation, slides: updatedSlides });
    saveSlide(updatedSlide);
  };

  const updateSlideBackground = (bg: string) => {
    if (!activeSlide) return;
    const updatedSlide = { ...activeSlide, background: bg };
    const updatedSlides = slides.map((s, i) =>
      i === activeSlideIndex ? updatedSlide : s
    );
    onUpdate({ ...presentation, slides: updatedSlides });
    saveSlide(updatedSlide);
  };

  const addElement = (type: "text" | "image" | "shape", variant?: string) => {
    if (!activeSlide) return;
    const elements = activeSlide.content?.elements || [];
    const newEl: SlideElement = {
      id: `el_${Date.now()}`,
      type,
      x: 20 + Math.random() * 10,
      y: 25 + Math.random() * 10,
      width: type === "text" ? 60 : 30,
      height: type === "text" ? 15 : 30,
      content: type === "text" ? "Double-click to edit" : "",
      fontSize: type === "text" ? 32 : undefined,
      fontWeight: "normal",
      fontFamily: "inherit",
      textAlign: "center",
      color: "#ffffff",
      backgroundColor: type === "shape" ? "#7c3aed" : undefined,
      borderRadius: type === "shape" ? (variant === "circle" ? 999 : variant === "rounded" ? 16 : 0) : undefined,
      opacity: 1,
      src: type === "image" ? "" : undefined,
    };
    updateSlideContent([...elements, newEl]);
    setSelectedElementId(newEl.id);
  };

  const updateSelectedElement = (updates: Partial<SlideElement>) => {
    if (!activeSlide || !selectedElementId) return;
    const elements = activeSlide.content?.elements || [];
    const updated = elements.map((el) =>
      el.id === selectedElementId ? { ...el, ...updates } : el
    );
    updateSlideContent(updated);
  };

  const deleteSelectedElement = () => {
    if (!activeSlide || !selectedElementId) return;
    const elements = activeSlide.content?.elements || [];
    updateSlideContent(elements.filter((el) => el.id !== selectedElementId));
    setSelectedElementId(null);
  };

  const duplicateSelectedElement = () => {
    if (!activeSlide || !selectedElement) return;
    const elements = activeSlide.content?.elements || [];
    const dupe: SlideElement = {
      ...selectedElement,
      id: `el_${Date.now()}`,
      x: selectedElement.x + 3,
      y: selectedElement.y + 3,
    };
    updateSlideContent([...elements, dupe]);
    setSelectedElementId(dupe.id);
  };

  const moveSlide = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= slides.length) return;
    const newSlides = [...slides];
    [newSlides[index], newSlides[newIndex]] = [newSlides[newIndex], newSlides[index]];
    onUpdate({ ...presentation, slides: newSlides });
    setActiveSlideIndex(newIndex);
  };

  // ─── Export ──────────────────────────────────────────────────────────
  const handleExport = (format: "sppt" | "pptx") => {
    const url = `/api/present/${presentation.id}/export?format=${format}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}.${format}`;
    a.click();
    toast.success(`Exporting as .${format}`);
  };

  // ─── Import ──────────────────────────────────────────────────────────
  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.format !== "sppt" || !data.slides) {
        toast.error("Invalid .sppt file");
        return;
      }
      // Create slides from import
      for (const imported of data.slides) {
        const res = await fetch(`/api/present/${presentation.id}/slides`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: imported.content,
            background: imported.background || "#000000",
            notes: imported.notes || "",
            layout: imported.layout || "blank",
          }),
        });
        if (res.ok) {
          const newSlide = await res.json();
          presentation.slides.push(newSlide);
        }
      }
      onUpdate({ ...presentation });
      toast.success(`Imported ${data.slides.length} slides`);
    } catch {
      toast.error("Failed to import file");
    }
  };

  // ─── Share ───────────────────────────────────────────────────────────
  const handleShare = async () => {
    setShareLoading(true);
    try {
      const res = await fetch(`/api/present/${presentation.id}/share`, { method: "POST" });
      if (!res.ok) throw new Error();
      const { shareId: newId } = await res.json();
      setShareId(newId);
      const url = `${window.location.origin}/present/shared/${newId}`;
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
      await fetch(`/api/present/${presentation.id}/share`, { method: "DELETE" });
      setShareId(null);
      toast.success("Share link revoked");
    } catch {
      toast.error("Failed to revoke share link");
    } finally {
      setShareLoading(false);
    }
  };

  if (presenting) {
    return (
      <PresentMode
        slides={slides}
        startIndex={activeSlideIndex}
        onExit={() => setPresenting(false)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-zinc-200 dark:border-[#1a1a1a] px-4 py-2 gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <AppSwitcher current="present" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/present")}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={title}
            onChange={(e) => saveTitle(e.target.value)}
            className="border-none bg-transparent text-base font-semibold h-8 px-2 focus:bg-zinc-100 dark:focus:bg-zinc-900 rounded-md max-w-xs"
            placeholder="Untitled Presentation"
          />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {saving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1">
              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              Saving
            </span>
          )}

          {/* Import */}
          <input
            ref={importRef}
            type="file"
            accept=".sppt"
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
            className="gap-1.5 text-xs h-8"
            onClick={() => importRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </Button>

          {/* Export dropdown */}
          <div className="relative group">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8">
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <div className="absolute right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-lg py-1 min-w-[140px] z-50 hidden group-hover:block">
              <button
                onClick={() => handleExport("sppt")}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Download as .sppt
              </button>
              <button
                onClick={() => handleExport("pptx")}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Download as .pptx
              </button>
            </div>
          </div>

          {/* Share */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-8"
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
                        value={`${typeof window !== "undefined" ? window.location.origin : ""}/present/shared/${shareId}`}
                        readOnly
                        className="h-7 text-xs flex-1"
                        onFocus={(e) => e.target.select()}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/present/shared/${shareId}`);
                          toast.success("Copied!");
                        }}
                      >
                        <Link className="h-3 w-3" />
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
                    <p className="text-xs text-muted-foreground">This presentation is private.</p>
                    <Button
                      size="sm"
                      className="w-full text-xs h-7 gap-1"
                      onClick={() => { handleShare(); }}
                    >
                      <Link className="h-3 w-3" />
                      Create Share Link
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <Separator orientation="vertical" className="h-5" />

          <Button
            onClick={() => setPresenting(true)}
            className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Play className="h-4 w-4" />
            Present
          </Button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Slide panel (left) */}
        <div className="w-48 shrink-0 border-r border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50 dark:bg-[#0a0a0a] flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto p-2 space-y-2">
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                onClick={() => {
                  setActiveSlideIndex(index);
                  setSelectedElementId(null);
                }}
                className={`group relative rounded-lg cursor-pointer transition-all border-2 ${
                  index === activeSlideIndex
                    ? "border-orange-500 shadow-md shadow-orange-500/10"
                    : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div
                  className="aspect-video rounded-md overflow-hidden flex items-center justify-center text-xs"
                  style={{ backgroundColor: slide.background }}
                >
                  <span className="text-white/30 text-[8px] font-mono">
                    {index + 1}
                  </span>
                </div>
                {/* Slide actions */}
                <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 flex gap-0.5 transition-opacity">
                  {index > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSlide(index, "up"); }}
                      className="h-4 w-4 rounded bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                  )}
                  {index < slides.length - 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSlide(index, "down"); }}
                      className="h-4 w-4 rounded bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  )}
                  {slides.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSlide(slide.id); }}
                      className="h-4 w-4 rounded bg-red-500/80 text-white flex items-center justify-center hover:bg-red-500"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 border-t border-zinc-200 dark:border-[#1a1a1a]">
            <Button
              variant="ghost"
              size="sm"
              onClick={addSlide}
              className="w-full gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Slide
            </Button>
          </div>
        </div>

        {/* Main canvas area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-zinc-200 dark:border-[#1a1a1a] bg-zinc-50/50 dark:bg-[#080808] shrink-0 flex-wrap">
            {/* Insert */}
            <span className="text-[10px] text-muted-foreground font-medium mr-1">Insert:</span>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => addElement("text")}
              title="Add Text Box"
              className="h-7 w-7"
            >
              <Type className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => addElement("shape")}
              title="Add Rectangle"
              className="h-7 w-7"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => addElement("shape", "rounded")}
              title="Add Rounded Rectangle"
              className="h-7 w-7"
            >
              <Square className="h-3.5 w-3.5 rounded-sm" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => addElement("shape", "circle")}
              title="Add Circle"
              className="h-7 w-7"
            >
              <Circle className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => addElement("image")}
              title="Add Image"
              className="h-7 w-7"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </Button>

            <div className="w-px h-5 bg-zinc-200 dark:bg-zinc-800 mx-2" />

            {/* Background colors */}
            <span className="text-[10px] text-muted-foreground font-medium mr-1">Background:</span>
            <div className="flex items-center gap-0.5">
              {BG_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => updateSlideBackground(color)}
                  className={`h-5 w-5 rounded-full border-2 transition-all hover:scale-110 ${
                    activeSlide?.background === color
                      ? "border-orange-500 scale-110"
                      : "border-zinc-300 dark:border-zinc-700"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-zinc-100 dark:bg-[#070707]">
            {activeSlide && (
              <SlideCanvas
                slide={activeSlide}
                onUpdateElements={updateSlideContent}
                onSelectElement={setSelectedElementId}
                selectedElementId={selectedElementId}
                isEditing
              />
            )}
          </div>

          {/* Notes */}
          {activeSlide && (
            <div className="border-t border-zinc-200 dark:border-[#1a1a1a] px-4 py-2 shrink-0">
              <textarea
                value={activeSlide.notes || ""}
                onChange={(e) => {
                  const updatedSlide = { ...activeSlide, notes: e.target.value };
                  const updatedSlides = slides.map((s, i) =>
                    i === activeSlideIndex ? updatedSlide : s
                  );
                  onUpdate({ ...presentation, slides: updatedSlides });
                }}
                onBlur={() => activeSlide && saveSlide(activeSlide)}
                placeholder="Speaker notes..."
                className="w-full h-16 resize-none text-xs bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
        </div>

        {/* Properties panel (right) — shown when element selected */}
        {selectedElement && (
          <PropertiesPanel
            element={selectedElement}
            onUpdate={updateSelectedElement}
            onDelete={deleteSelectedElement}
            onDuplicate={duplicateSelectedElement}
          />
        )}
      </div>
    </div>
  );
}
