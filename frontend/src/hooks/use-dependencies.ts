"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { TaskDependency } from "@/types";

export function useDependencies(taskId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<TaskDependency[]>(
    taskId ? `/tasks/${taskId}/dependencies` : null,
    fetcher
  );

  const addDependency = async (targetTaskId: string, dependsOnTaskId: string) => {
    const dep = await apiFetch<TaskDependency>(
      `/tasks/${targetTaskId}/dependencies`,
      {
        method: "POST",
        body: JSON.stringify({ depends_on_task_id: dependsOnTaskId }),
      }
    );
    mutate();
    return dep;
  };

  const removeDependency = async (
    targetTaskId: string,
    dependsOnTaskId: string
  ) => {
    await apiFetch(`/tasks/${targetTaskId}/dependencies/${dependsOnTaskId}`, {
      method: "DELETE",
    });
    mutate();
  };

  return {
    dependencies: data ?? [],
    error,
    isLoading,
    addDependency,
    removeDependency,
    mutate,
  };
}
