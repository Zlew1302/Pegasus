"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
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
  Image,
  Table,
} from "lucide-react";
import type { BlockType } from "@/types";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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
  Image,
  Table,
};

interface SlashMenuItem {
  type: BlockType;
  label: string;
  icon: string;
  description: string;
}

const MENU_ITEMS: SlashMenuItem[] = [
  { type: "paragraph", label: "Text", icon: "Type", description: "Normaler Absatz" },
  { type: "heading_1", label: "Überschrift 1", icon: "Heading1", description: "Große Überschrift" },
  { type: "heading_2", label: "Überschrift 2", icon: "Heading2", description: "Mittlere Überschrift" },
  { type: "heading_3", label: "Überschrift 3", icon: "Heading3", description: "Kleine Überschrift" },
  { type: "bullet_list", label: "Aufzählung", icon: "List", description: "Aufzählungsliste" },
  { type: "numbered_list", label: "Nummerierte Liste", icon: "ListOrdered", description: "Nummerierte Liste" },
  { type: "todo", label: "Aufgabe", icon: "CheckSquare", description: "Checkbox-Aufgabe" },
  { type: "code", label: "Code", icon: "Code", description: "Code-Block" },
  { type: "divider", label: "Trennlinie", icon: "Minus", description: "Horizontale Linie" },
  { type: "quote", label: "Zitat", icon: "Quote", description: "Zitatblock" },
  { type: "table", label: "Tabelle", icon: "Table", description: "Tabelle mit Zeilen & Spalten" },
  { type: "agent", label: "Agent-Block", icon: "Bot", description: "KI-Agent einbetten" },
];

interface SlashCommandMenuProps {
  position: { top: number; left: number };
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export function SlashCommandMenu({
  position,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  const [filter, setFilter] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = MENU_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(filter.toLowerCase()) ||
      item.description.toLowerCase().includes(filter.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [filter]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[activeIndex]) {
          onSelect(filtered[activeIndex].type);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, activeIndex, onSelect, onClose]
  );

  // Ensure menu stays within viewport — flip above if not enough space below
  const menuHeight = 340; // max-h-64 (256px) + input + padding
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const fitsBelow = position.top + menuHeight < viewportH;
  const adjustedTop = fitsBelow ? position.top : Math.max(8, position.top - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 rounded-lg border border-border bg-card shadow-xl"
      style={{ top: adjustedTop, left: position.left }}
    >
      <div className="p-2">
        <input
          ref={inputRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Block-Typ suchen..."
          className="w-full rounded-md bg-secondary/50 px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50"
        />
      </div>
      <div className="max-h-64 overflow-y-auto px-1 pb-1">
        {filtered.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">
            Kein Ergebnis
          </p>
        ) : (
          filtered.map((item, idx) => {
            const Icon = ICON_MAP[item.icon] ?? Type;
            return (
              <button
                key={item.type}
                onClick={() => onSelect(item.type)}
                onMouseEnter={() => setActiveIndex(idx)}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors ${
                  idx === activeIndex
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground hover:bg-secondary/50"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
