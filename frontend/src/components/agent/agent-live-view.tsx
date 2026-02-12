"use client";

import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  X,
  Bot,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Coins,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { useSSE } from "@/hooks/use-sse";
import {
  useAgentInstance,
  pauseAgent,
  resumeAgent,
  cancelAgent,
} from "@/hooks/use-agents";
import { ExecutionSteps } from "./execution-steps";
import { InstanceTrackView } from "../tracks/instance-track-view";
import { AgentMessageInput } from "./agent-message-input";

interface AgentLiveViewProps {
  instanceId: string;
  onStatusChange?: (status: string) => void;
}

export function AgentLiveView({
  instanceId,
  onStatusChange,
}: AgentLiveViewProps) {
  const sse = useSSE(instanceId, onStatusChange);
  const sseActive = sse.status === "running" || sse.status === "connecting";
  const { instance } = useAgentInstance(instanceId, { pollDisabled: sseActive });
  const thoughtsEndRef = useRef<HTMLDivElement>(null);
  const [showOutput, setShowOutput] = useState(false);

  useEffect(() => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sse.thoughts]);

  const handlePause = async () => {
    await pauseAgent(instanceId);
  };

  const handleResume = async () => {
    await resumeAgent(instanceId);
  };

  const handleCancel = async () => {
    await cancelAgent(instanceId);
  };

  const isRunning = sse.status === "running";
  const isPaused = instance?.status === "paused";
  const isCompleted = sse.status === "completed";
  const isError = sse.status === "error";
  const isCancelled = sse.status === "cancelled";
  const isTerminal = isCompleted || isError || isCancelled;
  const totalSteps = sse.totalSteps || instance?.total_steps || 1;
  const costCents = sse.totalCostCents || instance?.total_cost_cents || 0;

  const stepBars = Array.from({ length: totalSteps }, (_, i) => i);

  return (
    <div
      className={`rounded-lg border bg-card ${
        isError
          ? "border-red-500/30"
          : isCancelled
            ? "border-muted-foreground/30"
            : "border-[var(--agent-glow-color)]/30"
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Bot
          className={`h-4 w-4 ${
            isError
              ? "text-red-500"
              : "text-[var(--agent-glow-color)]"
          }`}
        />
        <span className="text-sm font-medium">Agent</span>

        {/* Cost badge */}
        {costCents > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
            <Coins className="h-2.5 w-2.5" />
            {(costCents / 100).toFixed(3)} €
          </span>
        )}

        <span className="ml-auto">
          {(isRunning || sse.status === "connecting") && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--agent-glow-color)]" />
          )}
          {isCompleted && (
            <span className="text-xs text-green-500">Abgeschlossen</span>
          )}
          {isError && (
            <span className="flex items-center gap-1 text-xs text-red-500">
              <AlertTriangle className="h-3 w-3" />
              Fehler
            </span>
          )}
          {isCancelled && (
            <span className="text-xs text-muted-foreground">Abgebrochen</span>
          )}
        </span>
      </div>

      {/* Error Banner */}
      {isError && sse.errorMessage && (
        <div className="border-b border-red-500/20 bg-red-500/5 px-3 py-2">
          <p className="text-xs text-red-400">{sse.errorMessage}</p>
        </div>
      )}

      {/* Progress */}
      {!isTerminal && (
        <div className="px-3 py-2">
          {/* Step indicator */}
          <div className="mb-2 flex gap-1">
            {stepBars.map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < sse.currentStep
                    ? "bg-[var(--agent-glow-color)]"
                    : i === sse.currentStep && isRunning
                      ? "bg-[var(--agent-glow-color)]/50"
                      : "bg-muted"
                }`}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {sse.stepDescription || "Initialisiere..."}
          </p>

          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-[var(--agent-glow-color)] transition-all duration-700"
              style={{ width: `${sse.progress}%` }}
            />
          </div>
          <p className="mt-1 text-right text-[10px] text-muted-foreground">
            {sse.progress}%
          </p>
        </div>
      )}

      {/* Thought stream */}
      <div className="border-t border-border">
        <div className="max-h-48 overflow-y-auto p-3">
          <div className="space-y-1 font-mono text-xs text-muted-foreground">
            {sse.thoughts.length === 0 && !isTerminal && (
              <p className="italic">Warte auf Gedanken...</p>
            )}
            {sse.thoughts.map((thought, i) => {
              const isToolCall = thought.text.startsWith("🔧");
              const isSubAgent = thought.text.startsWith("🤖");
              const isRetry = thought.text.startsWith("⏳");
              const isRevision = thought.text.startsWith("📝");

              return (
                <p
                  key={i}
                  className={`leading-relaxed ${
                    isToolCall
                      ? "text-amber-400/80"
                      : isSubAgent
                        ? "text-[var(--agent-glow-color)]/80"
                        : isRetry
                          ? "text-orange-400/80"
                          : isRevision
                            ? "text-blue-400/80"
                            : ""
                  }`}
                >
                  {thought.text}
                </p>
              );
            })}
            <div ref={thoughtsEndRef} />
          </div>
        </div>
      </div>

      {/* Live Output Preview */}
      {sse.output && (
        <div className="border-t border-border">
          <button
            onClick={() => setShowOutput(!showOutput)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {showOutput ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            Ergebnis anzeigen
          </button>
          {showOutput && (
            <div className="max-h-64 overflow-y-auto border-t border-border px-3 py-2">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {sse.output}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message Input (when running) */}
      {(isRunning || isPaused) && (
        <div className="border-t border-border px-3 py-2">
          <AgentMessageInput instanceId={instanceId} />
        </div>
      )}

      {/* Controls */}
      {(isRunning || isPaused) && (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          {isPaused ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={handleResume}
            >
              <Play className="h-3 w-3" />
              Fortsetzen
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={handlePause}
            >
              <Pause className="h-3 w-3" />
              Pausieren
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-red-400"
            onClick={handleCancel}
          >
            <X className="h-3 w-3" />
            Abbrechen
          </Button>
        </div>
      )}

      {/* Execution Steps (after terminal state) */}
      {isTerminal && (
        <div className="border-t border-border px-3 py-2">
          <ExecutionSteps instanceId={instanceId} />
          <InstanceTrackView instanceId={instanceId} />
        </div>
      )}
    </div>
  );
}
