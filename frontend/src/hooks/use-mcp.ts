"use client";

import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { McpServer, McpServerListItem, McpToolDefinition } from "@/types";

const BASE = "/mcp/servers";

/**
 * SWR-Hook für die MCP-Server-Liste.
 */
export function useMcpServers() {
  const { data, error, isLoading, mutate } = useSWR<McpServerListItem[]>(
    BASE,
    fetcher,
  );

  return {
    servers: data ?? [],
    isLoading,
    error,
    mutate,
  };
}

/**
 * Neuen MCP-Server registrieren.
 */
export async function createMcpServer(data: {
  name: string;
  slug: string;
  server_url: string;
  description?: string;
  auth_type?: string;
  auth_token?: string;
  icon?: string;
}): Promise<McpServer> {
  return apiFetch<McpServer>(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/**
 * MCP-Server aktualisieren.
 */
export async function updateMcpServer(
  serverId: string,
  data: {
    name?: string;
    description?: string;
    server_url?: string;
    auth_type?: string;
    auth_token?: string;
    icon?: string;
  },
): Promise<McpServer> {
  return apiFetch<McpServer>(`${BASE}/${serverId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/**
 * MCP-Server löschen.
 */
export async function deleteMcpServer(serverId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${serverId}`, {
    method: "DELETE",
  });
}

/**
 * MCP-Server verbinden (Health-Check + Tool-Discovery).
 */
export async function connectMcpServer(serverId: string): Promise<McpServer> {
  return apiFetch<McpServer>(`${BASE}/${serverId}/connect`, {
    method: "POST",
  });
}

/**
 * MCP-Server trennen.
 */
export async function disconnectMcpServer(serverId: string): Promise<McpServer> {
  return apiFetch<McpServer>(`${BASE}/${serverId}/disconnect`, {
    method: "POST",
  });
}

/**
 * Verfügbare Tools eines MCP-Servers abrufen.
 */
export async function getMcpServerTools(
  serverId: string,
): Promise<McpToolDefinition[]> {
  return apiFetch<McpToolDefinition[]>(`${BASE}/${serverId}/tools`);
}

/**
 * Health-Check für einen MCP-Server ausführen.
 */
export async function testMcpServer(
  serverId: string,
): Promise<{ healthy: boolean; server_url: string }> {
  return apiFetch<{ healthy: boolean; server_url: string }>(
    `${BASE}/${serverId}/test`,
    { method: "POST" },
  );
}
