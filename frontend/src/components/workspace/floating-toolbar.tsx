"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading1,
  Heading2,
  Heading3,
  Palette,
  Type,
} from "lucide-react";

const TEXT_COLORS = [
  { label: "Standard", value: "", class: "" },
  { label: "Grau", value: "hsl(215 16% 57%)", class: "bg-[hsl(215_16%_57%)]" },
  { label: "Orange", value: "hsl(24 95% 53%)", class: "bg-[hsl(24_95%_53%)]" },
  { label: "Gelb", value: "hsl(48 96% 53%)", class: "bg-yellow-500" },
  { label: "Grün", value: "hsl(142 71% 45%)", class: "bg-green-500" },
  { label: "Blau", value: "hsl(199 89% 48%)", class: "bg-[hsl(199_89%_48%)]" },
  { label: "Lila", value: "hsl(270 60% 60%)", class: "bg-purple-500" },
  { label: "Rot", value: "hsl(0 63% 51%)", class: "bg-red-500" },
];

interface FloatingToolbarProps {
  /** Called when the user changes the block type (heading) */
  onBlockTypeChange?: (blockType: string) => void;
  /** Called when alignment changes */
  onAlignmentChange?: (alignment: string) => void;
  /** Current block type for highlight */
  currentBlockType?: string;
}

export function FloatingToolbar({
  onBlockTypeChange,
  onAlignmentChange,
  currentBlockType,
}: FloatingToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [showColors, setShowColors] = useState(false);

  const updatePosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setVisible(false);
      return;
    }

    // Only show toolbar if selection is inside a content-editable block
    const anchor = sel.anchorNode?.parentElement;
    if (!anchor?.closest("[contenteditable]")) {
      setVisible(false);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0) {
      setVisible(false);
      return;
    }

    setPosition({
      top: rect.top - 48,
      left: rect.left + rect.width / 2,
    });
    setVisible(true);
    setShowColors(false);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updatePosition);
    return () => document.removeEventListener("selectionchange", updatePosition);
  }, [updatePosition]);

  // Hide on scroll
  useEffect(() => {
    if (!visible) return;
    const handleScroll = () => setVisible(false);
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [visible]);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    // Keep selection alive
    updatePosition();
  }, [updatePosition]);

  const handleColor = useCallback(
    (color: string) => {
      if (color) {
        execCommand("foreColor", color);
      } else {
        execCommand("removeFormat");
      }
      setShowColors(false);
    },
    [execCommand]
  );

  if (!visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-0.5 rounded-lg border border-border bg-card px-1 py-0.5 shadow-2xl"
      style={{
        top: Math.max(8, position.top),
        left: Math.min(Math.max(160, position.left), (typeof window !== "undefined" ? window.innerWidth : 1200) - 160),
        transform: "translateX(-50%)",
      }}
      onMouseDown={(e) => e.preventDefault()} // Prevent losing selection
    >
      {/* Inline formatting */}
      <ToolbarButton
        icon={Bold}
        title="Fett (Cmd+B)"
        onClick={() => execCommand("bold")}
      />
      <ToolbarButton
        icon={Italic}
        title="Kursiv (Cmd+I)"
        onClick={() => execCommand("italic")}
      />
      <ToolbarButton
        icon={Underline}
        title="Unterstrichen (Cmd+U)"
        onClick={() => execCommand("underline")}
      />
      <ToolbarButton
        icon={Strikethrough}
        title="Durchgestrichen"
        onClick={() => execCommand("strikeThrough")}
      />

      <div className="mx-0.5 h-4 w-px bg-border" />

      {/* Block type (headings) */}
      {onBlockTypeChange && (
        <>
          <ToolbarButton
            icon={Type}
            title="Absatz"
            active={currentBlockType === "paragraph"}
            onClick={() => onBlockTypeChange("paragraph")}
          />
          <ToolbarButton
            icon={Heading1}
            title="Überschrift 1"
            active={currentBlockType === "heading_1"}
            onClick={() => onBlockTypeChange("heading_1")}
          />
          <ToolbarButton
            icon={Heading2}
            title="Überschrift 2"
            active={currentBlockType === "heading_2"}
            onClick={() => onBlockTypeChange("heading_2")}
          />
          <ToolbarButton
            icon={Heading3}
            title="Überschrift 3"
            active={currentBlockType === "heading_3"}
            onClick={() => onBlockTypeChange("heading_3")}
          />

          <div className="mx-0.5 h-4 w-px bg-border" />
        </>
      )}

      {/* Alignment */}
      {onAlignmentChange && (
        <>
          <ToolbarButton
            icon={AlignLeft}
            title="Linksbündig"
            onClick={() => onAlignmentChange("left")}
          />
          <ToolbarButton
            icon={AlignCenter}
            title="Zentriert"
            onClick={() => onAlignmentChange("center")}
          />
          <ToolbarButton
            icon={AlignRight}
            title="Rechtsbündig"
            onClick={() => onAlignmentChange("right")}
          />
          <ToolbarButton
            icon={AlignJustify}
            title="Blocksatz"
            onClick={() => onAlignmentChange("justify")}
          />

          <div className="mx-0.5 h-4 w-px bg-border" />
        </>
      )}

      {/* Color */}
      <div className="relative">
        <ToolbarButton
          icon={Palette}
          title="Textfarbe"
          onClick={() => setShowColors(!showColors)}
        />
        {showColors && (
          <div className="absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 rounded-lg border border-border bg-card p-2 shadow-xl">
            <p className="mb-1 text-[10px] font-medium text-muted-foreground">Farbe</p>
            <div className="flex gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.label}
                  title={c.label}
                  onClick={() => handleColor(c.value)}
                  className={`h-5 w-5 rounded-full border border-border transition-transform hover:scale-125 ${
                    c.value ? c.class : "bg-foreground"
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Button ──────────────────────────────────────────────────────

function ToolbarButton({
  icon: Icon,
  title,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
