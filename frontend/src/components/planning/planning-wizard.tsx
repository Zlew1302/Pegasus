"use client";

import { useState, useCallback, useEffect } from "react";
import { Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PlanningChoiceStep } from "./planning-choice-step";
import { PlanningInputStep } from "./planning-input-step";
import { PlanningGeneratingStep } from "./planning-generating-step";
import { PlanningReviewStep } from "./planning-review-step";
import {
  createPlanningSession,
  cancelPlanningSession,
  generatePlan,
} from "@/hooks/use-planning-workflow";
import type { PlanningSession, GeneratedPlan } from "@/types";

type WizardStep = "choice" | "input" | "generating" | "review";

interface PlanningWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onPlanConfirmed: () => void;
}

export function PlanningWizard({
  open,
  onOpenChange,
  projectId,
  onPlanConfirmed,
}: PlanningWizardProps) {
  const [step, setStep] = useState<WizardStep>("choice");
  const [session, setSession] = useState<PlanningSession | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("choice");
      setSession(null);
      setGeneratedPlan(null);
      setError(null);
    }
  }, [open]);

  const handleClose = useCallback(async () => {
    // Cancel session if not confirmed
    if (session && session.status !== "confirmed" && session.status !== "cancelled") {
      try {
        await cancelPlanningSession(session.id);
      } catch {
        // Ignore errors on cleanup
      }
    }
    onOpenChange(false);
  }, [session, onOpenChange]);

  const handleChoiceSelect = useCallback(
    async (mode: "project_overview" | "custom_input") => {
      try {
        setError(null);
        const newSession = await createPlanningSession(projectId, mode);
        setSession(newSession);

        if (mode === "project_overview") {
          // Skip input step, go directly to generation
          const updated = await generatePlan(newSession.id);
          setSession(updated);
          setStep("generating");
        } else {
          setStep("input");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Fehler beim Erstellen der Sitzung");
      }
    },
    [projectId],
  );

  const handleInputComplete = useCallback(async () => {
    if (!session) return;
    try {
      setError(null);
      const updated = await generatePlan(session.id);
      setSession(updated);
      setStep("generating");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Starten der Generierung");
    }
  }, [session]);

  const handleGenerationComplete = useCallback(
    (plan: GeneratedPlan) => {
      setGeneratedPlan(plan);
      setStep("review");
    },
    [],
  );

  const handleGenerationError = useCallback(() => {
    setStep("input");
  }, []);

  const handleBackToInput = useCallback(() => {
    setGeneratedPlan(null);
    setStep(session?.input_mode === "project_overview" ? "choice" : "input");
  }, [session]);

  const handleRegenerate = useCallback(async () => {
    if (!session) return;
    try {
      setError(null);
      const updated = await generatePlan(session.id);
      setSession(updated);
      setStep("generating");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Neugenerieren");
    }
  }, [session]);

  const handlePlanConfirmed = useCallback(() => {
    onPlanConfirmed();
    onOpenChange(false);
  }, [onPlanConfirmed, onOpenChange]);

  const stepTitles: Record<WizardStep, string> = {
    choice: "KI-Planung starten",
    input: "Kontext bereitstellen",
    generating: "Plan wird generiert...",
    review: "Plan überprüfen",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-5xl max-h-[85vh] flex flex-col overflow-hidden"
        onInteractOutside={(e) => {
          // Prevent closing on outside click during generation
          if (step === "generating") e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-[hsl(var(--accent-orange))]" />
            {stepTitles[step]}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {step === "choice" && "Lass einen KI-Agenten einen Arbeitsplan für dein Projekt erstellen."}
            {step === "input" && "Stelle zusätzlichen Kontext bereit, damit der Plan besser wird."}
            {step === "generating" && "Der Agent analysiert den Kontext und erstellt einen Plan..."}
            {step === "review" && "Überprüfe und bearbeite den Plan. Nichts wird ohne deine Bestätigung geändert."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          {step === "choice" && (
            <PlanningChoiceStep onSelect={handleChoiceSelect} />
          )}

          {step === "input" && session && (
            <PlanningInputStep
              session={session}
              projectId={projectId}
              onSessionUpdate={setSession}
              onGenerate={handleInputComplete}
              onBack={() => setStep("choice")}
            />
          )}

          {step === "generating" && session?.agent_instance_id && (
            <PlanningGeneratingStep
              instanceId={session.agent_instance_id}
              sessionId={session.id}
              onComplete={handleGenerationComplete}
              onError={handleGenerationError}
            />
          )}

          {step === "review" && session && generatedPlan && (
            <PlanningReviewStep
              session={session}
              plan={generatedPlan}
              onBack={handleBackToInput}
              onRegenerate={handleRegenerate}
              onConfirmed={handlePlanConfirmed}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
