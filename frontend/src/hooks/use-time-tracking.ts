"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { TimeEntry } from "@/types";

export function useTimeTracking(taskId: string | null) {
  const { data, error, mutate } = useSWR<TimeEntry[]>(
    taskId ? `/tasks/${taskId}/time-entries` : null,
    fetcher
  );

  const entries = data ?? [];
  const runningEntry = entries.find((e) => e.is_running);

  async function startTimer() {
    if (!taskId) return;
    await apiFetch(`/tasks/${taskId}/timer/start`, { method: "POST" });
    mutate();
  }

  async function stopTimer() {
    if (!taskId) return;
    await apiFetch(`/tasks/${taskId}/timer/stop`, { method: "POST" });
    mutate();
  }

  async function addManualEntry(durationMinutes: number, note?: string) {
    if (!taskId) return;
    await apiFetch(`/tasks/${taskId}/time-entries`, {
      method: "POST",
      body: JSON.stringify({ duration_minutes: durationMinutes, note }),
    });
    mutate();
  }

  async function deleteEntry(entryId: string) {
    await apiFetch(`/time-entries/${entryId}`, { method: "DELETE" });
    mutate();
  }

  const totalMinutes = entries
    .filter((e) => !e.is_running)
    .reduce((sum, e) => sum + e.duration_minutes, 0);

  return {
    entries,
    runningEntry,
    totalMinutes,
    isLoading: !data && !error,
    error,
    startTimer,
    stopTimer,
    addManualEntry,
    deleteEntry,
    mutate,
  };
}
