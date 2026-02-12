import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { SavedView } from "@/types";

export function useSavedViews(projectId: string) {
  const { data, error, isLoading, mutate } = useSWR<SavedView[]>(
    `/projects/${projectId}/views`,
    fetcher
  );

  return {
    views: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createView(
  projectId: string,
  data: { name: string; filter_json: string }
) {
  return apiFetch<SavedView>(`/projects/${projectId}/views`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateView(
  viewId: string,
  data: { name?: string; filter_json?: string }
) {
  return apiFetch<SavedView>(`/views/${viewId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteView(viewId: string) {
  await apiFetch(`/views/${viewId}`, { method: "DELETE" });
}
