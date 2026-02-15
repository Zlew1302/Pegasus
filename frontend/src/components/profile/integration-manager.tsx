"use client";

import { useState, useEffect, useCallback } from "react";
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
  type LucideIcon,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

interface ConnectionState {
  connected: boolean;
  connectedAt: string | null;
}

type IntegrationStates = Record<string, ConnectionState>;

// ── Integration definitions ──────────────────────────────────

const INTEGRATIONS: Integration[] = [
  {
    id: "github",
    name: "GitHub",
    description: "Repositories, Issues und PRs importieren",
    icon: Github,
    color: "text-slate-300",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Nachrichten und Channels durchsuchen",
    icon: MessageCircle,
    color: "text-purple-400",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Seiten und Datenbanken synchronisieren",
    icon: FileText,
    color: "text-slate-300",
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Dokumente und Tabellen importieren",
    icon: HardDrive,
    color: "text-blue-400",
  },
  {
    id: "jira",
    name: "Jira",
    description: "Tickets und Projekte verknüpfen",
    icon: TicketCheck,
    color: "text-blue-500",
  },
  {
    id: "confluence",
    name: "Confluence",
    description: "Wiki-Seiten durchsuchen",
    icon: BookOpen,
    color: "text-blue-300",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Issues und Roadmaps einbinden",
    icon: Layers,
    color: "text-violet-400",
  },
  {
    id: "figma",
    name: "Figma",
    description: "Design-Dateien referenzieren",
    icon: Figma,
    color: "text-pink-400",
  },
];

const STORAGE_KEY = "pegasus-integrations";

// ── Helpers ──────────────────────────────────────────────────

function loadStates(): IntegrationStates {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as IntegrationStates;
  } catch {
    // Corrupted data — start fresh
  }
  return {};
}

function saveStates(states: IntegrationStates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
}

// ── Component ────────────────────────────────────────────────

export function IntegrationManager() {
  const [states, setStates] = useState<IntegrationStates>({});
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    setStates(loadStates());
  }, []);

  const isConnected = useCallback(
    (id: string) => states[id]?.connected ?? false,
    [states]
  );

  const handleConnect = (id: string) => {
    setConnectingId(id);
    setTokenInput("");
  };

  const handleCancelConnect = () => {
    setConnectingId(null);
    setTokenInput("");
  };

  const handleSaveToken = (id: string) => {
    if (!tokenInput.trim()) return;
    setSavingId(id);

    // Simulate brief save delay
    setTimeout(() => {
      const next: IntegrationStates = {
        ...states,
        [id]: {
          connected: true,
          connectedAt: new Date().toISOString(),
        },
      };
      setStates(next);
      saveStates(next);
      setConnectingId(null);
      setTokenInput("");
      setSavingId(null);
    }, 600);
  };

  const handleDisconnect = (id: string) => {
    const next: IntegrationStates = {
      ...states,
      [id]: { connected: false, connectedAt: null },
    };
    setStates(next);
    saveStates(next);
  };

  const connectedCount = INTEGRATIONS.filter((i) => isConnected(i.id)).length;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Puzzle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Integrationen</h3>
          {connectedCount > 0 && (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
              {connectedCount} verbunden
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {INTEGRATIONS.map((integration) => {
          const connected = isConnected(integration.id);
          const isConnecting = connectingId === integration.id;
          const Icon = integration.icon;

          return (
            <div key={integration.id} className="flex flex-col">
              <div
                className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  connected
                    ? "border-green-500/20 bg-green-500/5"
                    : "border-dashed border-border hover:border-muted-foreground/30"
                }`}
              >
                {/* Icon */}
                <div className="shrink-0">
                  <Icon className={`h-5 w-5 ${integration.color}`} />
                </div>

                {/* Name + Description */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">
                    {integration.name}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {integration.description}
                  </p>
                </div>

                {/* Action */}
                <div className="shrink-0">
                  {connected ? (
                    <div className="flex items-center gap-1.5">
                      <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                        <Check className="h-3 w-3" />
                        Verbunden
                      </span>
                      <button
                        onClick={() => handleDisconnect(integration.id)}
                        className="rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                      >
                        Trennen
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleConnect(integration.id)}
                      className="rounded-md border border-dashed border-muted-foreground/30 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-[hsl(var(--accent-orange))] hover:text-[hsl(var(--accent-orange))]"
                    >
                      Verbinden
                    </button>
                  )}
                </div>
              </div>

              {/* Connect dialog (inline) */}
              {isConnecting && (
                <div className="mt-1 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                  <p className="mb-2 text-xs text-muted-foreground">
                    API-Key / Token für{" "}
                    <span className="font-medium text-foreground">
                      {integration.name}
                    </span>{" "}
                    eingeben:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="Token oder API-Key..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveToken(integration.id);
                        if (e.key === "Escape") handleCancelConnect();
                      }}
                      className="flex-1 rounded-md border border-border bg-transparent px-2.5 py-1 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-[hsl(var(--accent-orange))]"
                    />
                    <button
                      onClick={() => handleSaveToken(integration.id)}
                      disabled={!tokenInput.trim() || savingId === integration.id}
                      className="flex items-center gap-1 rounded-md bg-[hsl(var(--accent-orange))] px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-[hsl(var(--accent-orange))]/90 disabled:opacity-50"
                    >
                      {savingId === integration.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Speichern
                    </button>
                    <button
                      onClick={handleCancelConnect}
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

      {/* Footer hint */}
      <p className="mt-4 text-center text-[11px] text-muted-foreground/50">
        Weitere Integrationen folgen in Kürze
      </p>
    </div>
  );
}
