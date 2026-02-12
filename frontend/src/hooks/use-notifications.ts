import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { Notification } from "@/types";

export function useNotifications() {
  const { data, error, isLoading, mutate } = useSWR<Notification[]>(
    "/notifications",
    fetcher,
    { refreshInterval: 10000 }
  );

  return {
    notifications: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useUnreadCount() {
  const { data, error, mutate } = useSWR<{ count: number }>(
    "/notifications/unread-count",
    fetcher,
    { refreshInterval: 10000 }
  );

  return {
    count: data?.count ?? 0,
    error,
    mutate,
  };
}

export async function markRead(ids: string[]) {
  await apiFetch("/notifications/mark-read", {
    method: "PATCH",
    body: JSON.stringify({ ids }),
  });
}

export async function deleteNotification(id: string) {
  await apiFetch(`/notifications/${id}`, { method: "DELETE" });
}
