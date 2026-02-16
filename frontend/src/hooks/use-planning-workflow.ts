"use client";

import { apiFetch } from "@/lib/api";
import type {
  ExaSearchResult,
  PlanningSession,
  PlanTaskSuggestion,
  Task,
} from "@/types";

const BASE = "/planning/sessions";

export async function createPlanningSession(
  projectId: string,
  inputMode: string,
): Promise<PlanningSession> {
  return apiFetch<PlanningSession>(BASE, {
    method: "POST",
    body: JSON.stringify({ project_id: projectId, input_mode: inputMode }),
  });
}

export async function getPlanningSession(
  sessionId: string,
): Promise<PlanningSession> {
  return apiFetch<PlanningSession>(`${BASE}/${sessionId}`);
}

export async function updatePlanningInput(
  sessionId: string,
  data: {
    user_notes?: string | null;
    knowledge_doc_ids?: string[] | null;
    web_search_topics?: string[] | null;
    auto_context?: boolean;
  },
): Promise<PlanningSession> {
  return apiFetch<PlanningSession>(`${BASE}/${sessionId}/input`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function searchExa(
  sessionId: string,
  topics: string[],
): Promise<ExaSearchResult[]> {
  return apiFetch<ExaSearchResult[]>(`${BASE}/${sessionId}/search`, {
    method: "POST",
    body: JSON.stringify({ topics }),
  });
}

export async function generatePlan(
  sessionId: string,
): Promise<PlanningSession> {
  return apiFetch<PlanningSession>(`${BASE}/${sessionId}/generate`, {
    method: "POST",
  });
}

export async function confirmPlan(
  sessionId: string,
  tasks: PlanTaskSuggestion[],
  autoStartAgents: boolean = false,
): Promise<Task[]> {
  return apiFetch<Task[]>(`${BASE}/${sessionId}/confirm`, {
    method: "POST",
    body: JSON.stringify({
      tasks,
      auto_start_agents: autoStartAgents,
    }),
  });
}

export async function cancelPlanningSession(
  sessionId: string,
): Promise<void> {
  return apiFetch<void>(`${BASE}/${sessionId}/cancel`, {
    method: "POST",
  });
}
