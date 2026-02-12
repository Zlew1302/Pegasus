"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { Task } from "@/types";

export function useTasks(projectId: string | null) {
  const { data, error, mutate } = useSWR<Task[]>(
    projectId ? `/projects/${projectId}/tasks` : null,
    fetcher
  );

  const createTask = async (task: {
    title: string;
    description?: string;
    priority?: string;
    task_type?: string;
    status?: string;
  }) => {
    if (!projectId) return;
    const created = await apiFetch<Task>(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(task),
    });
    mutate();
    return created;
  };

  const updateTask = async (
    taskId: string,
    updates: Partial<Task>
  ) => {
    const updated = await apiFetch<Task>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    mutate();
    return updated;
  };

  const updateStatus = async (taskId: string, status: string) => {
    const updated = await apiFetch<Task>(`/tasks/${taskId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    mutate();
    return updated;
  };

  const updatePosition = async (
    taskId: string,
    status: string,
    sortOrder: number
  ) => {
    const updated = await apiFetch<Task>(`/tasks/${taskId}/position`, {
      method: "PATCH",
      body: JSON.stringify({ status, sort_order: sortOrder }),
    });
    mutate();
    return updated;
  };

  const deleteTask = async (taskId: string) => {
    await apiFetch(`/tasks/${taskId}`, { method: "DELETE" });
    mutate();
  };

  return {
    tasks: data ?? [],
    isLoading: !data && !error,
    error,
    createTask,
    updateTask,
    updateStatus,
    updatePosition,
    deleteTask,
    mutate,
  };
}
