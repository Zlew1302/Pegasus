"use client";

import { useState } from "react";
import { Brain, Wrench, ChevronDown, ChevronRight, RotateCw } from "lucide-react";
import { useExecutionSteps } from "@/hooks/use-agents";

interface ExecutionStepsProps {
  instanceId: string;
}

export function ExecutionSteps({ instanceId }: ExecutionStepsProps) {
  const { steps, isLoading } = useExecutionSteps(instanceId);
  const [expanded, setExpanded] = useState(false);

  if (isLoading || steps.length === 0) return null;

  const totalCost = steps.reduce((sum, s) => sum + (s.cost_cents ?? 0), 0);
  const totalTokensIn = steps.reduce((sum, s) => sum + (s.tokens_in ?? 0), 0);
  const totalTokensOut = steps.reduce((sum, s) => sum + (s.tokens_out ?? 0), 0);

  return (
    <div className="rounded-lg border border-border bg-card/50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="font-medium">
          {steps.length} Schritte
        </span>
        <span className="ml-auto">
          {totalTokensIn.toLocaleString()}↓ / {totalTokensOut.toLocaleString()}↑ Tokens
          {" · "}
          {(totalCost / 100).toFixed(2)} €
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="divide-y divide-border/50">
            {steps.map((step) => (
              <div
                key={step.id}
                className="flex items-center gap-2 px-3 py-1.5 text-xs"
              >
                <span className="w-5 text-center text-muted-foreground">
                  {step.step_number}
                </span>
                {step.step_type === "llm_call" ? (
                  <Brain className="h-3 w-3 text-[var(--agent-glow-color)]" />
                ) : step.step_type === "tool_call" ? (
                  <Wrench className="h-3 w-3 text-amber-400" />
                ) : (
                  <RotateCw className="h-3 w-3 text-blue-400" />
                )}
                <span className="flex-1 truncate text-muted-foreground">
                  {step.description ?? "–"}
                </span>
                {step.duration_ms != null && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {step.duration_ms > 1000
                      ? `${(step.duration_ms / 1000).toFixed(1)}s`
                      : `${step.duration_ms}ms`}
                  </span>
                )}
                {step.cost_cents != null && step.cost_cents > 0 && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {(step.cost_cents / 100).toFixed(3)} €
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
