"use client";

import { useState, useCallback } from "react";
import {
  X,
  Bot,
  Loader2,
  ChevronDown,
  Shield,
  ShieldCheck,
  ShieldOff,
  Wrench,
  Brain,
  Target,
  CheckCircle2,
} from "lucide-react";
import { createAgentType, useAvailableTools } from "@/hooks/use-agents";
import type { AgentTypeCreateInput, AvailableTool } from "@/types";

interface AgentCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (agentTypeId: string) => void;
}

const TRUST_LEVELS = [
  {
    value: "propose",
    label: "Vorschlagen",
    description: "Agent schlaegt Ergebnisse vor, Mensch genehmigt",
    icon: Shield,
    color: "text-green-400",
  },
  {
    value: "execute",
    label: "Ausfuehren",
    description: "Agent fuehrt aus, Mensch wird informiert",
    icon: ShieldCheck,
    color: "text-yellow-400",
  },
  {
    value: "full_auto",
    label: "Vollautomatisch",
    description: "Agent arbeitet komplett eigenstaendig",
    icon: ShieldOff,
    color: "text-red-400",
  },
];

const MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
];

export function AgentCreateDialog({ open, onClose, onCreated }: AgentCreateDialogProps) {
  const { tools: availableTools } = useAvailableTools();
  const [step, setStep] = useState(0); // 0: basics, 1: tools & config, 2: guardrails
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [temperature, setTemperature] = useState(0.3);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [trustLevel, setTrustLevel] = useState("propose");
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState("");
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const resetForm = useCallback(() => {
    setStep(0);
    setName("");
    setDescription("");
    setSystemPrompt("");
    setModel("claude-sonnet-4-20250514");
    setTemperature(0.3);
    setMaxTokens(4096);
    setTrustLevel("propose");
    setSelectedTools([]);
    setCapabilities("");
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const toggleTool = useCallback((toolName: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolName)
        ? prev.filter((t) => t !== toolName)
        : [...prev, toolName]
    );
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      setError("Name ist erforderlich");
      setStep(0);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const input: AgentTypeCreateInput = {
        name: name.trim(),
        description: description.trim() || undefined,
        system_prompt: systemPrompt.trim() || undefined,
        model,
        temperature,
        max_tokens: maxTokens,
        trust_level: trustLevel,
        tools: selectedTools.length > 0 ? JSON.stringify(selectedTools) : undefined,
        capabilities: capabilities.trim()
          ? JSON.stringify(capabilities.split(",").map((c) => c.trim()).filter(Boolean))
          : undefined,
      };

      const created = await createAgentType(input);
      onCreated?.(created.id);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen");
    } finally {
      setSaving(false);
    }
  }, [name, description, systemPrompt, model, temperature, maxTokens, trustLevel, selectedTools, capabilities, onCreated, handleClose]);

  if (!open) return null;

  const STEPS = [
    { label: "Grundlagen", icon: Bot },
    { label: "Tools & Modell", icon: Wrench },
    { label: "Autonomie", icon: Shield },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={handleClose} />

      {/* Dialog */}
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl"
        style={{ animation: "popup-in 150ms ease-out" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-[var(--agent-glow-color)]" />
            <h2 className="text-base font-semibold">Neuen Agenten erstellen</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 border-b border-border px-5 py-2">
          {STEPS.map((s, i) => {
            const StepIcon = s.icon;
            return (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  step === i
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <StepIcon className="h-3 w-3" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Step 0: Basics */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z.B. Content Writer, Code Reviewer..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--agent-glow-color)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Beschreibung
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Was macht dieser Agent? Was ist sein Zweck?"
                  rows={2}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--agent-glow-color)]"
                />
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Brain className="h-3 w-3" />
                  System-Prompt (Anweisungen)
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Definiere die Rolle, Verhaltensregeln und Arbeitsweise des Agenten..."
                  rows={5}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs leading-relaxed outline-none transition-colors focus:border-[var(--agent-glow-color)]"
                />
                <p className="mt-1 text-[10px] text-muted-foreground/60">
                  Hier legst du fest, wie der Agent denkt und arbeitet — seine Kernidentitaet.
                </p>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Target className="h-3 w-3" />
                  Faehigkeiten (kommagetrennt)
                </label>
                <input
                  type="text"
                  value={capabilities}
                  onChange={(e) => setCapabilities(e.target.value)}
                  placeholder="z.B. Recherche, Schreiben, Analyse, Code-Review"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--agent-glow-color)]"
                />
              </div>
            </div>
          )}

          {/* Step 1: Tools & Model */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Model Selector */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  KI-Modell
                </label>
                <div className="relative">
                  <button
                    onClick={() => setShowModelDropdown(!showModelDropdown)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm transition-colors hover:border-muted-foreground"
                  >
                    <span>{MODELS.find((m) => m.value === model)?.label ?? model}</span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  {showModelDropdown && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-border bg-card shadow-xl">
                      {MODELS.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => {
                            setModel(m.value);
                            setShowModelDropdown(false);
                          }}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                            model === m.value ? "text-[var(--agent-glow-color)]" : ""
                          }`}
                        >
                          {model === m.value && <CheckCircle2 className="h-3 w-3" />}
                          <span className={model === m.value ? "" : "ml-5"}>{m.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Temperature */}
              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Temperatur (Kreativitaet)</span>
                  <span className="font-mono text-foreground">{temperature.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-[var(--agent-glow-color)]"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                  <span>Praezise</span>
                  <span>Kreativ</span>
                </div>
              </div>

              {/* Max Tokens */}
              <div>
                <label className="mb-1 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Max. Tokens pro Anfrage</span>
                  <span className="font-mono text-foreground">{maxTokens.toLocaleString("de-DE")}</span>
                </label>
                <input
                  type="range"
                  min="1024"
                  max="16384"
                  step="1024"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full accent-[var(--agent-glow-color)]"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                  <span>1.024</span>
                  <span>16.384</span>
                </div>
              </div>

              {/* Tools */}
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Wrench className="h-3 w-3" />
                  Verfuegbare Tools
                </label>
                {availableTools.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">Lade Tools...</p>
                ) : (
                  <div className="grid gap-2">
                    {availableTools.map((tool) => {
                      const isSelected = selectedTools.includes(tool.name);
                      return (
                        <button
                          key={tool.name}
                          onClick={() => toggleTool(tool.name)}
                          className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                            isSelected
                              ? "border-[var(--agent-glow-color)] bg-[hsl(var(--agent-glow)/0.05)]"
                              : "border-border hover:border-muted-foreground"
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                              isSelected
                                ? "border-[var(--agent-glow-color)] bg-[var(--agent-glow-color)]"
                                : "border-muted-foreground/40"
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                          </div>
                          <div>
                            <p className="text-xs font-medium">{tool.name}</p>
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {tool.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Guardrails / Trust */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Shield className="h-3 w-3" />
                  Autonomie-Level (Human-in-the-Loop)
                </label>
                <div className="space-y-2">
                  {TRUST_LEVELS.map((level) => {
                    const LevelIcon = level.icon;
                    const isActive = trustLevel === level.value;
                    return (
                      <button
                        key={level.value}
                        onClick={() => setTrustLevel(level.value)}
                        className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                          isActive
                            ? "border-[var(--agent-glow-color)] bg-[hsl(var(--agent-glow)/0.05)]"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <LevelIcon className={`mt-0.5 h-4 w-4 shrink-0 ${level.color}`} />
                        <div>
                          <p className={`text-xs font-medium ${isActive ? "text-foreground" : ""}`}>
                            {level.label}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {level.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <h4 className="mb-2 text-xs font-medium">Zusammenfassung</h4>
                <div className="space-y-1.5 text-[11px] text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Name</span>
                    <span className="text-foreground">{name || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Modell</span>
                    <span className="text-foreground">
                      {MODELS.find((m) => m.value === model)?.label ?? model}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Temperatur</span>
                    <span className="text-foreground">{temperature.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tools</span>
                    <span className="text-foreground">
                      {selectedTools.length > 0 ? `${selectedTools.length} ausgewaehlt` : "Keine"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Autonomie</span>
                    <span className="text-foreground">
                      {TRUST_LEVELS.find((l) => l.value === trustLevel)?.label}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="text-[10px] text-muted-foreground">
            Schritt {step + 1} von {STEPS.length}
          </div>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Zurueck
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Weiter
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--agent-glow-color)] px-4 py-1.5 text-xs font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Bot className="h-3 w-3" />
                )}
                Agent erstellen
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
