"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { Comment } from "@/types";

export function useComments(taskId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Comment[]>(
    taskId ? `/tasks/${taskId}/comments` : null,
    fetcher
  );

  const createComment = async (
    targetTaskId: string,
    authorName: string,
    content: string,
    authorType: string = "human"
  ) => {
    const comment = await apiFetch<Comment>(`/tasks/${targetTaskId}/comments`, {
      method: "POST",
      body: JSON.stringify({
        author_name: authorName,
        content,
        author_type: authorType,
      }),
    });
    mutate();
    return comment;
  };

  const deleteComment = async (commentId: string) => {
    await apiFetch(`/comments/${commentId}`, { method: "DELETE" });
    mutate();
  };

  return {
    comments: data ?? [],
    error,
    isLoading,
    createComment,
    deleteComment,
    mutate,
  };
}
