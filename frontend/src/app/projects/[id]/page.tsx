"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, LayoutGrid, Kanban, CalendarRange, Wallet, Bot, Database, Trash2 } from "lucide-react";
import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { Project } from "@/types";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProjectOverviewTab } from "@/components/project/project-overview-tab";
import { ProjectBoardTab } from "@/components/project/project-board-tab";
import { ProjectTimelineTab } from "@/components/project/project-timeline-tab";
import { ProjectBudgetTab } from "@/components/project/project-budget-tab";
import { ProjectAgentsTab } from "@/components/project/project-agents-tab";
import { KnowledgeManager } from "@/components/profile/knowledge-manager";
import { IntegrationManager } from "@/components/profile/integration-manager";

const TABS = [
  { key: "overview", label: "Übersicht", icon: LayoutGrid },
  { key: "board", label: "Board", icon: Kanban },
  { key: "agents", label: "Agenten", icon: Bot },
  { key: "timeline", label: "Timeline", icon: CalendarRange },
  { key: "budget", label: "Budget", icon: Wallet },
  { key: "knowledge", label: "Wissen", icon: Database },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { data: project, mutate: mutateProject } = useSWR<Project>(
    projectId ? `/projects/${projectId}` : null,
    fetcher
  );

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDeleteProject = useCallback(async () => {
    try {
      await apiFetch(`/projects/${projectId}`, { method: "DELETE" });
      router.push("/projects");
    } catch {
      // Silently fail — user stays on page
    }
  }, [projectId, router]);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Projekt wird geladen...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Project Header */}
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/projects")}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{project.title}</h1>
            {project.phase && (
              <span className="text-xs text-muted-foreground">
                Phase: {project.phase}
              </span>
            )}
          </div>
          <button
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Löschen
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mt-3 flex gap-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                activeTab === key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "overview" && (
          <div className="h-full overflow-y-auto">
            <ProjectOverviewTab project={project} />
          </div>
        )}
        {activeTab === "board" && (
          <ProjectBoardTab projectId={projectId} />
        )}
        {activeTab === "agents" && (
          <div className="h-full overflow-y-auto">
            <ProjectAgentsTab projectId={projectId} />
          </div>
        )}
        {activeTab === "timeline" && (
          <div className="h-full overflow-y-auto">
            <ProjectTimelineTab projectId={projectId} />
          </div>
        )}
        {activeTab === "budget" && (
          <div className="h-full overflow-y-auto">
            <ProjectBudgetTab
              projectId={projectId}
              budgetCents={project.budget_cents}
              mutateProject={mutateProject}
            />
          </div>
        )}
        {activeTab === "knowledge" && (
          <div className="h-full overflow-y-auto p-4 space-y-4">
            <KnowledgeManager projectId={projectId} />
            <IntegrationManager />
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={confirmDelete}
        title="Projekt löschen?"
        message={`"${project.title}" wird unwiderruflich gelöscht, inklusive aller Tasks, Dokumente und Daten.`}
        confirmLabel="Endgültig löschen"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          handleDeleteProject();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
