"use client";

import { useState } from "react";
import { Filter, X, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSavedViews, createView, deleteView } from "@/hooks/use-saved-views";
import type { TaskStatus, TaskPriority } from "@/types";
import { COLUMNS, PRIORITY_CONFIG, TAG_CONFIG } from "@/types";

export interface FilterState {
  search: string;
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  tags: string[];
}

const EMPTY_FILTER: FilterState = {
  search: "",
  statuses: [],
  priorities: [],
  tags: [],
};

interface AdvancedFilterBarProps {
  projectId: string;
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
}

export function AdvancedFilterBar({
  projectId,
  filter,
  onFilterChange,
}: AdvancedFilterBarProps) {
  const [expanded, setExpanded] = useState(false);
  const { views, mutate: mutateViews } = useSavedViews(projectId);

  const hasActiveFilter =
    filter.search ||
    filter.statuses.length > 0 ||
    filter.priorities.length > 0 ||
    filter.tags.length > 0;

  function toggleStatus(s: TaskStatus) {
    const next = filter.statuses.includes(s)
      ? filter.statuses.filter((x) => x !== s)
      : [...filter.statuses, s];
    onFilterChange({ ...filter, statuses: next });
  }

  function togglePriority(p: TaskPriority) {
    const next = filter.priorities.includes(p)
      ? filter.priorities.filter((x) => x !== p)
      : [...filter.priorities, p];
    onFilterChange({ ...filter, priorities: next });
  }

  function toggleTag(tag: string) {
    const next = filter.tags.includes(tag)
      ? filter.tags.filter((x) => x !== tag)
      : [...filter.tags, tag];
    onFilterChange({ ...filter, tags: next });
  }

  async function handleSaveView() {
    const name = prompt("Name der Ansicht:");
    if (!name) return;
    await createView(projectId, {
      name,
      filter_json: JSON.stringify(filter),
    });
    mutateViews();
  }

  function handleLoadView(filterJson: string) {
    try {
      const parsed = JSON.parse(filterJson) as FilterState;
      onFilterChange(parsed);
    } catch {
      // ignore invalid JSON
    }
  }

  async function handleDeleteView(viewId: string) {
    await deleteView(viewId);
    mutateViews();
  }

  return (
    <div className="space-y-2">
      {/* Main Bar */}
      <div className="flex items-center gap-2">
        <Button
          variant={expanded ? "secondary" : "ghost"}
          size="sm"
          className="h-8"
          onClick={() => setExpanded(!expanded)}
        >
          <Filter className="mr-1 h-3.5 w-3.5" />
          Filter
          {hasActiveFilter && (
            <span className="ml-1 rounded-full bg-[hsl(var(--accent-orange))] px-1.5 text-[10px] text-white">
              {filter.statuses.length + filter.priorities.length + filter.tags.length}
            </span>
          )}
        </Button>

        {hasActiveFilter && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onFilterChange(EMPTY_FILTER)}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Zurücksetzen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={handleSaveView}
            >
              <Save className="mr-1 h-3 w-3" />
              Speichern
            </Button>
          </>
        )}
      </div>

      {/* Saved Views */}
      {views.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Ansichten:</span>
          {views.map((v) => (
            <div key={v.id} className="group flex items-center">
              <button
                onClick={() => handleLoadView(v.filter_json)}
                className="rounded-full bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {v.name}
              </button>
              <button
                onClick={() => handleDeleteView(v.id)}
                className="ml-0.5 hidden text-muted-foreground/50 hover:text-foreground group-hover:block"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Expanded Filter Panel */}
      {expanded && (
        <div className="rounded-lg border border-border bg-card/50 p-3 space-y-3">
          {/* Status */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {COLUMNS.map((col) => (
                <button
                  key={col.id}
                  onClick={() => toggleStatus(col.id)}
                  className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                    filter.statuses.includes(col.id)
                      ? "bg-[hsl(var(--accent-orange))]/20 text-[hsl(var(--accent-orange))]"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {col.title}
                </button>
              ))}
            </div>
          </div>

          {/* Prioritaet */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Prioritaet</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, { label: string; color: string }][]).map(
                ([key, cfg]) => (
                  <button
                    key={key}
                    onClick={() => togglePriority(key)}
                    className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                      filter.priorities.includes(key)
                        ? "bg-[hsl(var(--accent-orange))]/20 text-[hsl(var(--accent-orange))]"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {cfg.label}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TAG_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => toggleTag(key)}
                  className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                    filter.tags.includes(key)
                      ? `${cfg.bg} ${cfg.color}`
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
