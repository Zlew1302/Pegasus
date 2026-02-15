import { mutate } from "swr";

/**
 * Invalidates all SWR caches relevant after an agent action
 * (pause/resume/cancel/restart).
 */
export function mutateAfterAgentAction() {
  // Revalidate agent instances
  mutate(
    (key: string) => typeof key === "string" && key.startsWith("/agents/instances"),
    undefined,
    { revalidate: true }
  );
  // Revalidate dashboard stats (active agent count etc.)
  mutate("/dashboard/stats");
  // Revalidate activity feed
  mutate(
    (key: string) => typeof key === "string" && key.startsWith("/dashboard/activity"),
    undefined,
    { revalidate: true }
  );
}

/**
 * Invalidates all SWR caches relevant after an approval action
 * (approve/reject/changes_requested).
 */
export function mutateAfterApprovalAction() {
  // Revalidate approval list
  mutate(
    (key: string) => typeof key === "string" && key.startsWith("/approvals"),
    undefined,
    { revalidate: true }
  );
  // Revalidate dashboard stats (pending_inputs count)
  mutate("/dashboard/stats");
  // Revalidate activity feed
  mutate(
    (key: string) => typeof key === "string" && key.startsWith("/dashboard/activity"),
    undefined,
    { revalidate: true }
  );
}
