"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ListTree,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/types";
import { COLUMNS, PRIORITY_CONFIG } from "@/types";

interface TaskSubtasksProps {
  taskId: string;
  projectId: string;
  allTasks: Task[];
  onCreateSubtask: (title: string, priority: string) => void;
  onTaskClick?: (task: Task) => void;
}

export function TaskSubtasks({
  taskId,
  projectId,
  allTasks,
  onCreateSubtask,
  onTaskClick,
}: TaskSubtasksProps) {
  const [expanded, setExpanded] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState("medium");

  const subtasks = allTasks.filter((t) => t.parent_task_id === taskId);
  const doneCount = subtasks.filter((t) => t.status === "done").length;

  const handleSubmit = () => {
    if (!newTitle.trim()) return;
    onCreateSubtask(newTitle.trim(), newPriority);
    setNewTitle("");
    setNewPriority("medium");
    setShowForm(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
    if (e.key === "Escape") setShowForm(false);
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
        <ListTree className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-medium uppercase text-muted-foreground">
          Unteraufgaben
        </h3>
        {subtasks.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {doneCount}/{subtasks.length}
          </span>
        )}
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{
              width: `${(doneCount / subtasks.length) * 100}%`,
            }}
          />
        </div>
      )}

      {expanded && (
        <>
          {subtasks.length === 0 && !showForm && (
            <p className="mb-2 text-xs text-muted-foreground">
              Keine Unteraufgaben
            </p>
          )}

          {subtasks.length > 0 && (
            <div className="mb-2 space-y-1">
              {subtasks.map((sub) => {
                const statusLabel =
                  COLUMNS.find((c) => c.id === sub.status)?.title ?? sub.status;
                const priorityConfig = PRIORITY_CONFIG[sub.priority];
                return (
                  <button
                    key={sub.id}
                    onClick={() => onTaskClick?.(sub)}
                    className="flex w-full items-center gap-2 rounded-md border border-border/30 bg-secondary/10 px-2.5 py-1.5 text-left transition-colors hover:bg-secondary/30"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        sub.status === "done"
                          ? "bg-green-500"
                          : sub.status === "in_progress"
                          ? "bg-orange-500"
                          : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="flex-1 truncate text-sm">{sub.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {statusLabel}
                    </Badge>
                    <span className={`text-[10px] ${priorityConfig.color}`}>
                      {priorityConfig.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {showForm ? (
            <div className="space-y-2 rounded-md border border-border bg-secondary/20 p-2">
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Titel der Unteraufgabe"
                className="w-full rounded border border-border bg-secondary/30 px-2 py-1 text-sm outline-none focus:border-[hsl(var(--accent-orange))]"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="rounded border border-border bg-secondary/30 px-2 py-1 text-xs outline-none"
                >
                  <option value="low">Niedrig</option>
                  <option value="medium">Mittel</option>
                  <option value="high">Hoch</option>
                  <option value="critical">Kritisch</option>
                </select>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!newTitle.trim()}
                  className="bg-[hsl(var(--accent-orange))] text-white hover:bg-[hsl(var(--accent-orange))]/90"
                >
                  Erstellen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowForm(false)}
                >
                  Abbrechen
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-3 w-3" />
              Unteraufgabe erstellen
            </Button>
          )}
        </>
      )}
    </div>
  );
}
