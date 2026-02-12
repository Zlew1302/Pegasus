"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  FolderPlus,
  Info,
  Target,
  Calendar,
  Layers,
  Activity,
  Wallet,
  Users,
} from "lucide-react";
import { STATUS_OPTIONS } from "./project-card";
import type { CreateProjectData } from "@/hooks/use-projects";

const PHASE_OPTIONS = [
  "Phase A",
  "Phase B",
  "Phase C",
  "Phase D",
  "Phase E",
  "MVP",
  "Beta",
  "Launch",
] as const;

interface NewProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateProjectData) => void;
}

export function NewProjectModal({ open, onClose, onCreate }: NewProjectModalProps) {
  const [form, setForm] = useState<CreateProjectData>({
    title: "",
    description: "",
    goal: "",
    status: "active",
    phase: "",
    start_date: "",
    end_date: "",
    budget_cents: 0,
  });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm({
        title: "",
        description: "",
        goal: "",
        status: "active",
        phase: "",
        start_date: "",
        end_date: "",
        budget_cents: 0,
      });
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const update = useCallback(
    (field: keyof CreateProjectData, value: string | number) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.title.trim()) return;
      setLoading(true);

      // Clean up: only send non-empty values
      const data: CreateProjectData = { title: form.title.trim() };
      if (form.description?.trim()) data.description = form.description.trim();
      if (form.goal?.trim()) data.goal = form.goal.trim();
      if (form.status) data.status = form.status;
      if (form.phase) data.phase = form.phase;
      if (form.start_date) data.start_date = form.start_date;
      if (form.end_date) data.end_date = form.end_date;
      if (form.budget_cents && form.budget_cents > 0) data.budget_cents = form.budget_cents;

      try {
        await onCreate(data);
      } finally {
        setLoading(false);
      }
    },
    [form, onCreate]
  );

  if (!open) return null;

  const inputClass =
    "w-full rounded-md border border-border bg-secondary/30 px-3 py-2 text-sm outline-none transition-colors focus:border-[hsl(var(--accent-orange))] placeholder:text-muted-foreground/40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <FolderPlus className="h-5 w-5 text-[hsl(var(--accent-orange))]" />
            <h2 className="text-lg font-semibold">Neues Projekt erstellen</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-6 overflow-y-auto p-6">

            {/* ── Section: Projekt-Informationen ─────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Info className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
                Projekt-Informationen
              </div>

              <div className="space-y-1.5">
                <label htmlFor="p-title" className="text-xs font-medium text-muted-foreground">
                  Projektname *
                </label>
                <input
                  ref={inputRef}
                  id="p-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="z.B. Website Relaunch"
                  className={inputClass}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="p-desc" className="text-xs font-medium text-muted-foreground">
                  Beschreibung
                </label>
                <textarea
                  id="p-desc"
                  value={form.description ?? ""}
                  onChange={(e) => update("description", e.target.value)}
                  placeholder="Worum geht es in diesem Projekt?"
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </section>

            {/* ── Section: Ziel ──────────────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Target className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
                Ziel
              </div>

              <div className="space-y-1.5">
                <label htmlFor="p-goal" className="text-xs font-medium text-muted-foreground">
                  Projektziel
                </label>
                <textarea
                  id="p-goal"
                  value={form.goal ?? ""}
                  onChange={(e) => update("goal", e.target.value)}
                  placeholder="Was soll mit dem Projekt erreicht werden?"
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </section>

            {/* ── Section: Zeitplan ──────────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Calendar className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
                Zeitplan
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="p-start" className="text-xs font-medium text-muted-foreground">
                    Startdatum
                  </label>
                  <input
                    id="p-start"
                    type="date"
                    value={form.start_date ?? ""}
                    onChange={(e) => update("start_date", e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="p-end" className="text-xs font-medium text-muted-foreground">
                    Enddatum
                  </label>
                  <input
                    id="p-end"
                    type="date"
                    value={form.end_date ?? ""}
                    onChange={(e) => update("end_date", e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            {/* ── Section: Phase & Status ────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Layers className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
                Phase & Status
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Phase</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PHASE_OPTIONS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => update("phase", form.phase === p ? "" : p)}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          form.phase === p
                            ? "border-[hsl(var(--accent-orange))] bg-[hsl(var(--accent-orange))]/15 text-[hsl(var(--accent-orange))]"
                            : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_OPTIONS.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => update("status", s.value)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          form.status === s.value
                            ? "border-[hsl(var(--accent-orange))] bg-[hsl(var(--accent-orange))]/15 text-[hsl(var(--accent-orange))]"
                            : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${s.color}`} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* ── Section: Budget ────────────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Wallet className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
                Budget
              </div>

              <div className="space-y-1.5">
                <label htmlFor="p-budget" className="text-xs font-medium text-muted-foreground">
                  Budget in Euro
                </label>
                <div className="relative">
                  <input
                    id="p-budget"
                    type="number"
                    min="0"
                    step="1"
                    value={form.budget_cents ? form.budget_cents / 100 : ""}
                    onChange={(e) =>
                      update("budget_cents", Math.round(parseFloat(e.target.value || "0") * 100))
                    }
                    placeholder="0"
                    className={`${inputClass} pr-8`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    €
                  </span>
                </div>
              </div>
            </section>

            {/* ── Section: Team ──────────────────────────────── */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Users className="h-4 w-4 text-[hsl(var(--accent-orange))]" />
                Team & Verantwortliche
              </div>

              <p className="text-xs text-muted-foreground/60">
                Team-Zuweisungen können nach dem Erstellen in der Projektansicht vorgenommen werden.
              </p>
            </section>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!form.title.trim() || loading}
              className="rounded-md bg-[hsl(var(--accent-orange))] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[hsl(var(--accent-orange))]/90 disabled:opacity-50"
            >
              {loading ? "Erstellt..." : "Projekt erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
