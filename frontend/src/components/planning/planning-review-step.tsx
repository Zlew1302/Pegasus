"use client";

import { useState, useCallback } from "react";
import {
  ArrowLeft,
  RefreshCw,
  CheckCircle2,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Bot,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAgentTypes } from "@/hooks/use-agents";
import { confirmPlan } from "@/hooks/use-planning-workflow";
import type {
  PlanningSession,
  GeneratedPlan,
  PlanTaskSuggestion,
  MilestoneSuggestion,
} from "@/types";

interface PlanningReviewStepProps {
  session: PlanningSession;
  plan: GeneratedPlan;
  onBack: () => void;
  onRegenerate: () => void;
  onConfirmed: () => void;
}

const PRIORITY_OPTIONS = [
  { value: "critical", label: "Kritisch" },
  { value: "high", label: "Hoch" },
  { value: "medium", label: "Mittel" },
  { value: "low", label: "Niedrig" },
];

export function PlanningReviewStep({
  session,
  plan,
  onBack,
  onRegenerate,
  onConfirmed,
}: PlanningReviewStepProps) {
  const { agentTypes } = useAgentTypes();

  const [tasks, setTasks] = useState<PlanTaskSuggestion[]>(plan.tasks);
  const [summary, setSummary] = useState(plan.summary);
  const [autoStart, setAutoStart] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter out the workflow planning agent from the dropdown
  const assignableAgents = agentTypes.filter(
    (a) => a.id !== "agent-workflow-planning-001",
  );

  const updateTask = useCallback(
    (index: number, updates: Partial<PlanTaskSuggestion>) => {
      setTasks((prev) =>
        prev.map((t, i) => (i === index ? { ...t, ...updates } : t)),
      );
    },
    [],
  );

  const removeTask = useCallback((index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addTask = useCallback(() => {
    setTasks((prev) => [
      ...prev,
      {
        title: "",
        description: null,
        priority: "medium",
        agent_type_id: null,
        agent_type_name: null,
        estimated_duration_minutes: null,
        tags: null,
        acceptance_criteria: null,
        milestone: null,
        order: prev.length + 1,
      },
    ]);
  }, []);

  const moveTask = useCallback((index: number, direction: "up" | "down") => {
    setTasks((prev) => {
      const newTasks = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newTasks.length) return prev;
      [newTasks[index], newTasks[targetIndex]] = [
        newTasks[targetIndex],
        newTasks[index],
      ];
      // Update order
      return newTasks.map((t, i) => ({ ...t, order: i + 1 }));
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    setShowConfirmDialog(false);
    setIsConfirming(true);
    setError(null);

    // Validate: at least one task with a title
    const validTasks = tasks.filter((t) => t.title.trim());
    if (validTasks.length === 0) {
      setError("Mindestens ein Task mit Titel ist erforderlich.");
      setIsConfirming(false);
      return;
    }

    try {
      await confirmPlan(session.id, validTasks, autoStart);
      onConfirmed();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Fehler beim Bestätigen des Plans",
      );
      setIsConfirming(false);
    }
  }, [session.id, tasks, autoStart, onConfirmed]);

  // Group tasks by milestone
  const milestones = new Map<string, number[]>();
  tasks.forEach((task, index) => {
    const ms = task.milestone || "Ohne Meilenstein";
    if (!milestones.has(ms)) milestones.set(ms, []);
    milestones.get(ms)!.push(index);
  });

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Summary */}
      <section>
        <label className="text-sm font-medium text-muted-foreground mb-1 block">
          Plan-Zusammenfassung
        </label>
        <textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-[hsl(var(--accent-orange))] focus:outline-none resize-y"
        />
      </section>

      {/* Task list grouped by milestone */}
      <section className="space-y-4">
        {Array.from(milestones.entries()).map(([milestoneName, taskIndices]) => (
          <div key={milestoneName}>
            <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--accent-orange))]" />
              {milestoneName}
            </h3>

            <div className="space-y-3">
              {taskIndices.map((taskIndex) => {
                const task = tasks[taskIndex];
                return (
                  <TaskCard
                    key={taskIndex}
                    task={task}
                    index={taskIndex}
                    totalTasks={tasks.length}
                    assignableAgents={assignableAgents}
                    onUpdate={updateTask}
                    onRemove={removeTask}
                    onMove={moveTask}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <Button
          variant="outline"
          size="sm"
          className="gap-2 w-full border-dashed"
          onClick={addTask}
        >
          <Plus className="h-4 w-4" />
          Task hinzufügen
        </Button>
      </section>

      {/* Auto-start option */}
      <section className="flex items-center gap-3 rounded-md border border-border/50 p-3">
        <input
          type="checkbox"
          id="auto-start"
          checked={autoStart}
          onChange={(e) => setAutoStart(e.target.checked)}
          className="h-4 w-4 rounded border-input accent-[hsl(var(--accent-orange))]"
        />
        <label htmlFor="auto-start" className="text-sm cursor-pointer">
          <span className="font-medium text-foreground">
            Agenten nach Bestätigung automatisch starten
          </span>
          <p className="text-xs text-muted-foreground mt-0.5">
            Zugewiesene Agenten beginnen sofort mit der Arbeit. Andernfalls musst du sie manuell starten.
          </p>
        </label>
      </section>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <div className="rounded-md border border-[hsl(var(--accent-orange))]/30 bg-[hsl(var(--accent-orange))]/5 p-4">
          <p className="text-sm font-medium text-foreground">
            Möchtest du {tasks.filter((t) => t.title.trim()).length} Tasks erstellen?
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Die Tasks werden im Board angelegt
            {autoStart && " und zugewiesene Agenten automatisch gestartet"}.
            Alle Änderungen werden im Audit Trail festgehalten.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={isConfirming}
              className="gap-2 bg-[hsl(var(--accent-orange))] text-white hover:bg-[hsl(var(--accent-orange))]/90"
            >
              {isConfirming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Ja, erstellen
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={isConfirming}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between pt-4 border-t border-border/50">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Button>
          <Button variant="outline" onClick={onRegenerate} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Neu generieren
          </Button>
        </div>
        <Button
          onClick={() => setShowConfirmDialog(true)}
          disabled={isConfirming || tasks.filter((t) => t.title.trim()).length === 0}
          className="gap-2 bg-[hsl(var(--accent-orange))] text-white hover:bg-[hsl(var(--accent-orange))]/90"
        >
          <CheckCircle2 className="h-4 w-4" />
          Plan bestätigen
        </Button>
      </div>
    </div>
  );
}

// ── Task Card Component ──────────────────────────────────

interface TaskCardProps {
  task: PlanTaskSuggestion;
  index: number;
  totalTasks: number;
  assignableAgents: { id: string; name: string }[];
  onUpdate: (index: number, updates: Partial<PlanTaskSuggestion>) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
}

function TaskCard({
  task,
  index,
  totalTasks,
  assignableAgents,
  onUpdate,
  onRemove,
  onMove,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border/50 bg-card p-3">
      {/* Header row */}
      <div className="flex items-start gap-2">
        {/* Move buttons */}
        <div className="flex flex-col gap-0.5 shrink-0 pt-1">
          <button
            onClick={() => onMove(index, "up")}
            disabled={index === 0}
            className="p-0.5 rounded hover:bg-accent/10 disabled:opacity-20"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={() => onMove(index, "down")}
            disabled={index === totalTasks - 1}
            className="p-0.5 rounded hover:bg-accent/10 disabled:opacity-20"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Title */}
        <input
          value={task.title}
          onChange={(e) => onUpdate(index, { title: e.target.value })}
          placeholder="Task-Titel..."
          className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none border-b border-transparent focus:border-[hsl(var(--accent-orange))]"
        />

        {/* Priority */}
        <select
          value={task.priority}
          onChange={(e) => onUpdate(index, { priority: e.target.value })}
          className="rounded border border-input bg-background px-2 py-1 text-xs shrink-0"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Agent assignment */}
        <div className="flex items-center gap-1 shrink-0">
          <Bot className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={task.agent_type_id || ""}
            onChange={(e) => {
              const agentId = e.target.value || null;
              const agent = assignableAgents.find((a) => a.id === agentId);
              onUpdate(index, {
                agent_type_id: agentId,
                agent_type_name: agent?.name || null,
              });
            }}
            className="rounded border border-input bg-background px-2 py-1 text-xs max-w-[140px]"
          >
            <option value="">Kein Agent</option>
            {assignableAgents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Expand / Remove */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded hover:bg-accent/10 text-muted-foreground hover:text-foreground shrink-0"
          title={expanded ? "Einklappen" : "Details anzeigen"}
        >
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        <button
          onClick={() => onRemove(index)}
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
          title="Task entfernen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 space-y-3 pl-7">
          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Beschreibung
            </label>
            <textarea
              value={task.description || ""}
              onChange={(e) =>
                onUpdate(index, { description: e.target.value || null })
              }
              placeholder="Beschreibung der Aufgabe..."
              className="w-full min-h-[60px] rounded-md border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:border-[hsl(var(--accent-orange))] focus:outline-none resize-y"
            />
          </div>

          {/* Acceptance Criteria */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Akzeptanzkriterien
            </label>
            <textarea
              value={task.acceptance_criteria || ""}
              onChange={(e) =>
                onUpdate(index, {
                  acceptance_criteria: e.target.value || null,
                })
              }
              placeholder="Was muss erfüllt sein?"
              className="w-full min-h-[40px] rounded-md border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:border-[hsl(var(--accent-orange))] focus:outline-none resize-y"
            />
          </div>

          <div className="flex gap-3">
            {/* Duration */}
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">
                Geschätzte Dauer (Min.)
              </label>
              <input
                type="number"
                value={task.estimated_duration_minutes ?? ""}
                onChange={(e) =>
                  onUpdate(index, {
                    estimated_duration_minutes: e.target.value
                      ? parseInt(e.target.value)
                      : null,
                  })
                }
                placeholder="60"
                min={1}
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:border-[hsl(var(--accent-orange))] focus:outline-none"
              />
            </div>

            {/* Tags */}
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">
                Tags
              </label>
              <input
                value={task.tags || ""}
                onChange={(e) =>
                  onUpdate(index, { tags: e.target.value || null })
                }
                placeholder="RESEARCH,CONTENT"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:border-[hsl(var(--accent-orange))] focus:outline-none"
              />
            </div>

            {/* Milestone */}
            <div className="flex-1">
              <label className="text-xs text-muted-foreground block mb-1">
                Meilenstein
              </label>
              <input
                value={task.milestone || ""}
                onChange={(e) =>
                  onUpdate(index, { milestone: e.target.value || null })
                }
                placeholder="Phase 1"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:border-[hsl(var(--accent-orange))] focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
