"use client";

import { Bot, FolderKanban, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/types";

interface SidebarProps {
  projects: Project[];
  selectedProjectId: string | null;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
}

export function Sidebar({
  projects,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
}: SidebarProps) {
  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Bot className="h-6 w-6 text-[var(--agent-glow-color)]" />
        <h1 className="text-lg font-bold">Pegasus</h1>
      </div>

      {/* Projects */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase text-muted-foreground">
            Projekte
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCreateProject}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <div className="space-y-1">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                selectedProjectId === project.id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <FolderKanban className="h-4 w-4 shrink-0" />
              <span className="truncate">{project.title}</span>
              {project.task_count !== undefined && project.task_count > 0 && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {project.task_count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">
          Pegasus v0.1
        </span>
      </div>
    </div>
  );
}
