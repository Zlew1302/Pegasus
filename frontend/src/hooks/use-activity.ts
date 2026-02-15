"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type { TaskActivityEntry } from "@/types";

export function useTaskActivity(taskId: string | null) {
  const { data, error, mutate } = useSWR<TaskActivityEntry[]>(
    taskId ? `/tasks/${taskId}/activity?limit=100` : null,
    fetcher
  );

  return {
    activity: data ?? [],
    isLoading: !data && !error,
    error,
    mutate,
  };
}
