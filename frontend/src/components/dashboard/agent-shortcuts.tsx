"use client";

import { useState } from "react";
import { Bot, ArrowRight, Loader2, CheckCircle2, X, Zap } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { spawnAgent } from "@/hooks/use-agents";
import type { AgentType, Project, Task } from "@/types";
import { useRouter } from "next/navigation";

interface AgentShortcutsProps {
  embedded?: boolean;
}

function TaskPicker({
  agentType,
  onCancel,
  onSpawned,
}: {
  agentType: AgentType;
  onCancel: () => void;
  onSpawned: () => void;
}) {
  const router = useRouter();
  const { data: projectsData } = useSWR<{ items: Project[] }>(
    "/projects",
    fetcher
  );
  const projects = projectsData?.items ?? [];

  // Fetch tasks for each project
  const projectIds = projects.map((p) => p.id);
  const tasksCacheKey = projectIds.length > 0
    ? `agent-shortcut-tasks-${projectIds.join(",")}`
    : null;
  const { data: allTasksByProject } = useSWR<Task[][]>(
    tasksCacheKey,
    () =>
      Promise.all(
        projectIds.map((pid) =>
          fetcher(`/projects/${pid}/tasks`) as Promise<Task[]>
        )
      )
  );

  const [spawning, setSpawning] = useState<string | null>(null);
  const [spawnedTaskId, setSpawnedTaskId] = useState<string | null>(null);

  // Collect open tasks (not done, not already with an active agent)
  const openTasks: { task: Task; projectTitle: string }[] = [];
  if (allTasksByProject && projects.length > 0) {
    allTasksByProject.forEach((tasks, idx) => {
      const project = projects[idx];
      if (!project || !tasks) return;
      tasks.forEach((t) => {
        if (t.status !== "done" && !t.assignee_agent_type_id) {
          openTasks.push({ task: t, projectTitle: project.title });
        }
      });
    });
  }

  const isLoading = !allTasksByProject && projectIds.length > 0;

  const handleSpawn = async (taskId: string, projectId: string) => {
    setSpawning(taskId);
    try {
      await spawnAgent(agentType.id, taskId);
      setSpawnedTaskId(taskId);
      setTimeout(() => {
        onSpawned();
        // Navigate to the project board
        router.push(`/projects/${projectId}`);
      }, 800);
    } catch {
      setSpawning(null);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onCancel}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <Bot className="h-4 w-4 text-[var(--agent-glow-color)]" />
        <span className="text-xs font-medium">{agentType.name}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Task wählen</span>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : openTasks.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted-foreground">
          Keine offenen Tasks verfügbar. Erstelle zuerst einen Task in einem Projekt.
        </p>
      ) : (
        <div className="max-h-[280px] space-y-1 overflow-y-auto">
          {openTasks.map(({ task, projectTitle }) => (
            <button
              key={task.id}
              onClick={() => handleSpawn(task.id, task.project_id)}
              disabled={spawning !== null}
              className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
                spawnedTaskId === task.id
                  ? "bg-green-500/10 border border-green-500/30"
                  : spawning === task.id
                    ? "bg-[var(--agent-glow-color)]/10 border border-[var(--agent-glow-color)]/30"
                    : "bg-secondary/30 hover:bg-secondary/60 border border-transparent"
              } disabled:opacity-50`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{task.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {projectTitle} · {task.priority}
                </p>
              </div>
              {spawnedTaskId === task.id ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
              ) : spawning === task.id ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--agent-glow-color)]" />
              ) : (
                <Zap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function AgentShortcuts({ embedded = false }: AgentShortcutsProps) {
  const { data: agentTypes } = useSWR<AgentType[]>(
    "/agents/types",
    fetcher
  );
  const [selectedAgent, setSelectedAgent] = useState<AgentType | null>(null);

  const content = selectedAgent ? (
    <TaskPicker
      agentType={selectedAgent}
      onCancel={() => setSelectedAgent(null)}
      onSpawned={() => setSelectedAgent(null)}
    />
  ) : (
    <div className="flex-1 space-y-2 overflow-y-auto">
      {!agentTypes || agentTypes.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          Keine Agent-Typen verfügbar
        </p>
      ) : (
        agentTypes.map((at) => (
          <button
            key={at.id}
            onClick={() => setSelectedAgent(at)}
            className="flex w-full items-center gap-2 rounded-md bg-secondary/30 px-3 py-2 text-left transition-colors hover:bg-secondary/60 hover:border-[var(--agent-glow-color)]/30"
          >
            <Bot className="h-4 w-4 text-[var(--agent-glow-color)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{at.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {at.description}
              </p>
            </div>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          </button>
        ))
      )}
    </div>
  );

  if (embedded) {
    return <div className="flex h-full flex-col">{content}</div>;
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">Agent-Schnellstart</h3>
      {content}
    </div>
  );
}
