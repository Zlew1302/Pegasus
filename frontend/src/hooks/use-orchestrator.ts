import { apiFetch } from "@/lib/api";
import type { OrchestratorStartResponse } from "@/types";

const BASE = "/orchestrator";

/**
 * Startet den Orchestrator für eine Benutzeranfrage.
 *
 * Gibt die AgentInstance-ID zurück, über die der SSE-Stream
 * abonniert werden kann (via useSSE).
 */
export async function startOrchestration(
  projectId: string,
  instruction: string,
): Promise<OrchestratorStartResponse> {
  return apiFetch<OrchestratorStartResponse>(`${BASE}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      instruction,
    }),
  });
}
