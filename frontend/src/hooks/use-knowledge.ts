"use client";

import { useCallback, useState } from "react";
import useSWR from "swr";

import { apiFetch, fetcher } from "@/lib/api";
import type {
  KnowledgeDocument,
  KnowledgeSearchResult,
  KnowledgeStats,
} from "@/types";

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

/**
 * Hook for managing the knowledge base — upload, list, delete, search.
 */
export function useKnowledge(projectId?: string) {
  const [isUploading, setIsUploading] = useState(false);

  // Fetch documents — optionally filtered by project
  const queryParams = projectId ? `?project_id=${projectId}` : "";
  const {
    data: rawDocuments,
    mutate: mutateDocuments,
    isLoading: isLoadingDocs,
  } = useSWR<PaginatedResponse<KnowledgeDocument>>(
    `/knowledge/documents${queryParams}`,
    fetcher,
    {
      // Poll when any doc is processing
      refreshInterval: (data) =>
        data?.items?.some((d) => d.status === "processing") ? 3000 : 0,
      revalidateOnFocus: false,
      isPaused: () => typeof document !== "undefined" && document.hidden,
    }
  );

  const documents = rawDocuments?.items ?? [];

  // Fetch stats
  const { data: stats, mutate: mutateStats } = useSWR<KnowledgeStats>(
    `/knowledge/stats`,
    fetcher
  );

  // Upload a file
  const upload = useCallback(
    async (file: File, title?: string, targetProjectId?: string) => {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        if (title) formData.append("title", title);
        if (targetProjectId || projectId) {
          formData.append("project_id", targetProjectId || projectId || "");
        }

        const res = await fetch(`/api/knowledge/upload`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Upload fehlgeschlagen" }));
          throw new Error(err.detail || "Upload fehlgeschlagen");
        }

        const data = await res.json();

        // Refresh lists
        mutateDocuments();
        mutateStats();

        return data;
      } finally {
        setIsUploading(false);
      }
    },
    [projectId, mutateDocuments, mutateStats]
  );

  // Delete a document
  const deleteDoc = useCallback(
    async (docId: string) => {
      await apiFetch(`/knowledge/documents/${docId}`, { method: "DELETE" });
      mutateDocuments();
      mutateStats();
    },
    [mutateDocuments, mutateStats]
  );

  // Update title/description
  const updateDoc = useCallback(
    async (docId: string, data: { title?: string; description?: string }) => {
      await apiFetch(`/knowledge/documents/${docId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      mutateDocuments();
    },
    [mutateDocuments]
  );

  // Search knowledge base
  const searchKnowledge = useCallback(
    async (
      query: string,
      options?: { projectId?: string; topK?: number }
    ): Promise<KnowledgeSearchResult[]> => {
      try {
        return await apiFetch<KnowledgeSearchResult[]>(`/knowledge/search`, {
          method: "POST",
          body: JSON.stringify({
            query,
            project_id: options?.projectId || projectId || null,
            top_k: options?.topK || 5,
          }),
        });
      } catch {
        return [];
      }
    },
    [projectId]
  );

  return {
    documents: documents ?? [],
    stats: stats ?? null,
    isLoadingDocs,
    isUploading,
    upload,
    deleteDoc,
    updateDoc,
    searchKnowledge,
  };
}
