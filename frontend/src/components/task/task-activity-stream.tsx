"use client";

import { useState } from "react";
import {
  ArrowRight,
  Bot,
  ChevronDown,
  ChevronRight,
  Edit3,
  FileText,
  MessageSquare,
  ShieldCheck,
  Cpu,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { useTaskActivity } from "@/hooks/use-activity";
import type { TaskActivityEntry } from "@/types";

const TYPE_CONFIG: Record<
  string,
  { icon: typeof Bot; color: string; label: string }
> = {
  status_change: { icon: ArrowRight, color: "text-blue-400", label: "Status" },
  field_change: { icon: Edit3, color: "text-muted-foreground", label: "Änderung" },
  comment: { icon: MessageSquare, color: "text-green-400", label: "Kommentar" },
  output: { icon: FileText, color: "text-[hsl(var(--accent-orange))]", label: "Ergebnis" },
  approval_requested: { icon: ShieldCheck, color: "text-yellow-500", label: "Genehmigung" },
  approval_resolved: { icon: ShieldCheck, color: "text-green-500", label: "Genehmigung" },
  agent_step: { icon: Cpu, color: "text-[var(--agent-glow-color)]", label: "Agent" },
};

function ActivityItem({ entry }: { entry: TaskActivityEntry }) {
  const [expanded, setExpanded] = useState(false);
  const config = TYPE_CONFIG[entry.type] ?? TYPE_CONFIG.field_change;
  const Icon = config.icon;
  const hasDetails = !!(entry.details || entry.content);

  return (
    <div className="group flex gap-3 py-2">
      {/* Timeline dot */}
      <div className="flex flex-col items-center">
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-card ${config.color}`}>
          <Icon className="h-3 w-3" />
        </div>
        <div className="mt-1 w-px flex-1 bg-border/50 group-last:hidden" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm leading-tight">
              <span className="font-medium">{entry.summary}</span>
            </p>
            {entry.actor_name && entry.actor_type !== "system" && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {entry.actor_type === "agent" ? (
                  <span className="inline-flex items-center gap-1">
                    <Bot className="inline h-3 w-3 text-[var(--agent-glow-color)]" />
                    Agent
                  </span>
                ) : (
                  "Du"
                )}
              </p>
            )}
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground/60">
            {formatDistanceToNow(new Date(entry.timestamp), {
              locale: de,
              addSuffix: true,
            })}
          </span>
        </div>

        {/* Expandable details */}
        {hasDetails && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Details
          </button>
        )}
        {expanded && (entry.details || entry.content) && (
          <div className="mt-1.5 rounded-md border border-border bg-secondary/30 p-2 text-xs text-foreground/80 whitespace-pre-wrap">
            {entry.content || entry.details}
          </div>
        )}

        {/* Agent step cost info */}
        {entry.type === "agent_step" && entry.tokens_in != null && (
          <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground/60">
            <span>{entry.tokens_in?.toLocaleString("de-DE")} Token in</span>
            <span>{entry.tokens_out?.toLocaleString("de-DE")} Token out</span>
            {entry.cost_cents != null && entry.cost_cents > 0 && (
              <span>{(entry.cost_cents / 100).toFixed(3)} €</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskActivityStreamProps {
  taskId: string;
}

export function TaskActivityStream({ taskId }: TaskActivityStreamProps) {
  const { activity, isLoading } = useTaskActivity(taskId);

  if (isLoading) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        Aktivität wird geladen...
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        Noch keine Aktivität für diese Aufgabe.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activity.map((entry) => (
        <ActivityItem key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
