"use client";

import { useState, useRef, useCallback, type KeyboardEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { BlockContent, type FocusRequest } from "./block-content";
import { BlockTypeMenu } from "./block-type-menu";
import type { Block, BlockType } from "@/types";

interface BlockItemProps {
  block: Block;
  index: number;
  focusRequest: FocusRequest | null;
  onFocusHandled: () => void;
  hideControls: boolean;
  isSelected: boolean;
  onContentChange: (blockId: string, content: string) => void;
  onMetaChange: (blockId: string, meta: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLElement>, block: Block) => void;
  onFocus: (blockId: string) => void;
  onChangeType: (blockId: string, type: BlockType) => void;
  onDuplicate: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  onAddBelow: (blockId: string) => void;
}

export function BlockItem({
  block,
  index,
  focusRequest,
  onFocusHandled,
  hideControls,
  isSelected,
  onContentChange,
  onMetaChange,
  onKeyDown,
  onFocus,
  onChangeType,
  onDuplicate,
  onDelete,
  onAddBelow,
}: BlockItemProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // Delayed hide: 400ms grace period so user can reach controls
  const showControls = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setHovered(true);
  }, []);

  const scheduleHide = useCallback(() => {
    // Never hide controls while the block-type menu is open
    if (menuOpen) return;
    hideTimerRef.current = setTimeout(() => {
      setHovered(false);
    }, 400);
  }, [menuOpen]);

  const isNonEditable = block.block_type === "table" || block.block_type === "divider";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${isSelected ? "bg-accent/30 rounded" : ""}`}
      data-block-item={block.id}
      onMouseEnter={showControls}
      onMouseLeave={scheduleHide}
    >
      {/* Left controls */}
      {!hideControls && (
        <div
          className={`absolute -left-24 top-0 flex select-none items-center gap-0.5 pr-4 pt-0.5 transition-opacity duration-100 ${
            hovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onMouseEnter={showControls}
          onMouseLeave={scheduleHide}
        >
          <button
            onClick={() => onAddBelow(block.id)}
            className="rounded p-1 text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground"
            title="Block hinzufügen"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab rounded p-1 text-muted-foreground/40 transition-colors hover:bg-secondary hover:text-foreground active:cursor-grabbing"
            title="Verschieben"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>
          <BlockTypeMenu
            currentType={block.block_type}
            onChangeType={(type) => onChangeType(block.id, type)}
            onDuplicate={() => onDuplicate(block.id)}
            onDelete={() => onDelete(block.id)}
            onOpenChange={setMenuOpen}
          />
        </div>
      )}

      {/* Inline delete for non-editable blocks */}
      {isNonEditable && (
        <button
          onClick={() => onDelete(block.id)}
          className={`absolute -right-8 top-1 rounded p-1 text-muted-foreground/40 transition-all hover:bg-red-500/10 hover:text-red-400 ${
            hovered ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          title="Block löschen"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Content */}
      <div className="min-w-0 py-px">
        <BlockContent
          block={block}
          index={index}
          onContentChange={onContentChange}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onMetaChange={onMetaChange}
          focusRequest={focusRequest}
          onFocusHandled={onFocusHandled}
        />
      </div>
    </div>
  );
}
