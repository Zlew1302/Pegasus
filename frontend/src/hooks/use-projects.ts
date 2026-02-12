"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { Project } from "@/types";

export interface CreateProjectData {
  title: string;
  description?: string;
  goal?: string;
  status?: string;
  phase?: string;
  start_date?: string;
  end_date?: string;
  budget_cents?: number;
  team_id?: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export function useProjects() {
  const { data, error, mutate } = useSWR<PaginatedResponse<Project>>(
    "/projects",
    fetcher
  );

  const createProject = async (project: CreateProjectData) => {
    const created = await apiFetch<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(project),
    });
    mutate();
    return created;
  };

  const deleteProject = async (projectId: string) => {
    await apiFetch(`/projects/${projectId}`, { method: "DELETE" });
    mutate();
  };

  return {
    projects: data?.items ?? [],
    total: data?.total ?? 0,
    isLoading: !data && !error,
    error,
    createProject,
    deleteProject,
    mutate,
  };
}
