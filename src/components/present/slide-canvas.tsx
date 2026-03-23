"use client";

import { useState, useRef, useCallback } from "react";

export interface SlideElement {
  id: string;
  type: "text" | "image" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: string;
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  borderColor?: string;
  borderWidth?: number;
  opacity?: number;
  rotation?: number;
  src?: string;
}

export interface SlideData {
  id: string;
  order: number;
  content: { elements: SlideElement[] };
  notes: string | null;
  layout: string;
  background: string;
}

interface SlideCanvasProps {
  slide: SlideData;
  onUpdateElements?: (elements: SlideElement[]) => void;
  onSelectElement?: (id: string | null) => void;
  selectedElementId?: string | null;
  isEditing?: boolean;
  scale?: number;
}

type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", se: "nwse-resize",
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
};

export function SlideCanvas({
  slide,
  onUpdateElements,
  onSelectElement,
  selectedElementId,
  isEditing = false,
  scale = 1,
}: SlideCanvasProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const elements = slide.content?.elements || [];

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      onSelectElement?.(null);
      setEditingId(null);
    }
  };

  const handleElementMouseDown = (e: React.MouseEvent, el: SlideElement) => {
    if (!isEditing || editingId === el.id) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectElement?.(el.id);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (me: MouseEvent) => {
      const dx = ((me.clientX - startX) / rect.width) * 100;
      const dy = ((me.clientY - startY) / rect.height) * 100;
      const updated = elements.map((elem) =>
        elem.id === el.id
          ? {
              ...elem,
              x: Math.max(0, Math.min(100 - elem.width, el.x + dx)),
              y: Math.max(0, Math.min(100 - elem.height, el.y + dy)),
            }
          : elem
      );
      onUpdateElements?.(updated);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    el: SlideElement,
    handle: ResizeHandle
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX;
    const startY = e.clientY;

    const handleMouseMove = (me: MouseEvent) => {
      const dx = ((me.clientX - startX) / rect.width) * 100;
      const dy = ((me.clientY - startY) / rect.height) * 100;

      let { x, y, width, height } = el;

      if (handle.includes("e")) { width = Math.max(5, el.width + dx); }
      if (handle.includes("w")) { width = Math.max(5, el.width - dx); x = el.x + dx; }
      if (handle.includes("s")) { height = Math.max(3, el.height + dy); }
      if (handle.includes("n")) { height = Math.max(3, el.height - dy); y = el.y + dy; }

      const updated = elements.map((elem) =>
        elem.id === el.id ? { ...elem, x, y, width, height } : elem
      );
      onUpdateElements?.(updated);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleDoubleClick = (el: SlideElement) => {
    if (!isEditing) return;
    if (el.type === "text") {
      setEditingId(el.id);
    } else if (el.type === "image") {
      const url = window.prompt("Enter image URL:", el.src || "");
      if (url !== null) {
        const updated = elements.map((elem) =>
          elem.id === el.id ? { ...elem, src: url } : elem
        );
        onUpdateElements?.(updated);
      }
    }
  };

  const handleTextChange = (id: string, value: string) => {
    const updated = elements.map((el) =>
      el.id === id ? { ...el, content: value } : el
    );
    onUpdateElements?.(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (editingId) return;
      if (!selectedElementId || !isEditing) return;
      const updated = elements.filter((el) => el.id !== selectedElementId);
      onUpdateElements?.(updated);
      onSelectElement?.(null);
    }
    if (e.key === "Escape") {
      onSelectElement?.(null);
      setEditingId(null);
    }
  };

  return (
    <div
      ref={canvasRef}
      className="relative select-none outline-none"
      style={{
        width: `${960 * scale}px`,
        height: `${540 * scale}px`,
        backgroundColor: slide.background,
        borderRadius: "6px",
        boxShadow: "0 4px 32px rgba(0,0,0,0.3)",
        overflow: "hidden",
      }}
      onClick={handleCanvasClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {elements.map((el) => {
        const isSelected = selectedElementId === el.id && isEditing;
        const isEditingThis = editingId === el.id;

        return (
          <div
            key={el.id}
            className={`absolute group ${isEditing ? "cursor-move" : ""}`}
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: `${el.width}%`,
              height: `${el.height}%`,
              opacity: el.opacity ?? 1,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            }}
            onMouseDown={(e) => handleElementMouseDown(e, el)}
            onDoubleClick={() => handleDoubleClick(el)}
          >
            {/* Selection border */}
            {isSelected && (
              <div className="absolute inset-0 border-2 border-blue-500 pointer-events-none z-10" />
            )}

            {/* Resize handles */}
            {isSelected && !isEditingThis && (
              <>
                {(["nw", "ne", "sw", "se", "n", "s", "e", "w"] as ResizeHandle[]).map(
                  (handle) => {
                    const pos: React.CSSProperties = {};
                    if (handle.includes("n")) pos.top = "-4px";
                    if (handle.includes("s")) pos.bottom = "-4px";
                    if (handle.includes("w")) pos.left = "-4px";
                    if (handle.includes("e")) pos.right = "-4px";
                    if (handle === "n" || handle === "s") {
                      pos.left = "50%";
                      pos.transform = "translateX(-50%)";
                    }
                    if (handle === "e" || handle === "w") {
                      pos.top = "50%";
                      pos.transform = "translateY(-50%)";
                    }
                    return (
                      <div
                        key={handle}
                        className="absolute z-20 h-2 w-2 rounded-full bg-white border-2 border-blue-500"
                        style={{ ...pos, cursor: HANDLE_CURSORS[handle] }}
                        onMouseDown={(e) => handleResizeMouseDown(e, el, handle)}
                      />
                    );
                  }
                )}
              </>
            )}

            {/* Element content */}
            {el.type === "text" &&
              (isEditingThis ? (
                <textarea
                  value={el.content}
                  onChange={(e) => handleTextChange(el.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                  autoFocus
                  className="w-full h-full bg-transparent outline-none resize-none p-2"
                  style={{
                    fontSize: `${(el.fontSize || 24) * scale}px`,
                    fontWeight: el.fontWeight || "normal",
                    fontFamily: el.fontFamily || "inherit",
                    textAlign: (el.textAlign as any) || "center",
                    color: el.color || "#ffffff",
                    lineHeight: 1.4,
                  }}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center overflow-hidden p-2"
                  style={{
                    fontSize: `${(el.fontSize || 24) * scale}px`,
                    fontWeight: el.fontWeight || "normal",
                    fontFamily: el.fontFamily || "inherit",
                    textAlign: (el.textAlign as any) || "center",
                    color: el.color || "#ffffff",
                    justifyContent:
                      el.textAlign === "center"
                        ? "center"
                        : el.textAlign === "right"
                          ? "flex-end"
                          : "flex-start",
                    lineHeight: 1.4,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {el.content || (isEditing ? "Click to edit" : "")}
                </div>
              ))}

            {el.type === "image" &&
              (el.src ? (
                <img
                  src={el.src}
                  alt=""
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full border-2 border-dashed border-white/30 rounded-lg flex items-center justify-center text-white/40 text-xs">
                  Double-click to set image
                </div>
              ))}

            {el.type === "shape" && (
              <div
                className="w-full h-full"
                style={{
                  backgroundColor: el.backgroundColor || "#7c3aed",
                  borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
                  border: el.borderWidth
                    ? `${el.borderWidth}px solid ${el.borderColor || "#ffffff"}`
                    : undefined,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
