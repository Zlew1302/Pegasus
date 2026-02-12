import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { Team, TeamMember } from "@/types";

export function useTeams() {
  const { data, error, isLoading, mutate } = useSWR<Team[]>(
    "/teams",
    fetcher
  );

  return {
    teams: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export function useTeam(id: string | null) {
  const { data, error, isLoading, mutate } = useSWR<Team>(
    id ? `/teams/${id}` : null,
    fetcher
  );

  return {
    team: data ?? null,
    isLoading,
    error,
    mutate,
  };
}

export function useTeamMembers(teamId: string | null) {
  const { data, error, isLoading, mutate } = useSWR<TeamMember[]>(
    teamId ? `/teams/${teamId}/members` : null,
    fetcher
  );

  return {
    members: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

export async function createTeam(data: { name: string; description?: string }) {
  return apiFetch<Team>("/teams", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTeam(id: string, data: { name?: string; description?: string }) {
  return apiFetch<Team>(`/teams/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteTeam(id: string) {
  await apiFetch(`/teams/${id}`, { method: "DELETE" });
}

export async function addMember(
  teamId: string,
  data: { member_type: string; member_id: string; member_name?: string; role?: string }
) {
  return apiFetch<TeamMember>(`/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function removeMember(teamId: string, memberId: string) {
  await apiFetch(`/teams/${teamId}/members/${memberId}`, { method: "DELETE" });
}
