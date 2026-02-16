"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Loader2, Send } from "lucide-react";

interface OrchestratorInputProps {
  onSubmit: (instruction: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function OrchestratorInput({
  onSubmit,
  isLoading,
  disabled,
}: OrchestratorInputProps) {
  const [instruction, setInstruction] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!instruction.trim() || isLoading || disabled) return;
    onSubmit(instruction.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Sparkles className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
        Was soll der KI-Assistent tun?
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Beschreibe deine Aufgabe... z.B. 'Recherchiere die Top 5 Konkurrenten und erstelle eine Vergleichsanalyse' oder 'Erstelle Tasks für die Implementierung des Login-Systems'"
          rows={4}
          disabled={isLoading || disabled}
          className="w-full resize-none rounded-lg border border-border bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-[hsl(var(--accent-orange))] disabled:opacity-50"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          ⌘+Enter zum Absenden
        </p>
        <button
          onClick={handleSubmit}
          disabled={!instruction.trim() || isLoading || disabled}
          className="flex items-center gap-2 rounded-lg bg-[hsl(var(--accent-orange))] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--accent-orange))]/90 disabled:opacity-50"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird gestartet...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Starten
            </>
          )}
        </button>
      </div>
    </div>
  );
}
