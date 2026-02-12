"use client";

import {
  MoreHorizontal,
  Copy,
  Trash2,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Minus,
  Quote,
  Bot,
  Table,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { BlockType } from "@/types";

const TYPES: { type: BlockType; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { type: "paragraph", label: "Text", Icon: Type },
  { type: "heading_1", label: "H1", Icon: Heading1 },
  { type: "heading_2", label: "H2", Icon: Heading2 },
  { type: "heading_3", label: "H3", Icon: Heading3 },
  { type: "bullet_list", label: "Liste", Icon: List },
  { type: "numbered_list", label: "Num.", Icon: ListOrdered },
  { type: "todo", label: "Todo", Icon: CheckSquare },
  { type: "code", label: "Code", Icon: Code },
  { type: "divider", label: "Linie", Icon: Minus },
  { type: "quote", label: "Zitat", Icon: Quote },
  { type: "table", label: "Tabelle", Icon: Table },
  { type: "agent", label: "Agent", Icon: Bot },
];

interface BlockTypeMenuProps {
  currentType: BlockType;
  onChangeType: (type: BlockType) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Notify parent when menu opens/closes so it can keep controls visible */
  onOpenChange?: (open: boolean) => void;
}

export function BlockTypeMenu({
  currentType,
  onChangeType,
  onDuplicate,
  onDelete,
  onOpenChange,
}: BlockTypeMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Notify parent of open state changes
  const updateOpen = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        updateOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => updateOpen(!open)}
        className="rounded p-0.5 text-muted-foreground/50 transition-colors hover:bg-secondary hover:text-foreground"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-xl">
          <p className="px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground">
            Block-Typ
          </p>
          <div className="max-h-48 overflow-y-auto">
            {TYPES.map(({ type, label, Icon }) => (
              <button
                key={type}
                onClick={() => {
                  onChangeType(type);
                  updateOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-2 py-1 text-xs transition-colors ${
                  type === currentType
                    ? "bg-accent/50 text-accent-foreground"
                    : "hover:bg-secondary/50"
                }`}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          <div className="my-1 border-t border-border" />

          <button
            onClick={() => {
              onDuplicate();
              updateOpen(false);
            }}
            className="flex w-full items-center gap-2 px-2 py-1 text-xs hover:bg-secondary/50"
          >
            <Copy className="h-3 w-3" />
            Duplizieren
          </button>
          <button
            onClick={() => {
              onDelete();
              updateOpen(false);
            }}
            className="flex w-full items-center gap-2 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-3 w-3" />
            Löschen
          </button>
        </div>
      )}
    </div>
  );
}
