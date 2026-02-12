"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/api";
import type {
  OrgInsights,
  EntityGraphData,
  WorkflowPatternEntry,
  InstanceTracks,
} from "@/types";

const SWR_STABLE = {
  revalidateOnFocus: false,
  isPaused: () => typeof document !== "undefined" && document.hidden,
};

export function useOrgInsights(limit = 50) {
  const { data, error, isLoading } = useSWR<OrgInsights>(
    `/tracks/insights?limit=${limit}`,
    fetcher,
    SWR_STABLE
  );
  return { insights: data, error, isLoading };
}

export function useEntityGraph(limit = 100, schemaType?: string) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (schemaType) params.set("schema_type", schemaType);

  const { data, error, isLoading } = useSWR<EntityGraphData>(
    `/tracks/entities?${params}`,
    fetcher,
    SWR_STABLE
  );
  return { graph: data, error, isLoading };
}

export function useWorkflowPatterns(limit = 20) {
  const { data, error, isLoading } = useSWR<WorkflowPatternEntry[]>(
    `/tracks/patterns?limit=${limit}`,
    fetcher,
    SWR_STABLE
  );
  return { patterns: data ?? [], error, isLoading };
}

export function useInstanceTracks(instanceId: string | null) {
  const { data, error, isLoading } = useSWR<InstanceTracks>(
    instanceId ? `/tracks/instance/${instanceId}` : null,
    fetcher,
    SWR_STABLE
  );
  return { tracks: data, error, isLoading };
}
