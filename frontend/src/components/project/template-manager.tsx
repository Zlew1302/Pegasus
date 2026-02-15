"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  CalendarClock,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, fetcher } from "@/lib/api";
import type { TaskTemplate } from "@/types";

const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Täglich",
  weekly: "Wöchentlich",
  monthly: "Monatlich",
};

interface TemplateManagerProps {
  projectId: string;
}

export function TemplateManager({ projectId }: TemplateManagerProps) {
  const { data, error, mutate } = useSWR<TaskTemplate[]>(
    `/projects/${projectId}/templates`,
    fetcher
  );
  const templates = data ?? [];
  const isLoading = !data && !error;

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [recType, setRecType] = useState<string>("");
  const [recInterval, setRecInterval] = useState("1");

  const handleCreate = async () => {
    if (!title.trim()) return;
    await apiFetch(`/projects/${projectId}/templates`, {
      method: "POST",
      body: JSON.stringify({
        title,
        description: description || undefined,
        priority,
        recurrence_type: recType || undefined,
        recurrence_interval: parseInt(recInterval, 10) || 1,
      }),
    });
    setTitle("");
    setDescription("");
    setPriority("medium");
    setRecType("");
    setRecInterval("1");
    setShowCreate(false);
    mutate();
  };

  const handleDelete = async (templateId: string) => {
    await apiFetch(`/projects/${projectId}/templates/${templateId}`, { method: "DELETE" });
    mutate();
  };

  const handleToggle = async (template: TaskTemplate) => {
    await apiFetch(`/projects/${projectId}/templates/${template.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: !template.is_active }),
    });
    mutate();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          Vorlagen & Wiederkehrende Aufgaben
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowCreate(!showCreate)}
        >
          <Plus className="h-3 w-3" />
          Vorlage erstellen
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-border p-3 space-y-3">
          <input
            placeholder="Titel *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-border bg-secondary px-3 py-1.5 text-sm"
          />
          <textarea
            placeholder="Beschreibung (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded border border-border bg-secondary px-3 py-1.5 text-sm resize-none"
          />
          <div className="flex gap-3">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="rounded border border-border bg-secondary px-2 py-1 text-sm"
            >
              <option value="low">Niedrig</option>
              <option value="medium">Mittel</option>
              <option value="high">Hoch</option>
              <option value="critical">Kritisch</option>
            </select>
            <select
              value={recType}
              onChange={(e) => setRecType(e.target.value)}
              className="rounded border border-border bg-secondary px-2 py-1 text-sm"
            >
              <option value="">Keine Wiederholung</option>
              <option value="daily">Täglich</option>
              <option value="weekly">Wöchentlich</option>
              <option value="monthly">Monatlich</option>
            </select>
            {recType && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Alle</span>
                <input
                  type="number"
                  min="1"
                  value={recInterval}
                  onChange={(e) => setRecInterval(e.target.value)}
                  className="w-12 rounded border border-border bg-secondary px-2 py-1 text-sm text-center"
                />
                <span className="text-xs text-muted-foreground">
                  {recType === "daily" ? "Tage" : recType === "weekly" ? "Wochen" : "Monate"}
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>Erstellen</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Abbrechen</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <p className="text-center py-4 text-xs text-muted-foreground">
          Noch keine Vorlagen vorhanden.
        </p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-lg border border-border p-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${!t.is_active ? "text-muted-foreground line-through" : ""}`}>
                  {t.title}
                </p>
                <div className="flex gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">{t.priority}</span>
                  {t.recurrence_type && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <RefreshCw className="h-2.5 w-2.5" />
                      {RECURRENCE_LABELS[t.recurrence_type] ?? t.recurrence_type}
                      {t.recurrence_interval > 1 && ` (alle ${t.recurrence_interval})`}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleToggle(t)}
                >
                  <span className={`h-2 w-2 rounded-full ${t.is_active ? "bg-green-400" : "bg-muted-foreground"}`} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleDelete(t.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
