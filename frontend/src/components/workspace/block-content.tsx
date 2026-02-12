"use client";

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  type KeyboardEvent,
  type FormEvent,
} from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import type { Block, BlockType } from "@/types";

export interface FocusRequest {
  blockId: string;
  placement: "start" | "end" | "offset";
  /** Character offset from the start — used for merge operations */
  offset?: number;
  /** Timestamp to make each request unique, even for the same block */
  _ts?: number;
}

interface BlockContentProps {
  block: Block;
  index: number;
  onContentChange: (blockId: string, content: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>, block: Block) => void;
  onFocus: (blockId: string) => void;
  onMetaChange?: (blockId: string, meta: string) => void;
  focusRequest: FocusRequest | null;
  onFocusHandled: () => void;
}

export function BlockContent({
  block,
  index,
  onContentChange,
  onKeyDown,
  onFocus,
  onMetaChange,
  focusRequest,
  onFocusHandled,
}: BlockContentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const hasFocusRef = useRef(false);

  // Sync content into DOM only when we DON'T have focus
  useEffect(() => {
    if (!ref.current || hasFocusRef.current) return;
    const isCode = block.block_type === "code";
    const dom = isCode ? ref.current.innerText : (ref.current.textContent ?? "");
    const target = block.content ?? "";
    if (dom !== target) {
      if (isCode) {
        ref.current.innerText = target;
      } else {
        ref.current.textContent = target;
      }
    }
  }, [block.content, block.block_type]);

  // Focus management — retries until the DOM element is ready.
  // This handles cases where React hasn't committed the new element yet
  // (e.g., after type change, new block creation, etc.)
  useEffect(() => {
    if (!focusRequest || focusRequest.blockId !== block.id) return;

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 10; // 10 × 20ms = 200ms max wait

    const tryFocus = () => {
      if (cancelled) return;
      const el = ref.current;
      if (!el) {
        // Element not mounted yet — retry
        attempts++;
        if (attempts < maxAttempts) {
          requestAnimationFrame(tryFocus);
        }
        return;
      }

      el.focus();

      // Verify focus actually landed on this element
      if (document.activeElement !== el) {
        attempts++;
        if (attempts < maxAttempts) {
          requestAnimationFrame(tryFocus);
          return;
        }
      }

      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();

        if (focusRequest.placement === "end") {
          range.selectNodeContents(el);
          range.collapse(false);
        } else if (focusRequest.placement === "offset" && focusRequest.offset !== undefined) {
          const textNode = el.childNodes[0];
          if (textNode && textNode.nodeType === Node.TEXT_NODE) {
            const offset = Math.min(focusRequest.offset, textNode.textContent?.length ?? 0);
            range.setStart(textNode, offset);
            range.collapse(true);
          } else if (el.childNodes.length > 0) {
            range.selectNodeContents(el);
            range.collapse(focusRequest.offset === 0);
          } else {
            range.selectNodeContents(el);
            range.collapse(true);
          }
        } else {
          // "start"
          if (el.childNodes.length > 0 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
            range.setStart(el.childNodes[0], 0);
            range.collapse(true);
          } else {
            range.selectNodeContents(el);
            range.collapse(true);
          }
        }

        sel.removeAllRanges();
        sel.addRange(range);
      }

      onFocusHandled();
    };

    // Start with rAF to let current React commit finish
    requestAnimationFrame(tryFocus);

    return () => { cancelled = true; };
  }, [focusRequest, block.id, onFocusHandled]);

  const handleInput = useCallback(
    (e: FormEvent<HTMLDivElement>) => {
      const el = e.target as HTMLDivElement;
      const content = block.block_type === "code" ? el.innerText : (el.textContent ?? "");
      onContentChange(block.id, content);
    },
    [block.id, block.block_type, onContentChange]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => onKeyDown(e, block),
    [block, onKeyDown]
  );

  const handleFocus = useCallback(() => {
    hasFocusRef.current = true;
    onFocus(block.id);
  }, [block.id, onFocus]);

  const handleBlur = useCallback(() => {
    hasFocusRef.current = false;
  }, []);

  // Shared editable props
  const editableProps = {
    ref,
    contentEditable: true as const,
    suppressContentEditableWarning: true as const,
    onInput: handleInput,
    onKeyDown: handleKeyDown,
    onFocus: handleFocus,
    onBlur: handleBlur,
    "data-block-id": block.id,
  };

  // ── Divider ────────────────────────────────────────────────
  if (block.block_type === "divider") {
    return <hr className="my-2 border-border" />;
  }

  // ── Table ──────────────────────────────────────────────────
  if (block.block_type === "table") {
    return (
      <TableBlock
        block={block}
        onMetaChange={onMetaChange}
      />
    );
  }

  // ── Todo ───────────────────────────────────────────────────
  if (block.block_type === "todo") {
    const meta = parseMeta(block.meta_json);
    const checked = meta.checked === true;
    return (
      <div className="flex items-start gap-2 py-0.5">
        <button
          onClick={() =>
            onMetaChange?.(block.id, JSON.stringify({ ...meta, checked: !checked }))
          }
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
            checked
              ? "border-green-500 bg-green-500 text-white"
              : "border-muted-foreground/40 hover:border-foreground"
          }`}
        >
          {checked && <Check className="h-3 w-3" />}
        </button>
        <div
          {...editableProps}
          className={`min-h-[1.5em] flex-1 text-sm outline-none ${
            checked ? "text-muted-foreground line-through" : ""
          }`}
          data-placeholder="Aufgabe..."
        />
      </div>
    );
  }

  // ── Code ───────────────────────────────────────────────────
  if (block.block_type === "code") {
    const meta = parseMeta(block.meta_json);
    return (
      <div className="relative my-1 rounded-md border border-border bg-secondary/30">
        {meta.language ? (
          <span className="absolute right-2 top-1 text-[10px] text-muted-foreground">
            {String(meta.language)}
          </span>
        ) : null}
        <div
          {...editableProps}
          className="min-h-[2em] whitespace-pre-wrap break-words p-3 font-mono text-xs leading-relaxed outline-none"
          data-placeholder="Code eingeben..."
        />
      </div>
    );
  }

  // ── Quote ──────────────────────────────────────────────────
  if (block.block_type === "quote") {
    return (
      <div className="border-l-4 border-muted-foreground/30 pl-4 my-1">
        <div
          {...editableProps}
          className="min-h-[1.5em] text-sm italic text-muted-foreground outline-none"
          data-placeholder="Zitat..."
        />
      </div>
    );
  }

  // ── Bullet list ────────────────────────────────────────────
  if (block.block_type === "bullet_list") {
    return (
      <div className="flex items-start gap-2 py-0.5" style={{ paddingLeft: block.indent_level * 24 }}>
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/60" />
        <div
          {...editableProps}
          className="min-h-[1.5em] flex-1 text-sm outline-none"
          data-placeholder="Listeneintrag..."
        />
      </div>
    );
  }

  // ── Numbered list ──────────────────────────────────────────
  if (block.block_type === "numbered_list") {
    return (
      <div className="flex items-start gap-2 py-0.5" style={{ paddingLeft: block.indent_level * 24 }}>
        <span className="mt-0.5 w-5 shrink-0 text-right text-sm text-muted-foreground">
          {index + 1}.
        </span>
        <div
          {...editableProps}
          className="min-h-[1.5em] flex-1 text-sm outline-none"
          data-placeholder="Listeneintrag..."
        />
      </div>
    );
  }

  // ── Headings + Paragraph ───────────────────────────────────
  const styleMap: Record<string, string> = {
    heading_1: "text-2xl font-bold py-1",
    heading_2: "text-xl font-bold py-0.5",
    heading_3: "text-lg font-semibold py-0.5",
    paragraph: "text-sm py-0.5",
  };

  const placeholderMap: Record<string, string> = {
    heading_1: "Überschrift 1",
    heading_2: "Überschrift 2",
    heading_3: "Überschrift 3",
    paragraph: "Tippe '/' für Befehle...",
  };

  return (
    <div style={{ paddingLeft: block.indent_level * 24 }}>
      <div
        {...editableProps}
        className={`min-h-[1.5em] outline-none ${
          styleMap[block.block_type] ?? styleMap.paragraph
        } empty:before:text-muted-foreground/40 empty:before:content-[attr(data-placeholder)]`}
        data-placeholder={placeholderMap[block.block_type] ?? placeholderMap.paragraph}
      />
    </div>
  );
}

// ─── Table Block ─────────────────────────────────────────────────

interface TableBlockProps {
  block: Block;
  onMetaChange?: (blockId: string, meta: string) => void;
}

interface TableData {
  rows: string[][];
  headerRow?: boolean;
}

function TableBlock({ block, onMetaChange }: TableBlockProps) {
  const [localData, setLocalData] = useState<TableData>(() => parseTableMeta(block.meta_json));
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const parsed = parseTableMeta(block.meta_json);
    setLocalData(parsed);
  }, [block.meta_json]);

  const saveToParent = useCallback(
    (data: TableData) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        onMetaChange?.(block.id, JSON.stringify(data));
      }, 500);
    },
    [block.id, onMetaChange]
  );

  const updateCell = useCallback(
    (rowIdx: number, colIdx: number, value: string) => {
      setLocalData((prev) => {
        const newRows = prev.rows.map((row) => [...row]);
        newRows[rowIdx][colIdx] = value;
        const updated = { ...prev, rows: newRows };
        saveToParent(updated);
        return updated;
      });
    },
    [saveToParent]
  );

  const addRow = useCallback(() => {
    setLocalData((prev) => {
      const cols = prev.rows[0]?.length ?? 2;
      const updated = { ...prev, rows: [...prev.rows, Array(cols).fill("")] };
      saveToParent(updated);
      return updated;
    });
  }, [saveToParent]);

  const addCol = useCallback(() => {
    setLocalData((prev) => {
      const updated = { ...prev, rows: prev.rows.map((row) => [...row, ""]) };
      saveToParent(updated);
      return updated;
    });
  }, [saveToParent]);

  const deleteRow = useCallback(
    (rowIdx: number) => {
      setLocalData((prev) => {
        if (prev.rows.length <= 1) return prev;
        const updated = { ...prev, rows: prev.rows.filter((_, i) => i !== rowIdx) };
        saveToParent(updated);
        return updated;
      });
    },
    [saveToParent]
  );

  const deleteCol = useCallback(
    (colIdx: number) => {
      setLocalData((prev) => {
        if ((prev.rows[0]?.length ?? 0) <= 1) return prev;
        const updated = { ...prev, rows: prev.rows.map((row) => row.filter((_, i) => i !== colIdx)) };
        saveToParent(updated);
        return updated;
      });
    },
    [saveToParent]
  );

  return (
    <div className="my-1 overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">
        <tbody>
          {localData.rows.map((row, rowIdx) => (
            <tr key={rowIdx} className="group/row">
              {row.map((cell, colIdx) => {
                const isHeader = rowIdx === 0 && localData.headerRow !== false;
                const Tag = isHeader ? "th" : "td";
                return (
                  <Tag
                    key={colIdx}
                    className={`relative border border-border px-2 py-1.5 text-left align-top ${
                      isHeader ? "bg-secondary/50 font-medium" : ""
                    }`}
                  >
                    <TableCell
                      value={cell}
                      onChange={(val) => updateCell(rowIdx, colIdx, val)}
                    />
                    {rowIdx === 0 && row.length > 1 && (
                      <button
                        onClick={() => deleteCol(colIdx)}
                        className="absolute -top-5 left-1/2 -translate-x-1/2 rounded bg-secondary p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover/row:opacity-100"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </Tag>
                );
              })}
              <td className="w-6 border-0 p-0 align-middle">
                {localData.rows.length > 1 && (
                  <button
                    onClick={() => deleteRow(rowIdx)}
                    className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover/row:opacity-100"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center border-t border-border">
        <button
          onClick={addRow}
          className="flex flex-1 items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground/50 transition-colors hover:bg-secondary/50 hover:text-muted-foreground"
        >
          <Plus className="h-2.5 w-2.5" /> Zeile
        </button>
        <div className="h-4 w-px bg-border" />
        <button
          onClick={addCol}
          className="flex flex-1 items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground/50 transition-colors hover:bg-secondary/50 hover:text-muted-foreground"
        >
          <Plus className="h-2.5 w-2.5" /> Spalte
        </button>
      </div>
    </div>
  );
}

function TableCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const hasFocus = useRef(false);

  useEffect(() => {
    if (ref.current && !hasFocus.current) {
      if (ref.current.textContent !== value) {
        ref.current.textContent = value;
      }
    }
  }, [value]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className="min-h-[1.2em] min-w-[3rem] outline-none"
      onFocus={() => { hasFocus.current = true; }}
      onBlur={(e) => {
        hasFocus.current = false;
        const text = (e.target as HTMLDivElement).textContent ?? "";
        if (text !== value) onChange(text);
      }}
    />
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function parseTableMeta(metaJson: string | null): TableData {
  if (!metaJson) return { rows: [["", "", ""], ["", "", ""]], headerRow: true };
  try {
    const parsed = JSON.parse(metaJson);
    if (parsed.rows && Array.isArray(parsed.rows)) return parsed as TableData;
    return { rows: [["", "", ""], ["", "", ""]], headerRow: true };
  } catch {
    return { rows: [["", "", ""], ["", "", ""]], headerRow: true };
  }
}

function parseMeta(metaJson: string | null): Record<string, unknown> {
  if (!metaJson) return {};
  try {
    return JSON.parse(metaJson);
  } catch {
    return {};
  }
}
