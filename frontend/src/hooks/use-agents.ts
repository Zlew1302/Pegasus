"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { AgentInstance, AgentInstanceWithTask, AgentSuggestion, AgentType, AgentTypeCreateInput, AvailableTool, ExecutionStep } from "@/types";

export function useAgentTypes() {
  const { data, error, mutate } = useSWR<AgentType[]>("/agents/types", fetcher);
  return {
    agentTypes: data ?? [],
    isLoading: !data && !error,
    mutate,
  };
}

export function useAvailableTools() {
  const { data, error } = useSWR<AvailableTool[]>("/agents/tools/available", fetcher);
  return {
    tools: data ?? [],
    isLoading: !data && !error,
  };
}

export async function createAgentType(input: AgentTypeCreateInput) {
  return apiFetch<AgentType>("/agents/types", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAgentType(typeId: string, input: Partial<AgentTypeCreateInput>) {
  return apiFetch<AgentType>(`/agents/types/${typeId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteAgentType(typeId: string) {
  return apiFetch<void>(`/agents/types/${typeId}`, {
    method: "DELETE",
  });
}

export function useAgentInstance(
  instanceId: string | null,
  options?: { pollDisabled?: boolean },
) {
  const { data, error, mutate } = useSWR<AgentInstance>(
    instanceId ? `/agents/instances/${instanceId}` : null,
    fetcher,
    {
      refreshInterval: options?.pollDisabled ? 0 : 5000,
      revalidateOnFocus: false,
      isPaused: () => typeof document !== "undefined" && document.hidden,
    }
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

export async function restartAgent(instanceId: string) {
  return apiFetch<AgentInstance>(`/agents/instances/${instanceId}/restart`, {
    method: "POST",
  });
}

export async function deleteAgentInstance(instanceId: string) {
  return apiFetch<void>(`/agents/instances/${instanceId}`, {
    method: "DELETE",
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

export function useProjectAgentInstances(projectId: string | null) {
  const { data, error, mutate } = useSWR<AgentInstanceWithTask[]>(
    projectId ? `/agents/instances?project_id=${projectId}` : null,
    fetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: false,
      isPaused: () => typeof document !== "undefined" && document.hidden,
    }
  );
  return {
    instances: data ?? [],
    isLoading: !data && !error,
    mutate,
  };
}

export async function sendMessageToAgent(instanceId: string, message: string) {
  return apiFetch<AgentInstance>(`/agents/instances/${instanceId}/message`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function useAllAgentInstances(statusFilter?: string) {
  const params = new URLSearchParams();
  if (statusFilter) params.set("status", statusFilter);
  const query = params.toString();
  const path = `/agents/instances${query ? `?${query}` : ""}`;

  const { data, error, mutate } = useSWR<AgentInstanceWithTask[]>(
    path,
    fetcher,
    {
      refreshInterval: 10000,
      revalidateOnFocus: false,
      isPaused: () => typeof document !== "undefined" && document.hidden,
    }
  );
  return {
    instances: data ?? [],
    isLoading: !data && !error,
    mutate,
  };
}
