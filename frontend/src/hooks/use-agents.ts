"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { AgentInstance, AgentSuggestion, AgentType, ExecutionStep } from "@/types";

export function useAgentTypes() {
  const { data, error } = useSWR<AgentType[]>("/agents/types", fetcher);
  return {
    agentTypes: data ?? [],
    isLoading: !data && !error,
  };
}

export function useAgentInstance(instanceId: string | null) {
  const { data, error, mutate } = useSWR<AgentInstance>(
    instanceId ? `/agents/instances/${instanceId}` : null,
    fetcher,
    { refreshInterval: 2000 }
  );

  return {
    instance: data ?? null,
    isLoading: !data && !error,
    mutate,
  };
}

export async function spawnAgent(agentTypeId: string, taskId: string) {
  return apiFetch<AgentInstance>("/agents/spawn", {
    method: "POST",
    body: JSON.stringify({
      agent_type_id: agentTypeId,
      task_id: taskId,
    }),
  });
}

export async function pauseAgent(instanceId: string) {
  return apiFetch<AgentInstance>(`/agents/instances/${instanceId}/pause`, {
    method: "POST",
  });
}

export async function resumeAgent(instanceId: string) {
  return apiFetch<AgentInstance>(`/agents/instances/${instanceId}/resume`, {
    method: "POST",
  });
}

export async function cancelAgent(instanceId: string) {
  return apiFetch<AgentInstance>(`/agents/instances/${instanceId}/cancel`, {
    method: "POST",
  });
}

export function useExecutionSteps(instanceId: string | null) {
  const { data, error } = useSWR<ExecutionStep[]>(
    instanceId ? `/agents/instances/${instanceId}/steps` : null,
    fetcher
  );
  return {
    steps: data ?? [],
    isLoading: !data && !error,
  };
}

export function useAgentSuggestions(taskId: string | null) {
  const { data, error } = useSWR<AgentSuggestion[]>(
    taskId ? `/agents/suggest/${taskId}` : null,
    fetcher
  );
  return {
    suggestions: data ?? [],
    isLoading: !data && !error,
  };
}

export async function sendMessageToAgent(instanceId: string, message: string) {
  return apiFetch<AgentInstance>(`/agents/instances/${instanceId}/message`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
