"use client";

import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Bot,
  FileText,
  FolderKanban,
  ListTodo,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { SearchResults as AdvancedSearchResults, SearchResult as AdvancedSearchResult } from "@/types";

interface SearchResult {
  type: "task" | "project" | "agent_type" | "document" | "comment";
  id: string;
  title: string;
  subtitle: string | null;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTask: () => void;
  onCreateProject: () => void;
  onSelectTask: (taskId: string) => void;
  onSelectProject: (projectId: string) => void;
  onSpawnAgent: (agentTypeId: string) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onCreateTask,
  onCreateProject,
  onSelectTask,
  onSelectProject,
  onSpawnAgent,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const TYPE_FILTERS = [
    { key: null, label: "Alle" },
    { key: "task", label: "Tasks" },
    { key: "project", label: "Projekte" },
    { key: "document", label: "Dokumente" },
  ];

  // Global keyboard listener — "/" opens command palette (Cmd+K reserved for Spotlight AI)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  // Search using advanced search endpoint
  const search = useCallback(async (q: string, type: string | null) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q, limit: "15" });
      if (type) params.set("type", type);
      const data = await apiFetch<AdvancedSearchResults>(
        `/search?${params.toString()}`
      );
      setResults(
        data.results.map((r: AdvancedSearchResult) => ({
          type: r.type,
          id: r.id,
          title: r.title,
          subtitle: r.snippet || r.project_name || null,
        }))
      );
    } catch {
      // Fallback to old commands endpoint
      try {
        const data = await apiFetch<SearchResult[]>(
          `/commands/search?q=${encodeURIComponent(q)}`
        );
        setResults(data);
      } catch {
        setResults([]);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query, typeFilter), 200);
    return () => clearTimeout(timer);
  }, [query, typeFilter, search]);

  const handleSelect = (result: SearchResult) => {
    onOpenChange(false);
    setQuery("");
    setTypeFilter(null);
    switch (result.type) {
      case "task":
        onSelectTask(result.id);
        break;
      case "project":
      case "document":
        onSelectProject(result.id);
        break;
      case "agent_type":
        onSpawnAgent(result.id);
        break;
      case "comment":
        // Comments point to their parent task
        onSelectTask(result.id);
        break;
    }
  };

  const IconForType: Record<string, typeof Bot> = {
    task: ListTodo,
    project: FolderKanban,
    agent_type: Bot,
    document: FileText,
    comment: MessageSquare,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg [&>button]:hidden">
        <Command
          className="bg-transparent"
          shouldFilter={false}
          onKeyDown={(e) => {
            if (e.key === "Escape") onOpenChange(false);
          }}
        >
          <div className="flex items-center border-b border-border px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder="Suchen oder Aktion ausführen..."
              value={query}
              onValueChange={setQuery}
              className="flex h-11 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Filter Chips */}
          {query.trim() && (
            <div className="flex gap-1.5 border-b border-border px-3 py-1.5">
              {TYPE_FILTERS.map((f) => (
                <button
                  key={f.key ?? "all"}
                  onClick={() => setTypeFilter(f.key)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                    typeFilter === f.key
                      ? "bg-[hsl(var(--accent-orange))] text-white"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="px-4 py-6 text-center text-sm text-muted-foreground">
              Keine Ergebnisse
            </Command.Empty>

            {/* Quick Actions */}
            {!query && (
              <Command.Group heading="Aktionen">
                <Command.Item
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent"
                  onSelect={() => {
                    onOpenChange(false);
                    onCreateTask();
                  }}
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  Neue Aufgabe
                </Command.Item>
                <Command.Item
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent"
                  onSelect={() => {
                    onOpenChange(false);
                    onCreateProject();
                  }}
                >
                  <Plus className="h-4 w-4 text-muted-foreground" />
                  Neues Projekt
                </Command.Item>
              </Command.Group>
            )}

            {/* Search results */}
            {results.length > 0 && (
              <Command.Group heading="Ergebnisse">
                {results.map((result) => {
                  const Icon = IconForType[result.type];
                  return (
                    <Command.Item
                      key={`${result.type}-${result.id}`}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm aria-selected:bg-accent"
                      onSelect={() => handleSelect(result)}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate">{result.title}</p>
                        {result.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">
                            {result.subtitle}
                          </p>
                        )}
                      </div>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
