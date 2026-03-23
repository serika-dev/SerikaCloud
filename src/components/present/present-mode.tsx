"use client";

import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface SlideElement {
  id: string;
  type: "text" | "image" | "shape";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  fontSize?: number;
  fontWeight?: string;
  textAlign?: string;
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  src?: string;
}

interface SlideData {
  id: string;
  order: number;
  content: { elements: SlideElement[] };
  notes: string | null;
  layout: string;
  background: string;
}

interface PresentModeProps {
  slides: SlideData[];
  startIndex: number;
  onExit: () => void;
}

export function PresentMode({ slides, startIndex, onExit }: PresentModeProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [showControls, setShowControls] = useState(false);

  const goNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, slides.length - 1));
  }, [slides.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "Enter":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "Backspace":
          e.preventDefault();
          goPrev();
          break;
        case "Escape":
          onExit();
          break;
        case "f":
        case "F":
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.();
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Try to enter fullscreen
    document.documentElement.requestFullscreen?.().catch(() => {});

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [goNext, goPrev, onExit]);

  const slide = slides[currentIndex];
  if (!slide) return null;

  const elements = slide.content?.elements || [];

  return (
    <div
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center cursor-none"
      onMouseMove={() => {
        setShowControls(true);
        setTimeout(() => setShowControls(false), 3000);
      }}
      onClick={(e) => {
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x > rect.width / 2) {
          goNext();
        } else {
          goPrev();
        }
      }}
    >
      {/* Slide */}
      <div
        className="relative w-full h-full"
        style={{ backgroundColor: slide.background }}
      >
        {elements.map((el) => (
          <div
            key={el.id}
            className="absolute"
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
              width: `${el.width}%`,
              height: `${el.height}%`,
              backgroundColor: el.backgroundColor || "transparent",
              borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
            }}
          >
            {el.type === "text" && (
              <div
                className="w-full h-full flex items-center overflow-hidden p-2"
                style={{
                  fontSize: `${(el.fontSize || 24) * 2}px`,
                  fontWeight: el.fontWeight || "normal",
                  textAlign: (el.textAlign as any) || "center",
                  color: el.color || "#ffffff",
                  justifyContent:
                    el.textAlign === "center"
                      ? "center"
                      : el.textAlign === "right"
                      ? "flex-end"
                      : "flex-start",
                  lineHeight: 1.3,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {el.content}
              </div>
            )}
            {el.type === "image" && el.src && (
              <img
                src={el.src}
                alt=""
                className="w-full h-full object-contain"
                draggable={false}
              />
            )}
            {el.type === "shape" && (
              <div
                className="w-full h-full"
                style={{
                  backgroundColor: el.backgroundColor || "#7c3aed",
                  borderRadius: el.borderRadius
                    ? `${el.borderRadius}px`
                    : undefined,
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Controls overlay */}
      <div
        className={`fixed bottom-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
        style={{ cursor: "default" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-white/60 text-sm font-mono">
          {currentIndex + 1} / {slides.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={goNext}
            disabled={currentIndex === slides.length - 1}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-30 transition-all"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            onClick={onExit}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
