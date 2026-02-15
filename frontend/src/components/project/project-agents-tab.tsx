"use client";

import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Bot,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Coins,
  Zap,
  Plus,
  Pause,
  Play,
  Square,
  RotateCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchBar } from "@/components/ui/search-bar";
import {
  useProjectAgentInstances,
  useExecutionSteps,
  pauseAgent,
  resumeAgent,
  cancelAgent,
  deleteAgentInstance,
} from "@/hooks/use-agents";
import { mutateAfterAgentAction } from "@/lib/swr-helpers";
import { AgentCreateDialog } from "@/components/agent/agent-create-dialog";
import { ExecutionSteps } from "@/components/agent/execution-steps";
import { InstanceTrackView } from "@/components/tracks/instance-track-view";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AgentInstanceWithTask, AgentInstanceStatus } from "@/types";

interface ProjectAgentsTabProps {
  projectId: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof Bot; color: string; bg: string }
> = {
  initializing: { label: "Startet", icon: Loader2, color: "text-blue-400", bg: "bg-blue-500/10" },
  running: { label: "Aktiv", icon: Zap, color: "text-[var(--agent-glow-color)]", bg: "bg-orange-500/10" },
  paused: { label: "Pausiert", icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  waiting_input: { label: "Wartet", icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/10" },
  completed: { label: "Fertig", icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
  failed: { label: "Fehler", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
  cancelled: { label: "Abgebrochen", icon: XCircle, color: "text-muted-foreground", bg: "bg-muted/50" },
};

type StatusFilter = "all" | "active" | "completed" | "failed";

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "–";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Gerade eben";
  if (diffMin < 60) return `vor ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `vor ${diffD}d`;
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "–";
  const start = new Date(startedAt);
  const end = completedAt ? new Date(completedAt) : new Date();
  const diffMs = end.getTime() - start.getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

// ── Detail View ──────────────────────────────────────────────

function AgentInstanceDetail({
  instance,
  onBack,
  onAction,
}: {
  instance: AgentInstanceWithTask;
  onBack: () => void;
  onAction: () => void;
}) {
  const { steps } = useExecutionSteps(instance.id);
  const config = STATUS_CONFIG[instance.status] ?? STATUS_CONFIG.completed;
  const StatusIcon = config.icon;
  const [cancelConfirm, setCancelConfirm] = useState(false);

  // Defensive thought_log parsing — validate each element
  let thoughts: { text: string; timestamp: string }[] = [];
  if (instance.thought_log) {
    try {
      const parsed = JSON.parse(instance.thought_log);
      if (Array.isArray(parsed)) {
        thoughts = parsed.filter(
          (t): t is { text: string; timestamp: string } =>
            t != null && typeof t === "object" && typeof t.text === "string",
        );
      }
    } catch {
      // ignore malformed JSON
    }
  }

  // Token sums from steps
  const totalTokensIn = steps.reduce((s, st) => s + (st.tokens_in ?? 0), 0);
  const totalTokensOut = steps.reduce((s, st) => s + (st.tokens_out ?? 0), 0);

  const progressPercent = instance.progress_percent ?? 0;
  const totalCostCents = instance.total_cost_cents ?? 0;

  const canPause = instance.status === "running";
  const canResume = instance.status === "paused";
  const canCancel = ["initializing", "running", "paused", "waiting_input"].includes(instance.status);
  const canRestart = ["completed", "failed", "cancelled"].includes(instance.status);

  const handlePause = async () => {
    try { await pauseAgent(instance.id); onAction(); mutateAfterAgentAction(); } catch { /* silent */ }
  };
  const handleResume = async () => {
    try { await resumeAgent(instance.id); onAction(); mutateAfterAgentAction(); } catch { /* silent */ }
  };
  const handleCancel = async () => {
    try { await cancelAgent(instance.id); onAction(); mutateAfterAgentAction(); } catch { /* silent */ }
    setCancelConfirm(false);
  };

  return (
    <div className="space-y-4">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{instance.agent_type_name ?? "Agent"}</h3>
          <p className="text-sm text-muted-foreground">{instance.task_title ?? "Unbekannte Aufgabe"}</p>
        </div>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.color} ${config.bg}`}>
          <StatusIcon className={`h-3 w-3 ${instance.status === "running" || instance.status === "initializing" ? "animate-spin" : ""}`} />
          {config.label}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {canPause && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePause}>
            <Pause className="h-3.5 w-3.5" />
            Pausieren
          </Button>
        )}
        {canResume && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleResume}>
            <Play className="h-3.5 w-3.5" />
            Fortsetzen
          </Button>
        )}
        {canRestart && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={async () => {
            try {
              const { restartAgent } = await import("@/hooks/use-agents");
              await restartAgent(instance.id);
              onAction();
              mutateAfterAgentAction();
              onBack();
            } catch { /* silent */ }
          }}>
            <RotateCw className="h-3.5 w-3.5" />
            Neu starten
          </Button>
        )}
        {canCancel && (
          <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setCancelConfirm(true)}>
            <Square className="h-3.5 w-3.5" />
            Abbrechen
          </Button>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Laufzeit</p>
          <p className="text-lg font-semibold">{formatDuration(instance.started_at, instance.completed_at)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Kosten</p>
          <p className="text-lg font-semibold">{(totalCostCents / 100).toFixed(3)} €</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tokens rein</p>
          <p className="text-lg font-semibold">{totalTokensIn.toLocaleString("de-DE")}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Tokens raus</p>
          <p className="text-lg font-semibold">{totalTokensOut.toLocaleString("de-DE")}</p>
        </div>
      </div>

      {/* Progress */}
      {progressPercent > 0 && (
        <div>
          <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Fortschritt</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--agent-glow-color)] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {instance.current_step && (
            <p className="mt-1 text-xs text-muted-foreground">{instance.current_step}</p>
          )}
        </div>
      )}

      {/* Thought Log */}
      {thoughts.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">Gedankenprotokoll</h4>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-background p-3">
            <div className="space-y-1 font-mono text-xs text-muted-foreground">
              {thoughts.slice(-30).map((t, i) => (
                <p key={i} className={`leading-relaxed ${t.text?.startsWith("🔧") ? "text-amber-400/80" : t.text?.startsWith("🤖") ? "text-blue-400/80" : ""}`}>
                  {t.text ?? ""}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Execution Steps */}
      <div>
        <h4 className="mb-2 text-sm font-medium text-muted-foreground">Ausführungsschritte</h4>
        <ExecutionSteps instanceId={instance.id} />
      </div>

      {/* Decision Tracks */}
      <div>
        <h4 className="mb-2 text-sm font-medium text-muted-foreground">Decision Tracks</h4>
        <InstanceTrackView instanceId={instance.id} />
      </div>

      {/* Cancel Confirmation */}
      <ConfirmDialog
        open={cancelConfirm}
        title="Agent abbrechen?"
        message={`"${instance.agent_type_name ?? "Agent"}" wird gestoppt. Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Abbrechen"
        destructive
        onConfirm={handleCancel}
        onCancel={() => setCancelConfirm(false)}
      />
    </div>
  );
}

// ── List View ────────────────────────────────────────────────

export function ProjectAgentsTab({ projectId }: ProjectAgentsTabProps) {
  const { instances, isLoading, mutate } = useProjectAgentInstances(projectId);
  const [selectedInstance, setSelectedInstance] = useState<AgentInstanceWithTask | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgentInstanceWithTask | null>(null);

  const handleDeleteInstance = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAgentInstance(deleteTarget.id);
      mutate();
      mutateAfterAgentAction();
      setDeleteTarget(null);
    } catch {
      /* silent */
    }
  };

  if (selectedInstance) {
    return (
      <div className="p-4">
        <AgentInstanceDetail
          instance={selectedInstance}
          onBack={() => setSelectedInstance(null)}
          onAction={() => mutate()}
        />
      </div>
    );
  }

  const filtered = instances.filter((inst) => {
    // Status filter
    if (statusFilter === "active" && !["initializing", "running", "paused", "waiting_input"].includes(inst.status)) return false;
    if (statusFilter === "completed" && inst.status !== "completed") return false;
    if (statusFilter === "failed" && !["failed", "cancelled"].includes(inst.status)) return false;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = (inst.task_title ?? "").toLowerCase().includes(q);
      const matchType = (inst.agent_type_name ?? "").toLowerCase().includes(q);
      const matchStatus = (STATUS_CONFIG[inst.status]?.label ?? "").toLowerCase().includes(q);
      if (!matchTitle && !matchType && !matchStatus) return false;
    }

    return true;
  });

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Alle" },
    { key: "active", label: "Aktiv" },
    { key: "completed", label: "Fertig" },
    { key: "failed", label: "Fehler" },
  ];

  return (
    <div className="p-4">
      {/* Search */}
      <div className="mb-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Agenten durchsuchen..."
        />
      </div>

      {/* Filter Tabs + Create Button */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f.label}
          </button>
        ))}
        </div>
        <button
          onClick={() => setShowCreateDialog(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--agent-glow-color)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90"
        >
          <Plus className="h-3 w-3" />
          Neuer Agent
        </button>
      </div>

      {/* Agent Create Dialog */}
      <AgentCreateDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bot className="mb-3 h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {statusFilter === "all"
              ? "Noch keine Agenten in diesem Projekt"
              : "Keine Agenten mit diesem Status"}
          </p>
        </div>
      )}

      {/* Instance Cards */}
      <div className="space-y-2">
        {filtered.map((inst) => {
          const config = STATUS_CONFIG[inst.status] ?? STATUS_CONFIG.completed;
          const StatusIcon = config.icon;

          return (
            <div
              key={inst.id}
              className="group/card relative rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <button
                onClick={() => setSelectedInstance(inst)}
                className="w-full text-left"
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 rounded-full p-1.5 ${config.bg}`}>
                    <Bot className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{inst.agent_type_name ?? "Agent"}</span>
                      <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${config.color} ${config.bg}`}>
                        <StatusIcon className={`h-2.5 w-2.5 ${inst.status === "running" || inst.status === "initializing" ? "animate-spin" : ""}`} />
                        {config.label}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {inst.task_title ?? "Unbekannte Aufgabe"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
                      {(inst.progress_percent ?? 0) > 0 && (inst.progress_percent ?? 0) < 100 && (
                        <span className="flex items-center gap-1">
                          <div className="h-1 w-12 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[var(--agent-glow-color)]"
                              style={{ width: `${inst.progress_percent ?? 0}%` }}
                            />
                          </div>
                          {inst.progress_percent ?? 0}%
                        </span>
                      )}
                      {inst.current_step && (
                        <span className="max-w-[200px] truncate">{inst.current_step}</span>
                      )}
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatRelativeTime(inst.started_at)}
                      </span>
                      {(inst.total_cost_cents ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Coins className="h-2.5 w-2.5" />
                          {((inst.total_cost_cents ?? 0) / 100).toFixed(3)} €
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
              {/* Delete button — visible on hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteTarget(inst);
                }}
                className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover/card:opacity-100"
                title="Löschen"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Agent-Instanz löschen?"
        message={`"${deleteTarget?.agent_type_name ?? "Agent"}" und alle zugehörigen Daten werden gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Löschen"
        destructive
        onConfirm={handleDeleteInstance}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
