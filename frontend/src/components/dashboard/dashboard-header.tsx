"use client";

import { useMemo, useState } from "react";
import { LayoutGrid, RotateCcw, Bot, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import useSWR from "swr";
import { useDashboardStats } from "@/hooks/use-dashboard";
import { useProfile } from "@/hooks/use-profile";
import { fetcher } from "@/lib/api";
import { InfoPopup } from "./info-popup";
import type { ApprovalWithContext, AgentInstance } from "@/types";

interface DashboardHeaderProps {
  onOpenPicker: () => void;
  onReset: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Guten Morgen";
  if (hour >= 12 && hour < 18) return "Guten Tag";
  if (hour >= 18 && hour < 23) return "Guten Abend";
  return "Gute Nacht";
}

export function DashboardHeader({ onOpenPicker, onReset }: DashboardHeaderProps) {
  const { profile } = useProfile();
  const { stats } = useDashboardStats();

  const [agentPopup, setAgentPopup] = useState(false);
  const [approvalPopup, setApprovalPopup] = useState(false);
  const [taskPopup, setTaskPopup] = useState(false);

  const greeting = useMemo(() => getGreeting(), []);
  const displayName = profile?.display_name || "Lukas";

  return (
    <>
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Greeting + Quick Stats */}
          <div>
            <h1 className="text-lg font-bold">
              {greeting}, {displayName}
            </h1>
            <div className="mt-0.5 flex items-center gap-4 text-xs text-muted-foreground">
              {stats && (
                <>
                  <button
                    onClick={() => setAgentPopup(true)}
                    className="flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    <Bot className="h-3 w-3 text-[var(--agent-glow-color)]" />
                    {stats.active_agents} {stats.active_agents === 1 ? "Agent" : "Agenten"} aktiv
                  </button>
                  {stats.pending_inputs > 0 && (
                    <button
                      onClick={() => setApprovalPopup(true)}
                      className="flex items-center gap-1 text-yellow-500 transition-colors hover:text-yellow-400"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      {stats.pending_inputs} {stats.pending_inputs === 1 ? "Genehmigung" : "Genehmigungen"} offen
                    </button>
                  )}
                  <button
                    onClick={() => setTaskPopup(true)}
                    className="flex items-center gap-1 transition-colors hover:text-foreground"
                  >
                    <Clock className="h-3 w-3" />
                    {stats.tasks_completed_this_week} Tasks diese Woche
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenPicker}
              className="flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Widget hinzufuegen
            </button>
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
              title="Layout zuruecksetzen"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Popups */}
      <AgentPopup open={agentPopup} onClose={() => setAgentPopup(false)} />
      <ApprovalPopup open={approvalPopup} onClose={() => setApprovalPopup(false)} />
      <TasksPopup
        open={taskPopup}
        onClose={() => setTaskPopup(false)}
        count={stats?.tasks_completed_this_week ?? 0}
      />
    </>
  );
}

// ── Agent Popup ────────────────────────────────────────────────

function AgentPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: instances } = useSWR<AgentInstance[]>(
    open ? "/agents/instances?status=running" : null,
    fetcher
  );

  return (
    <InfoPopup open={open} onClose={onClose} title="Aktive Agenten">
      {!instances || instances.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Bot className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">
            Aktuell keine Agenten aktiv.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {instances.map((inst) => (
            <div
              key={inst.id}
              className="rounded-lg border border-border bg-secondary/20 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">{inst.agent_type_id}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                  Aktiv
                </span>
              </div>
              {inst.current_step && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Aktueller Schritt: {inst.current_step}
                </p>
              )}
              {typeof inst.progress_percent === "number" && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Fortschritt</span>
                    <span>{inst.progress_percent}%</span>
                  </div>
                  <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[var(--agent-glow-color)] transition-all"
                      style={{ width: `${inst.progress_percent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </InfoPopup>
  );
}

// ── Approval Popup ─────────────────────────────────────────────

function ApprovalPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: approvals } = useSWR<ApprovalWithContext[]>(
    open ? "/approvals/with-context?status=pending" : null,
    fetcher
  );

  return (
    <InfoPopup open={open} onClose={onClose} title="Offene Genehmigungen">
      {!approvals || approvals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500/30" />
          <p className="text-xs text-muted-foreground">
            Keine offenen Genehmigungen.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map((a) => (
            <ApprovalCard key={a.id} approval={a} />
          ))}
        </div>
      )}
    </InfoPopup>
  );
}

function ApprovalCard({ approval }: { approval: ApprovalWithContext }) {
  return (
    <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
      {/* What does the agent need? */}
      <p className="text-xs font-medium text-yellow-400">
        {approval.description || approval.type}
      </p>

      {/* Context */}
      <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
        {approval.agent_type_name && (
          <div className="flex items-center gap-2">
            <Bot className="h-3 w-3 text-[var(--agent-glow-color)]" />
            <span>Agent: <span className="text-foreground">{approval.agent_type_name}</span></span>
          </div>
        )}
        {approval.task_title && (
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            <span>Aufgabe: <span className="text-foreground">{approval.task_title}</span></span>
          </div>
        )}
        {approval.project_title && (
          <div className="flex items-center gap-2">
            <span className="ml-0.5 h-2 w-2 rounded-sm bg-[hsl(var(--accent-orange))]" />
            <span>Projekt: <span className="text-foreground">{approval.project_title}</span></span>
          </div>
        )}
      </div>

      {/* Progress */}
      {typeof approval.progress_percent === "number" && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>
              {approval.current_step
                ? `Schritt: ${approval.current_step}`
                : "Fortschritt"}
            </span>
            <span>{approval.progress_percent}%</span>
          </div>
          <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-yellow-500 transition-all"
              style={{ width: `${approval.progress_percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Time */}
      <p className="mt-2 text-[10px] text-muted-foreground/60">
        Angefragt{" "}
        {formatDistanceToNow(new Date(approval.requested_at), {
          locale: de,
          addSuffix: true,
        })}
      </p>
    </div>
  );
}

// ── Tasks Popup ────────────────────────────────────────────────

function TasksPopup({
  open,
  onClose,
  count,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
}) {
  return (
    <InfoPopup open={open} onClose={onClose} title="Tasks diese Woche">
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
          <CheckCircle2 className="h-7 w-7 text-green-500" />
        </div>
        <div>
          <p className="text-2xl font-bold text-green-500">{count}</p>
          <p className="text-xs text-muted-foreground">
            {count === 1 ? "Task" : "Tasks"} diese Woche abgeschlossen
          </p>
        </div>
      </div>
    </InfoPopup>
  );
}
