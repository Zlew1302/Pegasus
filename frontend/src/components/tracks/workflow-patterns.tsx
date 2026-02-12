"use client";

import { GitBranch, TrendingUp, Loader2 } from "lucide-react";
import { useWorkflowPatterns } from "@/hooks/use-tracks";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

const SYSTEM_COLORS: Record<string, string> = {
  web: "bg-blue-500/20 text-blue-400",
  github: "bg-green-500/20 text-green-400",
  internal_db: "bg-purple-500/20 text-purple-400",
  knowledge_base: "bg-cyan-500/20 text-cyan-400",
  slack: "bg-pink-500/20 text-pink-400",
  email: "bg-amber-500/20 text-amber-400",
  drive: "bg-indigo-500/20 text-indigo-400",
  jira: "bg-orange-500/20 text-orange-400",
  unknown: "bg-slate-500/20 text-slate-400",
};

interface WorkflowPatternsProps {
  embedded?: boolean;
}

export function WorkflowPatterns({
  embedded = false,
}: WorkflowPatternsProps) {
  const { patterns, isLoading } = useWorkflowPatterns();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
        <GitBranch className="mb-2 h-8 w-8 opacity-30" />
        <p className="text-xs">Noch keine Muster erkannt</p>
        <p className="mt-1 text-[10px] opacity-60">
          Muster werden nach mehreren Agent-Runs sichtbar
        </p>
      </div>
    );
  }

  const content = (
    <div className="space-y-2">
      {patterns.map((pattern) => (
        <div
          key={pattern.id}
          className="rounded-md bg-secondary/30 p-2"
        >
          {/* Sequence chain */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1">
            {pattern.sequence.map((step, i) => {
              const color =
                SYSTEM_COLORS[step.system] ?? SYSTEM_COLORS.unknown;
              return (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && (
                    <span className="text-[10px] text-muted-foreground/40">
                      →
                    </span>
                  )}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${color}`}
                  >
                    {step.system}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Metadata row */}
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" />
              {pattern.confidence.toFixed(1)}
            </span>
            <span>{pattern.frequency}x beobachtet</span>
            {pattern.last_observed && (
              <span>
                {formatDistanceToNow(new Date(pattern.last_observed), {
                  locale: de,
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (embedded) return content;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
        <GitBranch className="h-4 w-4 text-[hsl(var(--agent-glow))]" />
        Gelernte Arbeitsablaeufe
      </h3>
      {content}
    </div>
  );
}
