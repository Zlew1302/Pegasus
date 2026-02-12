"use client";

import { useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/15 text-green-400",
  planning: "bg-blue-500/15 text-blue-400",
  paused: "bg-yellow-500/15 text-yellow-400",
  completed: "bg-gray-500/15 text-gray-400",
  archived: "bg-gray-500/15 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  planning: "Planung",
  paused: "Pausiert",
  completed: "Abgeschlossen",
  archived: "Archiviert",
};

export function ProjectOverviewWidget() {
  const router = useRouter();
  const { projects } = useProjects();

  // Sort by updated_at desc, max 8
  const sorted = [...projects]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )
    .slice(0, 8);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Noch keine Projekte vorhanden
          </p>
        ) : (
          sorted.map((project) => (
            <div
              key={project.id}
              onClick={() => router.push(`/projects/${project.id}`)}
              className="flex cursor-pointer items-center gap-3 rounded-md bg-secondary/30 px-3 py-2 transition-colors hover:bg-secondary/50"
            >
              <FolderKanban className="h-4 w-4 shrink-0 text-[hsl(var(--accent-orange))]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">
                  {project.title}
                </p>
                {project.phase && (
                  <p className="text-[10px] text-muted-foreground">
                    {project.phase}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {project.task_count !== undefined && project.task_count > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {project.task_count} Tasks
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    STATUS_STYLES[project.status] ?? "bg-gray-500/15 text-gray-400"
                  }`}
                >
                  {STATUS_LABELS[project.status] ?? project.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
