"use client";

import { useState } from "react";
import { GitBranch, X, Plus, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDependencies } from "@/hooks/use-dependencies";
import { useTasks } from "@/hooks/use-tasks";

interface TaskDependenciesProps {
  taskId: string;
  projectId: string;
}

export function TaskDependencies({ taskId, projectId }: TaskDependenciesProps) {
  const { dependencies, addDependency, removeDependency } =
    useDependencies(taskId);
  const { tasks } = useTasks(projectId);
  const [showPicker, setShowPicker] = useState(false);

  // Filter out self and already-added dependencies
  const existingDepIds = new Set(dependencies.map((d) => d.depends_on_task_id));
  const availableTasks = tasks.filter(
    (t) => t.id !== taskId && !existingDepIds.has(t.id)
  );

  const handleAdd = async (dependsOnId: string) => {
    await addDependency(taskId, dependsOnId);
    setShowPicker(false);
  };

  const handleRemove = async (dependsOnId: string) => {
    await removeDependency(taskId, dependsOnId);
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-medium uppercase text-muted-foreground">
          Abhängigkeiten
        </h3>
        {dependencies.length > 0 && (
          <span className="text-xs text-muted-foreground">
            ({dependencies.length})
          </span>
        )}
      </div>

      {/* Dependency List */}
      {dependencies.length === 0 && !showPicker && (
        <p className="mb-2 text-xs text-muted-foreground">
          Keine Abhängigkeiten
        </p>
      )}

      {dependencies.length > 0 && (
        <div className="mb-2 space-y-1.5">
          {dependencies.map((dep) => {
            const isDone = dep.depends_on_status === "done";
            return (
              <div
                key={dep.depends_on_task_id}
                className="flex items-center justify-between rounded-md border border-border/50 bg-secondary/20 px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2">
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
                  )}
                  <span className="text-sm">{dep.depends_on_title}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      isDone ? "text-green-500" : "text-orange-500"
                    }`}
                  >
                    {dep.depends_on_status}
                  </Badge>
                </div>
                <button
                  onClick={() => handleRemove(dep.depends_on_task_id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Dependency */}
      {showPicker ? (
        <div className="rounded-md border border-border bg-secondary/30 p-2">
          <p className="mb-1.5 text-xs text-muted-foreground">
            Task auswählen:
          </p>
          {availableTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Keine verfügbaren Tasks
            </p>
          ) : (
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {availableTasks.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleAdd(t.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent/50"
                >
                  <span className="truncate">{t.title}</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {t.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-1.5 text-xs"
            onClick={() => setShowPicker(false)}
          >
            Abbrechen
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground"
          onClick={() => setShowPicker(true)}
        >
          <Plus className="h-3 w-3" />
          Abhängigkeit hinzufügen
        </Button>
      )}
    </div>
  );
}
