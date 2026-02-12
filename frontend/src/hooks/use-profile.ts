"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { UserProfile, ApiKeyEntry, AuditEntry, TokenUsageEntry } from "@/types";

export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR<UserProfile>(
    "/profile",
    fetcher
  );

  const updateProfile = async (updates: Partial<UserProfile>) => {
    await apiFetch("/profile", {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    mutate();
  };

  return { profile: data, error, isLoading, updateProfile, mutate };
}

export function useApiKeys() {
  const { data, error, isLoading, mutate } = useSWR<ApiKeyEntry[]>(
    "/profile/api-keys",
    fetcher
  );

  const createKey = async (provider: string, keyName: string, keyValue: string) => {
    await apiFetch("/profile/api-keys", {
      method: "POST",
      body: JSON.stringify({
        provider,
        key_name: keyName,
        key_encrypted: keyValue,
      }),
    });
    mutate();
  };

  const deleteKey = async (id: string) => {
    await apiFetch(`/profile/api-keys/${id}`, { method: "DELETE" });
    mutate();
  };

  const toggleKey = async (id: string, isActive: boolean) => {
    await apiFetch(`/profile/api-keys/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    });
    mutate();
  };

  return { apiKeys: data ?? [], error, isLoading, createKey, deleteKey, toggleKey, mutate };
}

export function useAuditTrail(limit = 50, offset = 0) {
  const { data, error, isLoading } = useSWR<AuditEntry[]>(
    `/profile/audit-trail?limit=${limit}&offset=${offset}`,
    fetcher
  );
  return { entries: data ?? [], error, isLoading };
}

export function useTokenUsage(from?: string, to?: string, groupBy = "agent") {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("group_by", groupBy);
  const query = params.toString();

  const { data, error, isLoading } = useSWR<TokenUsageEntry[]>(
    `/profile/token-usage?${query}`,
    fetcher
  );
  return { usage: data ?? [], error, isLoading };
}
