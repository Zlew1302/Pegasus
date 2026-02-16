"use client";

import { useRef, useEffect } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Bot,
  Wrench,
  Brain,
  Pause,
  Play,
  Square,
} from "lucide-react";
import { useSSE } from "@/hooks/use-sse";

interface OrchestratorStreamProps {
  instanceId: string;
  onStatusChange?: (status: string) => void;
  onComplete?: () => void;
}

export function OrchestratorStream({
  instanceId,
  onStatusChange,
  onComplete,
}: OrchestratorStreamProps) {
  const sse = useSSE(instanceId, (status) => {
    onStatusChange?.(status);
    if (status === "completed" || status === "error" || status === "cancelled") {
      onComplete?.();
    }
  });

  const thoughtsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sse.thoughts.length]);

  const isRunning = sse.status === "running" || sse.status === "connecting";
  const isCompleted = sse.status === "completed";
  const isError = sse.status === "error";
  const isCancelled = sse.status === "cancelled";
  const isTerminal = isCompleted || isError || isCancelled;

  // Status-Badge
  const StatusBadge = () => {
    if (isCompleted) {
      return (
        <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-400">
          <CheckCircle2 className="h-3 w-3" />
          Abgeschlossen
        </span>
      );
    }
    if (isError) {
      return (
        <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
          <XCircle className="h-3 w-3" />
          Fehler
        </span>
      );
    }
    if (isCancelled) {
      return (
        <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          Abgebrochen
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 rounded-full bg-[hsl(var(--accent-orange))]/10 px-2.5 py-0.5 text-xs font-medium text-[hsl(var(--accent-orange))]">
        <Loader2 className="h-3 w-3 animate-spin" />
        Wird ausgeführt...
      </span>
    );
  };

  // Thought-Eintrag rendern
  const renderThought = (thought: { text: string; timestamp: string }, index: number) => {
    let icon = <Brain className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />;
    let textColor = "text-muted-foreground";

    if (thought.text.startsWith("🔧")) {
      icon = <Wrench className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />;
      textColor = "text-amber-400/80";
    } else if (thought.text.startsWith("🤖")) {
      icon = <Bot className="mt-0.5 h-3 w-3 shrink-0 text-[hsl(var(--accent-orange))]" />;
      textColor = "text-[hsl(var(--accent-orange))]/80";
    } else if (thought.text.startsWith("⏳")) {
      textColor = "text-orange-400/80";
    } else if (thought.text.startsWith("📝")) {
      textColor = "text-blue-400/80";
    }

    return (
      <div
        key={index}
        className="flex items-start gap-2 rounded-md px-2 py-1 text-xs hover:bg-secondary/50"
      >
        {icon}
        <span className={`font-mono ${textColor}`}>{thought.text}</span>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <StatusBadge />
        {sse.progress > 0 && !isTerminal && (
          <span className="text-[11px] text-muted-foreground">
            {Math.round(sse.progress)}%
          </span>
        )}
      </div>

      {/* Progress Bar */}
      {!isTerminal && sse.progress > 0 && (
        <div className="h-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-[hsl(var(--accent-orange))] transition-all duration-300"
            style={{ width: `${sse.progress}%` }}
          />
        </div>
      )}

      {/* Step Info */}
      {!isTerminal && sse.stepDescription && (
        <div className="flex items-center gap-2 rounded-md bg-secondary/30 px-3 py-2 text-xs">
          <Loader2 className="h-3 w-3 animate-spin text-[hsl(var(--accent-orange))]" />
          <span>{sse.stepDescription}</span>
          {sse.totalSteps > 0 && (
            <span className="ml-auto text-muted-foreground">
              Schritt {sse.currentStep}/{sse.totalSteps}
            </span>
          )}
        </div>
      )}

      {/* Thought Stream */}
      {sse.thoughts.length > 0 && (
        <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-lg border border-border bg-secondary/20 p-2">
          {sse.thoughts.map((thought, i) => renderThought(thought, i))}
          <div ref={thoughtsEndRef} />
        </div>
      )}

      {/* Error Message */}
      {isError && sse.errorMessage && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
          {sse.errorMessage}
        </div>
      )}

      {/* Output */}
      {isCompleted && sse.output && (
        <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3">
          <p className="mb-2 text-xs font-medium text-green-400">Ergebnis:</p>
          <div className="prose prose-sm prose-invert max-w-none text-xs">
            <div className="whitespace-pre-wrap">{sse.output}</div>
          </div>
        </div>
      )}

      {/* Cost */}
      {isTerminal && sse.totalCostCents > 0 && (
        <div className="text-right text-[10px] text-muted-foreground">
          Kosten: ${(sse.totalCostCents / 100).toFixed(4)}
        </div>
      )}
    </div>
  );
}
