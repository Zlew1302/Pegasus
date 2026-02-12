"use client";

import { Calendar, Target, Info } from "lucide-react";
import { ProjectTeamSection } from "./project-team-section";
import type { Project } from "@/types";

interface ProjectOverviewTabProps {
  project: Project;
}

export function ProjectOverviewTab({ project }: ProjectOverviewTabProps) {
  return (
    <div className="space-y-6 p-4">
      {/* Project Info */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Info className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Projekt-Informationen</h3>
        </div>
        <div className="space-y-3">
          {project.description && (
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Beschreibung
              </span>
              <p className="mt-1 text-sm">{project.description}</p>
            </div>
          )}
          {project.goal && (
            <div>
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Ziel
              </span>
              <p className="mt-1 text-sm">{project.goal}</p>
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Zeitplan</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-muted-foreground">Start</span>
            <p className="text-sm font-medium">
              {project.start_date
                ? new Date(project.start_date).toLocaleDateString("de-DE")
                : "–"}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Ende</span>
            <p className="text-sm font-medium">
              {project.end_date
                ? new Date(project.end_date).toLocaleDateString("de-DE")
                : "–"}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Phase</span>
            <p className="text-sm font-medium">{project.phase ?? "–"}</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Status</span>
            <p className="text-sm font-medium">
              {project.status === "active" ? "Aktiv" : project.status}
            </p>
          </div>
        </div>
      </div>

      {/* Team */}
      <ProjectTeamSection teamId={project.team_id ?? null} />

      {/* Budget */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Budget & Metriken</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-muted-foreground">Budget</span>
            <p className="text-sm font-medium">
              {project.budget_cents > 0
                ? `${(project.budget_cents / 100).toFixed(2)} €`
                : "–"}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Tasks</span>
            <p className="text-sm font-medium">{project.task_count ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
