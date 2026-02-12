"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type {
  DashboardStats,
  ActivityEntry,
  CostEntry,
  ProductivityEntry,
} from "@/types";

export function useDashboardStats() {
  const { data, error, isLoading } = useSWR<DashboardStats>(
    "/dashboard/stats",
    fetcher,
    { refreshInterval: 30000 }
  );
  return { stats: data, error, isLoading };
}

export function useActivity(limit = 20) {
  const { data, error, isLoading } = useSWR<ActivityEntry[]>(
    `/dashboard/activity?limit=${limit}`,
    fetcher,
    { refreshInterval: 10000 }
  );
  return { activity: data ?? [], error, isLoading };
}

export function useCosts(from?: string, to?: string, projectId?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (projectId) params.set("project_id", projectId);
  const query = params.toString();
  const { data, error, isLoading } = useSWR<CostEntry[]>(
    `/dashboard/costs${query ? `?${query}` : ""}`,
    fetcher
  );
  return { costs: data ?? [], error, isLoading };
}

export function useProductivity(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  const { data, error, isLoading } = useSWR<ProductivityEntry[]>(
    `/dashboard/productivity${query ? `?${query}` : ""}`,
    fetcher
  );
  return { productivity: data ?? [], error, isLoading };
}
