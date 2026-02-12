"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { Block, Document, DocumentDetail } from "@/types";

// ── Documents for a project ───────────────────────────────────

export function useDocuments(projectId: string | null) {
  const { data, error, mutate } = useSWR<Document[]>(
    projectId ? `/projects/${projectId}/documents` : null,
    fetcher
  );

  const createDocument = async (title: string, icon?: string) => {
    const doc = await apiFetch<DocumentDetail>(
      `/projects/${projectId}/documents`,
      {
        method: "POST",
        body: JSON.stringify({ title, icon }),
      }
    );
    await mutate();
    return doc;
  };

  const deleteDocument = async (docId: string) => {
    await apiFetch(`/documents/${docId}`, { method: "DELETE" });
    await mutate();
  };

  return {
    documents: data ?? [],
    isLoading: !data && !error,
    createDocument,
    deleteDocument,
    mutate,
  };
}

// ── Recent documents (cross-project) ──────────────────────────

export function useRecentDocuments() {
  const { data, error } = useSWR<Document[]>("/documents/recent", fetcher);
  return {
    documents: data ?? [],
    isLoading: !data && !error,
  };
}

// ── Single document with blocks ───────────────────────────────

export function useDocument(documentId: string | null) {
  const { data, error, mutate } = useSWR<DocumentDetail>(
    documentId ? `/documents/${documentId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const updateDocument = async (
    updates: Partial<{ title: string; icon: string; is_pinned: boolean }>
  ) => {
    await apiFetch<DocumentDetail>(
      `/documents/${documentId}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      }
    );
    // Don't mutate SWR — editor manages its own state
  };

  const addBlock = async (
    block: Partial<Block> & { block_type: string; sort_order: number }
  ): Promise<Block> => {
    const created = await apiFetch<Block>(
      `/documents/${documentId}/blocks`,
      {
        method: "POST",
        body: JSON.stringify(block),
      }
    );
    return created;
  };

  const updateBlock = async (
    blockId: string,
    updates: Partial<{
      block_type: string;
      content: string;
      sort_order: number;
      indent_level: number;
      meta_json: string;
    }>
  ) => {
    await apiFetch<Block>(`/blocks/${blockId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    // Don't mutate SWR — editor manages its own state
  };

  const deleteBlock = async (blockId: string) => {
    await apiFetch(`/blocks/${blockId}`, { method: "DELETE" });
    // Don't mutate SWR — editor manages its own state
  };

  const reorderBlocks = async (
    positions: { id: string; sort_order: number }[]
  ) => {
    await apiFetch<Block[]>(
      `/documents/${documentId}/blocks/reorder`,
      {
        method: "PATCH",
        body: JSON.stringify({ positions }),
      }
    );
  };

  return {
    document: data ?? null,
    isLoading: !data && !error,
    updateDocument,
    addBlock,
    updateBlock,
    deleteBlock,
    reorderBlocks,
    mutate,
  };
}
