"use client";

import { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  ListChecks,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Quote,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  Highlighter,
  Table as TableIcon,
  Undo,
  Redo,
  ChevronDown,
  Superscript,
  Subscript,
  IndentIncrease,
  IndentDecrease,
  RemoveFormatting,
  Palette,
  Type,
  Baseline,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface EditorToolbarProps {
  editor: Editor | null;
}

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Times New Roman", value: "Times New Roman, serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Courier New", value: "Courier New, monospace" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Trebuchet MS", value: "Trebuchet MS, sans-serif" },
  { label: "Comic Sans MS", value: "Comic Sans MS, cursive" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96];

const HEADING_STYLES = [
  { label: "Normal text", value: 0 },
  { label: "Heading 1", value: 1 },
  { label: "Heading 2", value: 2 },
  { label: "Heading 3", value: 3 },
];

const TEXT_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#cccccc", "#ffffff",
  "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6fa8dc",
  "#8e7cc3", "#c27ba0",
  "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3d85c6",
  "#674ea7", "#a64d79",
  "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#0b5394",
  "#351c75", "#741b47",
];

const HIGHLIGHT_COLORS = [
  "transparent", "#fef08a", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#fecdd3",
  "#fed7aa", "#cffafe", "#f3f4f6",
];

// Dropdown component
function Dropdown({
  trigger,
  children,
  width = "w-44",
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center">
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute top-full left-0 mt-1 ${width} max-h-64 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xl z-50`}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`h-7 w-7 inline-flex items-center justify-center rounded-md text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed
        ${isActive
          ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
        }`}
    >
      {children}
    </button>
  );
}

function ColorGrid({
  colors,
  activeColor,
  onSelect,
}: {
  colors: string[];
  activeColor?: string;
  onSelect: (color: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-0.5 p-2">
      {colors.map((color) => (
        <button
          key={color}
          onClick={() => onSelect(color)}
          className={`h-5 w-5 rounded border transition-all hover:scale-110 ${
            activeColor === color
              ? "border-blue-500 ring-1 ring-blue-500"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
          style={{ backgroundColor: color === "transparent" ? undefined : color }}
          title={color}
        >
          {color === "transparent" && (
            <span className="text-[8px] text-muted-foreground">∅</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const currentFontFamily =
    editor.getAttributes("textStyle").fontFamily || "";
  const currentFontLabel =
    FONT_FAMILIES.find((f) => f.value === currentFontFamily)?.label || "Default";

  const currentHeading = HEADING_STYLES.find((h) =>
    h.value === 0
      ? editor.isActive("paragraph")
      : editor.isActive("heading", { level: h.value })
  );

  const addLink = () => {
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("Enter URL:", prev);
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b border-zinc-200 dark:border-[#1a1a1a] px-2 py-1 bg-zinc-50/80 dark:bg-[#080808] sticky top-0 z-10">
      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Paragraph style dropdown */}
      <Dropdown
        trigger={
          <span className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 min-w-[100px] justify-between">
            {currentHeading?.label || "Normal text"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </span>
        }
        width="w-48"
      >
        {HEADING_STYLES.map((style) => (
          <button
            key={style.value}
            onClick={() => {
              if (style.value === 0) {
                editor.chain().focus().setParagraph().run();
              } else {
                editor.chain().focus().toggleHeading({ level: style.value as 1 | 2 | 3 }).run();
              }
            }}
            className={`w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              style.value === 1 ? "text-2xl font-bold" :
              style.value === 2 ? "text-xl font-semibold" :
              style.value === 3 ? "text-lg font-semibold" : "text-sm"
            }`}
          >
            {style.label}
          </button>
        ))}
      </Dropdown>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Font family dropdown */}
      <Dropdown
        trigger={
          <span className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 min-w-[90px] justify-between truncate">
            {currentFontLabel}
            <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
          </span>
        }
        width="w-52"
      >
        {FONT_FAMILIES.map((font) => (
          <button
            key={font.label}
            onClick={() => {
              if (font.value === "") {
                editor.chain().focus().unsetFontFamily().run();
              } else {
                editor.chain().focus().setFontFamily(font.value).run();
              }
            }}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            style={{ fontFamily: font.value || undefined }}
          >
            {font.label}
          </button>
        ))}
      </Dropdown>

      {/* Font size dropdown */}
      <Dropdown
        trigger={
          <span className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 min-w-[40px] justify-between">
            {editor.getAttributes("textStyle").fontSize?.replace("px", "") || "16"}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </span>
        }
        width="w-20"
      >
        {FONT_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => {
              editor.chain().focus().setMark("textStyle", { fontSize: `${size}px` }).run();
            }}
            className="w-full text-left px-3 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {size}
          </button>
        ))}
      </Dropdown>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive("bold")}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive("italic")}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive("underline")}
        title="Underline (Ctrl+U)"
      >
        <Underline className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive("strike")}
        title="Strikethrough"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive("code")}
        title="Inline Code"
      >
        <Code className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => (editor.chain().focus() as any).toggleSuperscript().run()}
        isActive={editor.isActive("superscript")}
        title="Superscript"
      >
        <Superscript className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => (editor.chain().focus() as any).toggleSubscript().run()}
        isActive={editor.isActive("subscript")}
        title="Subscript"
      >
        <Subscript className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Text color */}
      <Dropdown
        trigger={
          <span
            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Text Color"
          >
            <span className="flex flex-col items-center gap-0">
              <Type className="h-3 w-3" />
              <span
                className="h-1 w-3.5 rounded-sm"
                style={{
                  backgroundColor:
                    editor.getAttributes("textStyle").color || "#000000",
                }}
              />
            </span>
          </span>
        }
        width="w-auto"
      >
        <div className="p-1">
          <p className="text-[10px] font-medium text-muted-foreground px-2 py-1">Text Color</p>
          <ColorGrid
            colors={TEXT_COLORS}
            activeColor={editor.getAttributes("textStyle").color}
            onSelect={(color) => editor.chain().focus().setColor(color).run()}
          />
          <button
            onClick={() => editor.chain().focus().unsetColor().run()}
            className="w-full text-left px-3 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-muted-foreground"
          >
            Reset color
          </button>
        </div>
      </Dropdown>

      {/* Highlight color */}
      <Dropdown
        trigger={
          <span
            className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Highlight Color"
          >
            <span className="flex flex-col items-center gap-0">
              <Highlighter className="h-3 w-3" />
              <span
                className="h-1 w-3.5 rounded-sm"
                style={{
                  backgroundColor:
                    editor.getAttributes("highlight").color || "#fef08a",
                }}
              />
            </span>
          </span>
        }
        width="w-auto"
      >
        <div className="p-1">
          <p className="text-[10px] font-medium text-muted-foreground px-2 py-1">Highlight</p>
          <ColorGrid
            colors={HIGHLIGHT_COLORS}
            activeColor={editor.getAttributes("highlight").color}
            onSelect={(color) => {
              if (color === "transparent") {
                editor.chain().focus().unsetHighlight().run();
              } else {
                editor.chain().focus().setHighlight({ color }).run();
              }
            }}
          />
        </div>
      </Dropdown>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        isActive={editor.isActive({ textAlign: "left" })}
        title="Align Left"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        isActive={editor.isActive({ textAlign: "center" })}
        title="Align Center"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        isActive={editor.isActive({ textAlign: "right" })}
        title="Align Right"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign("justify").run()}
        isActive={editor.isActive({ textAlign: "justify" })}
        title="Justify"
      >
        <AlignJustify className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Indent */}
      <ToolbarButton
        onClick={() => {
          if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
            editor.chain().focus().sinkListItem("listItem").run();
          }
        }}
        title="Increase Indent"
      >
        <IndentIncrease className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
            editor.chain().focus().liftListItem("listItem").run();
          }
        }}
        title="Decrease Indent"
      >
        <IndentDecrease className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive("bulletList")}
        title="Bullet List"
      >
        <List className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive("orderedList")}
        title="Numbered List"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive("taskList")}
        title="Checklist"
      >
        <ListChecks className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Block elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive("blockquote")}
        title="Block Quote"
      >
        <Quote className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Line"
      >
        <Minus className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Insert */}
      <ToolbarButton
        onClick={addLink}
        isActive={editor.isActive("link")}
        title="Insert Link (Ctrl+K)"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={addImage} title="Insert Image">
        <ImageIcon className="h-3.5 w-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={addTable} title="Insert Table">
        <TableIcon className="h-3.5 w-3.5" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      {/* Clear formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        title="Clear Formatting"
      >
        <RemoveFormatting className="h-3.5 w-3.5" />
      </ToolbarButton>
    </div>
  );
}
