"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { useProjects, type CreateProjectData } from "@/hooks/use-projects";
import { ProjectCard } from "@/components/project/project-card";
import { FilterBar } from "@/components/project/filter-bar";
import { NewProjectModal } from "@/components/project/new-project-modal";
import { Button } from "@/components/ui/button";

function ProjectsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projects, createProject, deleteProject, mutate } = useProjects();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Open modal when navigated with ?new=true (legacy support)
  useEffect(() => {
    if (searchParams.get("new") === "true") {
      setModalOpen(true);
      router.replace("/projects");
    }
  }, [searchParams, router]);

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }
    return filtered;
  }, [projects, searchQuery, statusFilter]);

  const handleCreateProject = useCallback(
    async (data: CreateProjectData) => {
      const project = await createProject(data);
      if (project) {
        setModalOpen(false);
        router.push(`/projects/${project.id}`);
      }
    },
    [createProject, router]
  );

  const handleStatusChange = useCallback(() => {
    mutate();
  }, [mutate]);

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      await deleteProject(projectId);
    },
    [deleteProject]
  );

  return (
    <div className="flex h-full flex-col">
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onNewProject={() => setModalOpen(true)}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {filteredProjects.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground">
              {projects.length === 0
                ? "Noch keine Projekte. Erstelle dein erstes Projekt!"
                : "Keine Projekte gefunden."}
            </p>
            {projects.length === 0 && (
              <Button
                onClick={() => setModalOpen(true)}
                className="bg-[hsl(var(--accent-orange))] text-white hover:bg-[hsl(var(--accent-orange))]/90"
              >
                <Plus className="mr-1 h-4 w-4" />
                Neues Projekt
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => router.push(`/projects/${project.id}`)}
                onStatusChange={handleStatusChange}
                onDelete={handleDeleteProject}
              />
            ))}
          </div>
        )}
      </div>

      <NewProjectModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}
