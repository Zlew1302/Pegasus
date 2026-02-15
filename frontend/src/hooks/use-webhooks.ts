"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { Webhook, WebhookDelivery } from "@/types";

export function useWebhooks() {
  const { data, error, mutate } = useSWR<Webhook[]>("/webhooks", fetcher);

  async function create(name: string, url: string, events: string) {
    await apiFetch("/webhooks", {
      method: "POST",
      body: JSON.stringify({ name, url, events }),
    });
    mutate();
  }

  async function update(id: string, updates: Partial<Webhook>) {
    await apiFetch(`/webhooks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
    mutate();
  }

  async function remove(id: string) {
    await apiFetch(`/webhooks/${id}`, { method: "DELETE" });
    mutate();
  }

  async function test(id: string) {
    await apiFetch(`/webhooks/${id}/test`, { method: "POST" });
  }

  return {
    webhooks: data ?? [],
    isLoading: !data && !error,
    error,
    create,
    update,
    remove,
    test,
    mutate,
  };
}

export function useWebhookDeliveries(webhookId: string | null) {
  const { data, error } = useSWR<WebhookDelivery[]>(
    webhookId ? `/webhooks/${webhookId}/deliveries` : null,
    fetcher
  );

  return {
    deliveries: data ?? [],
    isLoading: !data && !error,
  };
}
