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

export function useProjects() {
  const { data, error, mutate } = useSWR<Project[]>("/projects", fetcher);

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
    projects: data ?? [],
    isLoading: !data && !error,
    error,
    createProject,
    deleteProject,
    mutate,
  };
}
