"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, Check } from "lucide-react";
import { useDocument } from "@/hooks/use-documents";
import { BlockList } from "./block-list";
import { FloatingToolbar } from "./floating-toolbar";
import type { FocusRequest } from "./block-content";
import type { Block, BlockType } from "@/types";

interface DocumentEditorProps {
  documentId: string;
}

/**
 * Main Document Editor.
 *
 * Architecture: Local-first.
 * - SWR loads the doc once on mount → copied into local state.
 * - All edits happen instantly in local state (no network delay).
 * - A debounced save flushes dirty changes to the API.
 *
 * Focus system:
 * - Uses a FocusRequest ref pattern instead of state to avoid React batching issues.
 * - focusRequest is set, then a counter (focusVersion) triggers a re-render.
 * - BlockContent consumes the request once and calls onFocusHandled to clear it.
 */
export function DocumentEditor({ documentId }: DocumentEditorProps) {
  const {
    document: serverDoc,
    isLoading,
    updateDocument,
    addBlock: apiAddBlock,
    updateBlock: apiUpdateBlock,
    deleteBlock: apiDeleteBlock,
    reorderBlocks: apiReorderBlocks,
  } = useDocument(documentId);

  // ── Local state ──────────────────────────────────────────────
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("idle");

  // Focus system: ref holds the request, state counter triggers render
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const pendingFocusRef = useRef<FocusRequest | null>(null);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const titleHasFocusRef = useRef(false);
  const dirtyBlocksRef = useRef<Set<string>>(new Set());
  const dirtyTitleRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksRef = useRef<Block[]>(blocks);

  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  /**
   * Request focus on a block.
   * Sets the request directly in state — BlockContent will pick it up
   * once it mounts/renders with the matching block ID and retry until
   * the DOM element is ready.
   */
  const focusBlock = useCallback(
    (id: string, placement: "start" | "end" | "offset", offset?: number) => {
      const req: FocusRequest = { blockId: id, placement, offset, _ts: Date.now() };
      pendingFocusRef.current = req;
      setFocusRequest(req);
    },
    []
  );

  const handleFocusHandled = useCallback(() => {
    pendingFocusRef.current = null;
    setFocusRequest(null);
  }, []);

  // ── Initialize from server ───────────────────────────────────
  useEffect(() => {
    if (serverDoc && !initialized) {
      const sorted = [...serverDoc.blocks].sort((a, b) => a.sort_order - b.sort_order);
      setBlocks(sorted);
      setTitle(serverDoc.title);
      setInitialized(true);
    }
  }, [serverDoc, initialized]);

  useEffect(() => {
    if (initialized && titleRef.current && !titleHasFocusRef.current) {
      titleRef.current.textContent = title;
    }
  }, [initialized]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced background save ────────────────────────────────
  const scheduleSave = useCallback(() => {
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      flushSave();
    }, 1200);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flushSave = useCallback(async () => {
    try {
      if (dirtyTitleRef.current && titleRef.current) {
        const t = titleRef.current.textContent ?? "";
        await updateDocument({ title: t });
        dirtyTitleRef.current = false;
      }

      const dirtyIds = Array.from(dirtyBlocksRef.current);
      dirtyBlocksRef.current.clear();
      const currentBlocks = blocksRef.current;

      for (const id of dirtyIds) {
        if (id.startsWith("temp-")) continue;
        const block = currentBlocks.find((b) => b.id === id);
        if (!block) continue;
        await apiUpdateBlock(id, {
          content: block.content ?? "",
          meta_json: block.meta_json ?? undefined,
        });
      }

      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
    }
  }, [updateDocument, apiUpdateBlock]);

  const handleTitleInput = useCallback(() => {
    dirtyTitleRef.current = true;
    scheduleSave();
  }, [scheduleSave]);

  // ── Block content change ─────────────────────────────────────
  const handleContentChange = useCallback(
    (blockId: string, content: string) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, content } : b))
      );
      dirtyBlocksRef.current.add(blockId);
      scheduleSave();
    },
    [scheduleSave]
  );

  const handleMetaChange = useCallback(
    (blockId: string, metaJson: string) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, meta_json: metaJson } : b))
      );
      dirtyBlocksRef.current.add(blockId);
      scheduleSave();
    },
    [scheduleSave]
  );

  // ── Track focused block for toolbar ─────────────────────────
  const handleBlockFocus = useCallback(
    (blockId: string) => {
      setFocusedBlockId(blockId);
    },
    []
  );

  const focusedBlock = blocks.find((b) => b.id === focusedBlockId);

  // ── Change block type ────────────────────────────────────────
  const handleChangeType = useCallback(
    (blockId: string, type: BlockType) => {
      let metaJson: string | null = null;
      if (type === "table") {
        metaJson = JSON.stringify({ rows: [["", "", ""], ["", "", ""]], headerRow: true });
      }
      setBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? { ...b, block_type: type, ...(metaJson !== null ? { meta_json: metaJson } : {}) }
            : b
        )
      );

      // Focus the block after type change — rAF ensures DOM is ready
      focusBlock(blockId, "start");

      const updates: Record<string, unknown> = { block_type: type };
      if (metaJson !== null) updates.meta_json = metaJson;
      apiUpdateBlock(blockId, updates);
    },
    [apiUpdateBlock, focusBlock]
  );

  // ── Toolbar: block type change (heading etc.) ──────────────
  const handleToolbarBlockTypeChange = useCallback(
    (blockType: string) => {
      if (!focusedBlockId) return;
      handleChangeType(focusedBlockId, blockType as BlockType);
    },
    [focusedBlockId, handleChangeType]
  );

  // ── Toolbar: alignment change ──────────────────────────────
  const handleToolbarAlignmentChange = useCallback(
    (alignment: string) => {
      if (!focusedBlockId) return;
      const block = blocksRef.current.find((b) => b.id === focusedBlockId);
      if (!block) return;
      let meta: Record<string, unknown> = {};
      try { meta = block.meta_json ? JSON.parse(block.meta_json) : {}; } catch { /* empty */ }
      const newMeta = JSON.stringify({ ...meta, alignment });
      handleMetaChange(focusedBlockId, newMeta);
    },
    [focusedBlockId, handleMetaChange]
  );

  // ── Add block ────────────────────────────────────────────────
  const handleAddBlock = useCallback(
    async (afterBlockId: string | null, type?: BlockType, tailContent?: string) => {
      const blockType = type ?? "paragraph";
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      let metaJson: string | null = null;
      if (blockType === "table") {
        metaJson = JSON.stringify({ rows: [["", "", ""], ["", "", ""]], headerRow: true });
      }

      const newContent = tailContent ?? "";

      setBlocks((prev) => {
        const sorted = [...prev].sort((a, b) => a.sort_order - b.sort_order);
        let insertIdx = sorted.length;
        if (afterBlockId) {
          const foundIdx = sorted.findIndex((b) => b.id === afterBlockId);
          if (foundIdx >= 0) insertIdx = foundIdx + 1;
        }

        const tempBlock: Block = {
          id: tempId,
          document_id: documentId,
          block_type: blockType as Block["block_type"],
          content: newContent,
          sort_order: 0,
          indent_level: 0,
          meta_json: metaJson,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        sorted.splice(insertIdx, 0, tempBlock);
        return sorted.map((b, i) => ({ ...b, sort_order: i }));
      });

      // Focus new block at start (tail content renders there)
      focusBlock(tempId, "start");

      // Compute sort_order for API
      const sorted = [...blocksRef.current].sort((a, b) => a.sort_order - b.sort_order);
      let newOrder = 0;
      if (afterBlockId) {
        const idx = sorted.findIndex((b) => b.id === afterBlockId);
        if (idx >= 0) {
          const current = sorted[idx].sort_order;
          const next = idx + 1 < sorted.length ? sorted[idx + 1].sort_order : current + 2;
          newOrder = Math.floor((current + next) / 2);
          if (newOrder === current) newOrder = current + 1;
        }
      } else {
        newOrder = sorted.length > 0 ? sorted[sorted.length - 1].sort_order + 1 : 0;
      }

      try {
        const created = await apiAddBlock({
          block_type: blockType,
          content: newContent,
          sort_order: newOrder,
          ...(metaJson !== null ? { meta_json: metaJson } : {}),
        });
        setBlocks((prev) =>
          prev.map((b) => (b.id === tempId ? { ...created } : b))
        );
        // Re-focus with the real ID
        focusBlock(created.id, "start");
      } catch {
        setBlocks((prev) => prev.filter((b) => b.id !== tempId));
      }
    },
    [documentId, apiAddBlock, focusBlock]
  );

  // ── Merge block with previous (Backspace on non-empty block at position 0) ──
  const handleMergeWithPrevious = useCallback(
    (blockId: string) => {
      const currentBlocks = blocksRef.current;
      const idx = currentBlocks.findIndex((b) => b.id === blockId);
      if (idx <= 0) return;

      const prevBlock = currentBlocks[idx - 1];
      const currentBlock = currentBlocks[idx];

      // Can't merge into a table/divider
      if (prevBlock.block_type === "table" || prevBlock.block_type === "divider") {
        focusBlock(prevBlock.id, "end");
        return;
      }

      const prevContent = prevBlock.content ?? "";
      const curContent = currentBlock.content ?? "";
      const mergedContent = prevContent + curContent;
      const cursorOffset = prevContent.length; // cursor at the merge point

      // Update previous block content
      setBlocks((prev) =>
        prev
          .map((b) => (b.id === prevBlock.id ? { ...b, content: mergedContent } : b))
          .filter((b) => b.id !== blockId)
      );

      dirtyBlocksRef.current.add(prevBlock.id);
      scheduleSave();

      // Focus at the exact merge point
      focusBlock(prevBlock.id, "offset", cursorOffset);

      // Delete from API
      if (!blockId.startsWith("temp-")) {
        apiDeleteBlock(blockId);
      }
    },
    [focusBlock, scheduleSave, apiDeleteBlock]
  );

  const handleDuplicate = useCallback(
    async (blockId: string) => {
      const block = blocksRef.current.find((b) => b.id === blockId);
      if (!block) return;
      await handleAddBlock(blockId, block.block_type as BlockType);
    },
    [handleAddBlock]
  );

  const handleDelete = useCallback(
    (blockId: string) => {
      setBlocks((prev) => prev.filter((b) => b.id !== blockId));
      dirtyBlocksRef.current.delete(blockId);
      if (!blockId.startsWith("temp-")) {
        apiDeleteBlock(blockId);
      }
    },
    [apiDeleteBlock]
  );

  const handleReorder = useCallback(
    (activeId: string, overId: string) => {
      setBlocks((prev) => {
        const sorted = [...prev].sort((a, b) => a.sort_order - b.sort_order);
        const oldIdx = sorted.findIndex((b) => b.id === activeId);
        const newIdx = sorted.findIndex((b) => b.id === overId);
        if (oldIdx < 0 || newIdx < 0) return prev;

        const [moved] = sorted.splice(oldIdx, 1);
        sorted.splice(newIdx, 0, moved);

        const reordered = sorted.map((b, i) => ({ ...b, sort_order: i }));
        apiReorderBlocks(reordered.map((b) => ({ id: b.id, sort_order: b.sort_order })));
        return reordered;
      });
    },
    [apiReorderBlocks]
  );

  if (isLoading || !initialized) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4">
      {/* Save status */}
      <div className="mb-4 flex items-center justify-end gap-2 h-5">
        {saveStatus === "saving" && (
          <>
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Speichert...</span>
          </>
        )}
        {saveStatus === "saved" && (
          <>
            <Check className="h-3 w-3 text-green-500" />
            <span className="text-xs text-green-500">Gespeichert</span>
          </>
        )}
      </div>

      {/* Title */}
      <h1
        ref={titleRef}
        contentEditable
        suppressContentEditableWarning
        className="mb-6 text-4xl font-bold outline-none empty:before:text-muted-foreground/30 empty:before:content-[attr(data-placeholder)]"
        data-placeholder="Titel eingeben..."
        onInput={handleTitleInput}
        onFocus={() => { titleHasFocusRef.current = true; }}
        onBlur={() => { titleHasFocusRef.current = false; }}
      />

      {/* Floating Rich-Text Toolbar */}
      <FloatingToolbar
        onBlockTypeChange={handleToolbarBlockTypeChange}
        onAlignmentChange={handleToolbarAlignmentChange}
        currentBlockType={focusedBlock?.block_type}
      />

      {/* Blocks */}
      <BlockList
        blocks={blocks}
        focusRequest={focusRequest}
        onFocusHandled={handleFocusHandled}
        onContentChange={handleContentChange}
        onMetaChange={handleMetaChange}
        onChangeType={handleChangeType}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        onAddBlock={handleAddBlock}
        onMergeWithPrevious={handleMergeWithPrevious}
        onReorder={handleReorder}
        onFocusBlock={focusBlock}
        onBlockFocus={handleBlockFocus}
      />

      {/* Add block at end */}
      <button
        onClick={() => handleAddBlock(null)}
        className="mt-4 w-full rounded-md border border-dashed border-border/50 py-3 text-center text-xs text-muted-foreground/50 transition-colors hover:border-border hover:text-muted-foreground"
      >
        + Block hinzufügen
      </button>

      {/* Scroll padding */}
      <div className="min-h-[60vh]" />
    </div>
  );
}
