"use client";

import { useEffect, useCallback } from "react";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSSE } from "@/hooks/use-sse";
import { getPlanningSession } from "@/hooks/use-planning-workflow";
import type { GeneratedPlan } from "@/types";

interface PlanningGeneratingStepProps {
  instanceId: string;
  sessionId: string;
  onComplete: (plan: GeneratedPlan) => void;
  onError: () => void;
}

export function PlanningGeneratingStep({
  instanceId,
  sessionId,
  onComplete,
  onError,
}: PlanningGeneratingStepProps) {
  const sse = useSSE(instanceId);

  // When agent completes, fetch the generated plan from session
  useEffect(() => {
    if (sse.status !== "completed") return;

    const fetchPlan = async () => {
      try {
        const session = await getPlanningSession(sessionId);
        if (session.generated_plan) {
          const plan: GeneratedPlan = JSON.parse(session.generated_plan);
          onComplete(plan);
        } else {
          onError();
        }
      } catch {
        onError();
      }
    };

    fetchPlan();
  }, [sse.status, sessionId, onComplete, onError]);

  // Show latest thought
  const latestThought = sse.thoughts.length > 0
    ? sse.thoughts[sse.thoughts.length - 1].text
    : null;

  return (
    <div className="flex flex-col items-center gap-6 py-12">
      {sse.status === "error" ? (
        <>
          <AlertCircle className="h-12 w-12 text-destructive" />
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Fehler bei der Generierung</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md">
              {sse.errorMessage || "Ein unerwarteter Fehler ist aufgetreten."}
            </p>
          </div>
          <Button variant="outline" onClick={onError} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Erneut versuchen
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="h-12 w-12 text-[hsl(var(--accent-orange))] animate-spin" />

          {/* Progress bar */}
          <div className="w-full max-w-md">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>
                {sse.stepDescription || "Initialisierung..."}
              </span>
              <span>{sse.progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-border/50 overflow-hidden">
              <div
                className="h-full rounded-full bg-[hsl(var(--accent-orange))] transition-all duration-500"
                style={{ width: `${sse.progress}%` }}
              />
            </div>
            {sse.totalSteps > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Schritt {sse.currentStep} von {sse.totalSteps}
              </p>
            )}
          </div>

          {/* Thought stream */}
          {latestThought && (
            <div className="w-full max-w-md rounded-md border border-border/30 bg-card/50 p-3 max-h-[120px] overflow-y-auto">
              <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                {latestThought}
              </p>
            </div>
          )}

          {sse.totalCostCents > 0 && (
            <p className="text-xs text-muted-foreground">
              Kosten: {(sse.totalCostCents / 100).toFixed(4)} $
            </p>
          )}
        </>
      )}
    </div>
  );
}
