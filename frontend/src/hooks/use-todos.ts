"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { Todo } from "@/types";

export function useTodos() {
  const { data, error, isLoading, mutate } = useSWR<Todo[]>(
    "/todos",
    fetcher
  );

  const createTodo = async (title: string, projectId?: string) => {
    const todo = await apiFetch<Todo>("/todos", {
      method: "POST",
      body: JSON.stringify({
        title,
        project_id: projectId ?? null,
        sort_order: (data?.length ?? 0),
      }),
    });
    mutate();
    return todo;
  };

  const updateTodo = async (id: string, updates: Partial<Todo>) => {
    await apiFetch(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    mutate();
  };

  const deleteTodo = async (id: string) => {
    await apiFetch(`/todos/${id}`, { method: "DELETE" });
    mutate();
  };

  const toggleTodo = async (id: string, isCompleted: boolean) => {
    await updateTodo(id, { is_completed: isCompleted });
  };

  return {
    todos: data ?? [],
    error,
    isLoading,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    mutate,
  };
}
