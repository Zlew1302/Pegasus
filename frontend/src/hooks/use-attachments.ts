"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { TaskAttachment } from "@/types";

export function useAttachments(taskId: string | null) {
  const { data, error, mutate } = useSWR<TaskAttachment[]>(
    taskId ? `/tasks/${taskId}/attachments` : null,
    fetcher
  );

  async function upload(file: File) {
    if (!taskId) return;
    const formData = new FormData();
    formData.append("file", file);
    await fetch(`/api/tasks/${taskId}/attachments`, {
      method: "POST",
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Upload fehlgeschlagen" }));
        throw new Error(err.detail || "Upload fehlgeschlagen");
      }
    });
    mutate();
  }

  async function remove(attachmentId: string) {
    await apiFetch(`/attachments/${attachmentId}`, { method: "DELETE" });
    mutate();
  }

  function downloadUrl(attachmentId: string) {
    return `/api/attachments/${attachmentId}/download`;
  }

  return {
    attachments: data ?? [],
    isLoading: !data && !error,
    error,
    upload,
    remove,
    downloadUrl,
    mutate,
  };
}
