"use client";

import { useState } from "react";
import {
  Puzzle,
  Github,
  MessageCircle,
  FileText,
  HardDrive,
  TicketCheck,
  BookOpen,
  Layers,
  Figma,
  Check,
  X,
  Loader2,
  Plus,
  Plug,
  Wrench,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import {
  useMcpServers,
  createMcpServer,
  connectMcpServer,
  disconnectMcpServer,
  deleteMcpServer,
} from "@/hooks/use-mcp";
import type { McpServerListItem } from "@/types";

// ── Preset Integrations (Vorlagen für bekannte Provider) ─────

interface IntegrationPreset {
  slug: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  defaultUrl: string;
}

const PRESETS: IntegrationPreset[] = [
  {
    slug: "github",
    name: "GitHub",
    description: "Repositories, Issues und PRs",
    icon: Github,
    color: "text-slate-300",
    defaultUrl: "https://mcp.github.com",
  },
  {
    slug: "slack",
    name: "Slack",
    description: "Nachrichten und Channels",
    icon: MessageCircle,
    color: "text-purple-400",
    defaultUrl: "https://mcp.slack.com",
  },
  {
    slug: "notion",
    name: "Notion",
    description: "Seiten und Datenbanken",
    icon: FileText,
    color: "text-slate-300",
    defaultUrl: "https://mcp.notion.so",
  },
  {
    slug: "google-drive",
    name: "Google Drive",
    description: "Dokumente und Tabellen",
    icon: HardDrive,
    color: "text-blue-400",
    defaultUrl: "https://mcp.googleapis.com/drive",
  },
  {
    slug: "jira",
    name: "Jira",
    description: "Tickets und Projekte",
    icon: TicketCheck,
    color: "text-blue-500",
    defaultUrl: "https://mcp.atlassian.com/jira",
  },
  {
    slug: "confluence",
    name: "Confluence",
    description: "Wiki-Seiten durchsuchen",
    icon: BookOpen,
    color: "text-blue-300",
    defaultUrl: "https://mcp.atlassian.com/confluence",
  },
  {
    slug: "linear",
    name: "Linear",
    description: "Issues und Roadmaps",
    icon: Layers,
    color: "text-violet-400",
    defaultUrl: "https://mcp.linear.app",
  },
  {
    slug: "figma",
    name: "Figma",
    description: "Design-Dateien referenzieren",
    icon: Figma,
    color: "text-pink-400",
    defaultUrl: "https://mcp.figma.com",
  },
];

// ── Helper: Icon für Server ──────────────────────────────────

function getIconForServer(server: McpServerListItem): LucideIcon {
  const preset = PRESETS.find((p) => p.slug === server.slug);
  if (preset) return preset.icon;
  return Plug;
}

function getColorForServer(server: McpServerListItem): string {
  const preset = PRESETS.find((p) => p.slug === server.slug);
  if (preset) return preset.color;
  return "text-muted-foreground";
}

// ── Component ────────────────────────────────────────────────

export function IntegrationManager() {
  const { servers, isLoading, mutate } = useMcpServers();
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customSlug, setCustomSlug] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [customToken, setCustomToken] = useState("");

  // Finde Server nach Slug
  const getServerBySlug = (slug: string): McpServerListItem | undefined =>
    servers.find((s) => s.slug === slug);

  // ── Preset verbinden ──────────────────────────────────────

  const handlePresetConnect = (preset: IntegrationPreset) => {
    const existing = getServerBySlug(preset.slug);
    if (existing) {
      // Server existiert schon — nur verbinden
      handleConnect(existing.id);
    } else {
      // Noch nicht registriert — Token-Eingabe zeigen
      setConnectingSlug(preset.slug);
      setUrlInput(preset.defaultUrl);
      setTokenInput("");
      setErrorMsg(null);
    }
  };

  const handleSavePreset = async (preset: IntegrationPreset) => {
    if (!tokenInput.trim()) return;
    setSavingId(preset.slug);
    setErrorMsg(null);

    try {
      // Server erstellen
      const server = await createMcpServer({
        name: preset.name,
        slug: preset.slug,
        server_url: urlInput || preset.defaultUrl,
        description: preset.description,
        auth_type: "bearer",
        auth_token: tokenInput.trim(),
        icon: preset.slug,
      });

      // Direkt verbinden versuchen
      try {
        await connectMcpServer(server.id);
      } catch {
        // Server erstellt, aber Verbindung fehlgeschlagen — ist OK
      }

      await mutate();
      setConnectingSlug(null);
      setTokenInput("");
      setUrlInput("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSavingId(null);
    }
  };

  // ── Server verbinden/trennen ──────────────────────────────

  const handleConnect = async (serverId: string) => {
    setSavingId(serverId);
    setErrorMsg(null);
    try {
      await connectMcpServer(serverId);
      await mutate();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Verbindung fehlgeschlagen",
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleDisconnect = async (serverId: string) => {
    setSavingId(serverId);
    try {
      await disconnectMcpServer(serverId);
      await mutate();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Trennung fehlgeschlagen",
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (serverId: string) => {
    try {
      await deleteMcpServer(serverId);
      await mutate();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Löschen fehlgeschlagen",
      );
    }
  };

  // ── Custom MCP Server ─────────────────────────────────────

  const handleSaveCustom = async () => {
    if (!customName.trim() || !customUrl.trim()) return;
    setSavingId("custom");
    setErrorMsg(null);

    const slug =
      customSlug.trim() ||
      customName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    try {
      const server = await createMcpServer({
        name: customName.trim(),
        slug,
        server_url: customUrl.trim(),
        auth_type: customToken.trim() ? "bearer" : "none",
        auth_token: customToken.trim() || undefined,
        icon: "plug",
      });

      try {
        await connectMcpServer(server.id);
      } catch {
        // Verbindung fehlgeschlagen — ist OK
      }

      await mutate();
      setShowCustom(false);
      setCustomName("");
      setCustomSlug("");
      setCustomUrl("");
      setCustomToken("");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSavingId(null);
    }
  };

  const connectedCount = servers.filter((s) => s.is_connected).length;

  // ── Custom-Server (nicht in Presets) ───────────────────────

  const customServers = servers.filter(
    (s) => !PRESETS.some((p) => p.slug === s.slug),
  );

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">MCP-Integrationen</h3>
          {connectedCount > 0 && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
              {connectedCount} verbunden
            </span>
          )}
        </div>
        <button
          onClick={() => setShowCustom(!showCustom)}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-[hsl(var(--accent-orange))]"
        >
          <Plus className="h-3 w-3" />
          Eigener Server
        </button>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {errorMsg}
          <button
            onClick={() => setErrorMsg(null)}
            className="ml-auto"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Custom Server Form */}
      {showCustom && (
        <div className="mb-4 rounded-lg border border-dashed border-[hsl(var(--accent-orange))]/30 bg-secondary/30 p-3">
          <p className="mb-2 text-xs font-medium">Eigenen MCP-Server hinzufügen</p>
          <div className="space-y-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Name (z.B. Mein MCP-Server)"
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-[hsl(var(--accent-orange))]"
            />
            <input
              type="text"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
              placeholder="Server-URL (z.B. https://mcp.example.com)"
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-[hsl(var(--accent-orange))]"
            />
            <input
              type="password"
              value={customToken}
              onChange={(e) => setCustomToken(e.target.value)}
              placeholder="Auth-Token (optional)"
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-[hsl(var(--accent-orange))]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCustom(false)}
                className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveCustom}
                disabled={
                  !customName.trim() ||
                  !customUrl.trim() ||
                  savingId === "custom"
                }
                className="flex items-center gap-1 rounded-md bg-[hsl(var(--accent-orange))] px-2.5 py-1 text-xs font-medium text-white hover:bg-[hsl(var(--accent-orange))]/90 disabled:opacity-50"
              >
                {savingId === "custom" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Preset Integrations Grid */}
      {!isLoading && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRESETS.map((preset) => {
            const server = getServerBySlug(preset.slug);
            const connected = server?.is_connected ?? false;
            const isConnecting = connectingSlug === preset.slug;
            const Icon = preset.icon;
            const isSaving = savingId === preset.slug || savingId === server?.id;

            return (
              <div key={preset.slug} className="flex flex-col">
                <div
                  className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    connected
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-dashed border-border hover:border-muted-foreground/30"
                  }`}
                >
                  {/* Icon */}
                  <div className="shrink-0">
                    <Icon className={`h-5 w-5 ${preset.color}`} />
                  </div>

                  {/* Name + Description */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">
                      {preset.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {preset.description}
                      {server && server.tool_count > 0 && (
                        <span className="ml-1 text-[hsl(var(--accent-orange))]">
                          · {server.tool_count} Tools
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Action */}
                  <div className="shrink-0">
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : connected && server ? (
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                          <Check className="h-3 w-3" />
                          Verbunden
                        </span>
                        <button
                          onClick={() => handleDisconnect(server.id)}
                          className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        >
                          Trennen
                        </button>
                      </div>
                    ) : server ? (
                      <button
                        onClick={() => handleConnect(server.id)}
                        className="rounded-md border border-dashed border-muted-foreground/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[hsl(var(--accent-orange))] hover:text-[hsl(var(--accent-orange))]"
                      >
                        Verbinden
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePresetConnect(preset)}
                        className="rounded-md border border-dashed border-muted-foreground/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[hsl(var(--accent-orange))] hover:text-[hsl(var(--accent-orange))]"
                      >
                        Einrichten
                      </button>
                    )}
                  </div>
                </div>

                {/* Connect dialog (inline) */}
                {isConnecting && (
                  <div className="mt-1 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                    <p className="mb-2 text-xs text-muted-foreground">
                      MCP-Server für{" "}
                      <span className="font-medium text-foreground">
                        {preset.name}
                      </span>{" "}
                      einrichten:
                    </p>
                    <div className="mb-2">
                      <input
                        type="text"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Server-URL"
                        className="w-full rounded-md border border-border bg-transparent px-2.5 py-1 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-[hsl(var(--accent-orange))]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="API-Key / Token..."
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSavePreset(preset);
                          if (e.key === "Escape") {
                            setConnectingSlug(null);
                            setTokenInput("");
                          }
                        }}
                        className="flex-1 rounded-md border border-border bg-transparent px-2.5 py-1 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-[hsl(var(--accent-orange))]"
                      />
                      <button
                        onClick={() => handleSavePreset(preset)}
                        disabled={!tokenInput.trim() || savingId === preset.slug}
                        className="flex items-center gap-1 rounded-md bg-[hsl(var(--accent-orange))] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[hsl(var(--accent-orange))]/90 disabled:opacity-50"
                      >
                        {savingId === preset.slug ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Speichern
                      </button>
                      <button
                        onClick={() => {
                          setConnectingSlug(null);
                          setTokenInput("");
                        }}
                        className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Custom MCP-Server (nicht in Presets) */}
      {customServers.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Eigene MCP-Server
          </p>
          <div className="space-y-2">
            {customServers.map((server) => {
              const isSaving = savingId === server.id;
              return (
                <div
                  key={server.id}
                  className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                    server.is_connected
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-dashed border-border"
                  }`}
                >
                  <Plug className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight">
                      {server.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {server.server_url}
                      {server.tool_count > 0 && (
                        <span className="ml-1 text-[hsl(var(--accent-orange))]">
                          · {server.tool_count} Tools
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : server.is_connected ? (
                      <>
                        <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                          <Check className="h-3 w-3" />
                          Verbunden
                        </span>
                        <button
                          onClick={() => handleDisconnect(server.id)}
                          className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                        >
                          Trennen
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(server.id)}
                        className="rounded-md border border-dashed border-muted-foreground/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[hsl(var(--accent-orange))] hover:text-[hsl(var(--accent-orange))]"
                      >
                        Verbinden
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(server.id)}
                      className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer hint */}
      <p className="mt-4 text-center text-[11px] text-muted-foreground/50">
        MCP-Server stellen dem Orchestrator externe Tools bereit
      </p>
    </div>
  );
}
