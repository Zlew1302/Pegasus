"use client";

import { useState, useCallback } from "react";
import { Sparkles, ArrowLeft } from "lucide-react";
import { OrchestratorInput } from "./orchestrator-input";
import { OrchestratorStream } from "./orchestrator-stream";
import { startOrchestration } from "@/hooks/use-orchestrator";
import { SidePanel } from "@/components/layout/side-panel";

interface OrchestratorPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

type PanelState = "input" | "running" | "completed";

export function OrchestratorPanel({
  open,
  onClose,
  projectId,
}: OrchestratorPanelProps) {
  const [state, setState] = useState<PanelState>("input");
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (instruction: string) => {
      setIsStarting(true);
      setError(null);

      try {
        const result = await startOrchestration(projectId, instruction);
        setInstanceId(result.instance_id);
        setState("running");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Fehler beim Starten des Orchestrators",
        );
      } finally {
        setIsStarting(false);
      }
    },
    [projectId],
  );

  const handleReset = useCallback(() => {
    setState("input");
    setInstanceId(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    // Nur zurücksetzen wenn nicht gerade am Laufen
    if (state !== "running") {
      handleReset();
    }
    onClose();
  }, [state, onClose, handleReset]);

  return (
    <SidePanel open={open} onClose={handleClose}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          {state !== "input" && (
            <button
              onClick={handleReset}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--accent-orange))]/10">
              <Sparkles className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">KI-Assistent</h2>
              <p className="text-[11px] text-muted-foreground">
                Beschreibe eine Aufgabe — der Orchestrator erledigt den Rest
              </p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Content */}
        {state === "input" && (
          <OrchestratorInput
            onSubmit={handleSubmit}
            isLoading={isStarting}
          />
        )}

        {(state === "running" || state === "completed") && instanceId && (
          <OrchestratorStream
            instanceId={instanceId}
            onStatusChange={(status) => {
              if (
                status === "completed" ||
                status === "error" ||
                status === "cancelled"
              ) {
                setState("completed");
              }
            }}
          />
        )}

        {/* Neue Aufgabe Button (nach Abschluss) */}
        {state === "completed" && (
          <button
            onClick={handleReset}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[hsl(var(--accent-orange))]/30 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-[hsl(var(--accent-orange))] hover:text-[hsl(var(--accent-orange))]"
          >
            <Sparkles className="h-4 w-4" />
            Neue Aufgabe starten
          </button>
        )}
      </div>
    </SidePanel>
  );
}
