"use client";

import { useState } from "react";
import { FileText, MessageSquarePlus, Loader2 } from "lucide-react";

interface PlanningChoiceStepProps {
  onSelect: (mode: "project_overview" | "custom_input") => void;
}

export function PlanningChoiceStep({ onSelect }: PlanningChoiceStepProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelect = (mode: "project_overview" | "custom_input") => {
    setLoading(mode);
    onSelect(mode);
  };

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <p className="text-center text-muted-foreground max-w-lg">
        Soll der KI-Agent einen Plan auf Basis der Projektbeschreibung erstellen,
        oder möchtest du zusätzlichen Kontext bereitstellen?
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {/* Option 1: Direct from project */}
        <button
          onClick={() => handleSelect("project_overview")}
          disabled={loading !== null}
          className="group relative flex flex-col items-center gap-4 rounded-lg border border-border/50 bg-card p-6 text-left transition-all hover:border-[hsl(var(--accent-orange))]/50 hover:bg-accent/5 disabled:opacity-50 disabled:cursor-wait"
        >
          {loading === "project_overview" ? (
            <Loader2 className="h-10 w-10 text-[hsl(var(--accent-orange))] animate-spin" />
          ) : (
            <FileText className="h-10 w-10 text-[hsl(var(--accent-orange))] transition-transform group-hover:scale-110" />
          )}
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Projektbasis nutzen</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Plan direkt aus Projektbeschreibung, Ziel und bestehenden Tasks generieren
            </p>
          </div>
        </button>

        {/* Option 2: Provide more context */}
        <button
          onClick={() => handleSelect("custom_input")}
          disabled={loading !== null}
          className="group relative flex flex-col items-center gap-4 rounded-lg border border-border/50 bg-card p-6 text-left transition-all hover:border-[hsl(var(--accent-orange))]/50 hover:bg-accent/5 disabled:opacity-50 disabled:cursor-wait"
        >
          {loading === "custom_input" ? (
            <Loader2 className="h-10 w-10 text-[hsl(var(--accent-orange))] animate-spin" />
          ) : (
            <MessageSquarePlus className="h-10 w-10 text-[hsl(var(--accent-orange))] transition-transform group-hover:scale-110" />
          )}
          <div className="text-center">
            <h3 className="font-semibold text-foreground">Mehr Kontext bereitstellen</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Eigene Anmerkungen, Quellen und Web-Recherche hinzufügen
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
