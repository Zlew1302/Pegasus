"use client";

import { useCallback, useState, useRef, useEffect, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { BlockItem } from "./block-item";
import { SlashCommandMenu } from "./slash-command-menu";
import type { FocusRequest } from "./block-content";
import type { Block, BlockType } from "@/types";

// Block types that continue on Enter (list-like blocks)
const CONTINUABLE_TYPES: BlockType[] = ["bullet_list", "numbered_list", "todo"];

interface BlockListProps {
  blocks: Block[];
  focusRequest: FocusRequest | null;
  onFocusHandled: () => void;
  onContentChange: (blockId: string, content: string) => void;
  onMetaChange: (blockId: string, meta: string) => void;
  onChangeType: (blockId: string, type: BlockType) => void;
  onDuplicate: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  onAddBlock: (afterBlockId: string | null, type?: BlockType, tailContent?: string) => void;
  onMergeWithPrevious: (blockId: string) => void;
  onReorder: (activeId: string, overId: string) => void;
  onFocusBlock: (blockId: string, placement: "start" | "end" | "offset", offset?: number) => void;
  /** Notifies parent which block is focused (for floating toolbar) */
  onBlockFocus?: (blockId: string) => void;
}

export function BlockList({
  blocks,
  focusRequest,
  onFocusHandled,
  onContentChange,
  onMetaChange,
  onChangeType,
  onDuplicate,
  onDelete,
  onAddBlock,
  onMergeWithPrevious,
  onReorder,
  onFocusBlock,
  onBlockFocus,
}: BlockListProps) {
  const [slashMenu, setSlashMenu] = useState<{
    blockId: string;
    position: { top: number; left: number };
  } | null>(null);

  // ── Cross-block selection state ──────────────────────────────
  const [selectedBlockIds, setSelectedBlockIds] = useState<Set<string>>(new Set());
  const selectionAnchorRef = useRef<{ blockId: string; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingSelection = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        onReorder(active.id as string, over.id as string);
      }
    },
    [onReorder]
  );

  // ── Cross-block selection via mousedown/mousemove/mouseup ────
  const handleContainerMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      // Only start cross-block selection on left click without modifiers
      if (e.button !== 0) return;

      // Clear previous selection
      setSelectedBlockIds(new Set());

      // Find which block was clicked
      const target = e.target as HTMLElement;
      const blockEl = target.closest("[data-block-item]") as HTMLElement | null;
      if (!blockEl) return;

      const blockId = blockEl.getAttribute("data-block-item");
      if (!blockId) return;

      selectionAnchorRef.current = { blockId, y: e.clientY };
      isDraggingSelection.current = false;
    },
    []
  );

  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!selectionAnchorRef.current || !containerRef.current) return;

      const anchor = selectionAnchorRef.current;
      const dy = Math.abs(e.clientY - anchor.y);

      // Only start selection after 8px vertical movement
      if (dy < 8 && !isDraggingSelection.current) return;

      isDraggingSelection.current = true;

      // Prevent native text selection while doing cross-block
      e.preventDefault();

      // Find all block elements and determine which are between anchor and current pos
      const blockEls = containerRef.current.querySelectorAll<HTMLElement>("[data-block-item]");
      const anchorY = anchor.y;
      const currentY = e.clientY;
      const minY = Math.min(anchorY, currentY);
      const maxY = Math.max(anchorY, currentY);

      const newSelected = new Set<string>();
      blockEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const blockMid = rect.top + rect.height / 2;
        if (blockMid >= minY && blockMid <= maxY) {
          const id = el.getAttribute("data-block-item");
          if (id) newSelected.add(id);
        }
      });

      // Always include anchor block
      newSelected.add(anchor.blockId);

      setSelectedBlockIds(newSelected);
    };

    const handleMouseUp = () => {
      if (isDraggingSelection.current && selectedBlockIds.size > 1) {
        // Keep selection visible — user can see highlighted blocks
      }
      selectionAnchorRef.current = null;
      isDraggingSelection.current = false;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [selectedBlockIds]);

  // Clear selection when user clicks inside a single block (starts typing)
  const handleFocus = useCallback(
    (blockId: string) => {
      if (selectedBlockIds.size > 0) {
        setSelectedBlockIds(new Set());
      }
      // Notify parent which block is focused (for toolbar context)
      onBlockFocus?.(blockId);
    },
    [selectedBlockIds, onBlockFocus]
  );

  // ── Delete selected blocks with Backspace/Delete ─────────────
  useEffect(() => {
    if (selectedBlockIds.size <= 1) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        // Find first non-selected block to focus after deletion
        const firstNonSelected = blocks.find((b) => !selectedBlockIds.has(b.id));
        selectedBlockIds.forEach((id) => onDelete(id));
        setSelectedBlockIds(new Set());
        if (firstNonSelected) {
          onFocusBlock(firstNonSelected.id, "start");
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedBlockIds, blocks, onDelete, onFocusBlock]);

  // ── Keyboard handler ─────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLElement>, block: Block) => {
      const el = e.target as HTMLElement;
      const fullText = el.textContent ?? "";
      const isEmpty = fullText === "";
      const isContinuable = CONTINUABLE_TYPES.includes(block.block_type);

      // ── Cmd+B/I/U: let browser handle natively (execCommand) ──
      if ((e.metaKey || e.ctrlKey) && ["b", "i", "u"].includes(e.key.toLowerCase())) {
        // Don't prevent default — let contentEditable handle the formatting
        // After the formatting is applied, trigger content change to save
        setTimeout(() => {
          const content = block.block_type === "code" ? el.innerText : el.innerHTML;
          onContentChange(block.id, content);
        }, 0);
        return;
      }

      // ── Enter ────────────────────────────────────────────────
      if (e.key === "Enter" && !e.shiftKey) {
        if (block.block_type === "code") return;

        e.preventDefault();

        // Empty continuable → convert to paragraph (double-enter escape)
        if (isContinuable && isEmpty) {
          onChangeType(block.id, "paragraph");
          // Focus is handled by onChangeType → which calls focusBlock
          return;
        }

        // Get cursor position for text split
        const sel = window.getSelection();
        let headText = fullText;
        let tailText = "";

        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (el.contains(range.startContainer)) {
            const preRange = document.createRange();
            preRange.selectNodeContents(el);
            preRange.setEnd(range.startContainer, range.startOffset);
            headText = preRange.toString();
            tailText = fullText.slice(headText.length);
          }
        }

        // Update current block with head text (use innerHTML for rich text)
        if (tailText || isEmpty) {
          onContentChange(block.id, headText);
          el.textContent = headText;
        }

        const newType = isContinuable ? block.block_type : undefined;
        onAddBlock(block.id, newType, tailText);
      }

      // ── Backspace ────────────────────────────────────────────
      if (e.key === "Backspace") {
        const sel = window.getSelection();
        const isAtStart = sel && sel.rangeCount > 0 && (() => {
          const range = sel.getRangeAt(0);
          if (!range.collapsed) return false;
          if (!el.contains(range.startContainer)) return false;
          // Check if cursor is at position 0
          const preRange = document.createRange();
          preRange.selectNodeContents(el);
          preRange.setEnd(range.startContainer, range.startOffset);
          return preRange.toString().length === 0;
        })();

        if (isAtStart) {
          e.preventDefault();

          if (isContinuable) {
            // Convert to paragraph but keep content
            onChangeType(block.id, "paragraph");
            return;
          }

          const idx = blocks.findIndex((b) => b.id === block.id);
          if (idx > 0) {
            if (isEmpty) {
              // Empty block: just delete and focus previous at end
              onFocusBlock(blocks[idx - 1].id, "end");
              onDelete(block.id);
            } else {
              // Non-empty block: merge with previous
              onMergeWithPrevious(block.id);
            }
          }
        }
      }

      // ── Tab ──────────────────────────────────────────────────
      if (e.key === "Tab") e.preventDefault();

      // ── Slash menu ───────────────────────────────────────────
      if (e.key === "/" && isEmpty && block.block_type === "paragraph") {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        setSlashMenu({
          blockId: block.id,
          position: { top: rect.bottom + 4, left: rect.left },
        });
      }

      // ── Arrow Up ─────────────────────────────────────────────
      if (e.key === "ArrowUp") {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (range.collapsed && el.contains(range.startContainer)) {
            const preRange = document.createRange();
            preRange.selectNodeContents(el);
            preRange.setEnd(range.startContainer, range.startOffset);
            if (preRange.toString().length === 0) {
              const idx = blocks.findIndex((b) => b.id === block.id);
              if (idx > 0) {
                e.preventDefault();
                onFocusBlock(blocks[idx - 1].id, "end");
              }
            }
          }
        }
      }

      // ── Arrow Down ───────────────────────────────────────────
      if (e.key === "ArrowDown") {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          if (range.collapsed && el.contains(range.startContainer)) {
            const postRange = document.createRange();
            postRange.selectNodeContents(el);
            postRange.setStart(range.endContainer, range.endOffset);
            if (postRange.toString().length === 0) {
              const idx = blocks.findIndex((b) => b.id === block.id);
              if (idx < blocks.length - 1) {
                e.preventDefault();
                onFocusBlock(blocks[idx + 1].id, "start");
              }
            }
          }
        }
      }
    },
    [blocks, onAddBlock, onDelete, onChangeType, onFocusBlock, onContentChange, onMergeWithPrevious]
  );

  const handleSlashSelect = useCallback(
    (type: BlockType) => {
      if (slashMenu) {
        onChangeType(slashMenu.blockId, type);
        setSlashMenu(null);
        // focusBlock is called inside onChangeType
      }
    },
    [slashMenu, onChangeType]
  );

  const numberedIndices = computeNumberedIndices(blocks);
  const isInsideListRun = computeListRunFlags(blocks);

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={blocks.map((b) => b.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            ref={containerRef}
            className="space-y-px"
            onMouseDown={handleContainerMouseDown}
          >
            {blocks.map((block, idx) => (
              <BlockItem
                key={block.id}
                block={block}
                index={
                  block.block_type === "numbered_list"
                    ? numberedIndices.get(block.id) ?? idx
                    : idx
                }
                focusRequest={focusRequest?.blockId === block.id ? focusRequest : null}
                onFocusHandled={onFocusHandled}
                hideControls={isInsideListRun.get(block.id) ?? false}
                isSelected={selectedBlockIds.has(block.id)}
                onContentChange={onContentChange}
                onMetaChange={onMetaChange}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onChangeType={onChangeType}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                onAddBelow={(id) => onAddBlock(id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {slashMenu && (
        <SlashCommandMenu
          position={slashMenu.position}
          onSelect={handleSlashSelect}
          onClose={() => setSlashMenu(null)}
        />
      )}
    </>
  );
}

function computeNumberedIndices(blocks: Block[]): Map<string, number> {
  const map = new Map<string, number>();
  let counter = 0;
  for (const block of blocks) {
    if (block.block_type === "numbered_list") {
      counter++;
      map.set(block.id, counter - 1);
    } else {
      counter = 0;
    }
  }
  return map;
}

function computeListRunFlags(blocks: Block[]): Map<string, boolean> {
  const map = new Map<string, boolean>();
  const listTypes: BlockType[] = ["bullet_list", "numbered_list", "todo"];
  for (let i = 0; i < blocks.length; i++) {
    const isListType = listTypes.includes(blocks[i].block_type);
    if (!isListType) {
      map.set(blocks[i].id, false);
      continue;
    }
    const prevIsSameType = i > 0 && blocks[i - 1].block_type === blocks[i].block_type;
    map.set(blocks[i].id, prevIsSameType);
  }
  return map;
}
