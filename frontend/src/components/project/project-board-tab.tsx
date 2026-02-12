"use client";

import { useState, useCallback, useMemo } from "react";
import { KanbanBoard } from "@/components/board/kanban-board";
import { SidePanel } from "@/components/layout/side-panel";
import { TaskDetail } from "@/components/task/task-detail";
import { TaskForm } from "@/components/task/task-form";
import { AdvancedFilterBar, type FilterState } from "./advanced-filter-bar";
import { BulkActionBar } from "@/components/board/bulk-action-bar";
import { useTasks } from "@/hooks/use-tasks";
import { spawnAgent } from "@/hooks/use-agents";
import { apiFetch, fetcher } from "@/lib/api";
import useSWR from "swr";
import type { Task, TaskStatus, TaskOutput, Approval } from "@/types";

interface ProjectBoardTabProps {
  projectId: string;
}

export function ProjectBoardTab({ projectId }: ProjectBoardTabProps) {
  const { tasks, createTask, updatePosition, deleteTask, mutate: mutateTasks } =
    useTasks(projectId);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskFormStatus, setTaskFormStatus] = useState<TaskStatus>("todo");
  const [filter, setFilter] = useState<FilterState>({
    search: "",
    statuses: [],
    priorities: [],
    tags: [],
  });
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filter.search && !t.title.toLowerCase().includes(filter.search.toLowerCase())) {
        return false;
      }
      if (filter.statuses.length > 0 && !filter.statuses.includes(t.status)) {
        return false;
      }
      if (filter.priorities.length > 0 && !filter.priorities.includes(t.priority)) {
        return false;
      }
      if (filter.tags.length > 0) {
        const taskTags = t.tags ? t.tags.split(",").map((tag) => tag.trim()) : [];
        if (!filter.tags.some((ft) => taskTags.includes(ft))) return false;
      }
      return true;
    });
  }, [tasks, filter]);

  const handleToggleSelect = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const handleBulkStatusChange = useCallback(
    async (status: TaskStatus) => {
      for (const taskId of selectedTaskIds) {
        await apiFetch(`/tasks/${taskId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
      }
      setSelectedTaskIds(new Set());
      mutateTasks();
    },
    [selectedTaskIds, mutateTasks]
  );

  const handleBulkDelete = useCallback(async () => {
    for (const taskId of selectedTaskIds) {
      await deleteTask(taskId);
    }
    setSelectedTaskIds(new Set());
  }, [selectedTaskIds, deleteTask]);

  const { data: taskOutputs, mutate: mutateOutputs } = useSWR<TaskOutput[]>(
    selectedTask ? `/tasks/${selectedTask.id}/outputs` : null,
    fetcher
  );
  const { data: allApprovals } = useSWR<Approval[]>(
    selectedTask ? "/approvals?status=pending" : null,
    fetcher
  );
  const pendingApproval =
    allApprovals?.find(
      (a) => a.task_id === selectedTask?.id && a.status === "pending"
    ) ?? null;

  const handleTaskClick = useCallback((task: Task) => setSelectedTask(task), []);

  const handleStatusChange = useCallback(
    async (taskId: string, newStatus: string, sortOrder: number) => {
      await updatePosition(taskId, newStatus, sortOrder);
    },
    [updatePosition]
  );

  const handleCreateTask = useCallback((status: TaskStatus) => {
    setTaskFormStatus(status);
    setShowTaskForm(true);
  }, []);

  const handleSubmitTask = useCallback(
    async (data: {
      title: string;
      description?: string;
      priority?: string;
      task_type?: string;
      status?: string;
      acceptance_criteria?: string;
    }) => {
      await createTask(data);
    },
    [createTask]
  );

  const handleDeleteTask = useCallback(async () => {
    if (!selectedTask) return;
    await deleteTask(selectedTask.id);
    setSelectedTask(null);
  }, [selectedTask, deleteTask]);

  const handleSpawnAgent = useCallback(
    async (agentTypeId: string) => {
      if (!selectedTask) return;
      await spawnAgent(agentTypeId, selectedTask.id);
      mutateTasks();
    },
    [selectedTask, mutateTasks]
  );

  const handleApprovalResolve = useCallback(
    async (approvalId: string, status: string, comment?: string) => {
      await apiFetch(`/approvals/${approvalId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ status, reviewer_comment: comment }),
      });
      mutateTasks();
    },
    [mutateTasks]
  );

  const handleAgentStatusChange = useCallback(
    (status: string) => {
      // When agent finishes, refresh tasks and outputs
      if (status === "completed" || status === "error" || status === "cancelled") {
        mutateTasks();
        mutateOutputs();
      }
    },
    [mutateTasks, mutateOutputs]
  );

  const handleCreateSubtask = useCallback(
    async (title: string, priority: string) => {
      if (!selectedTask) return;
      await createTask({
        title,
        priority,
        status: "todo",
        parent_task_id: selectedTask.id,
      } as any);
    },
    [selectedTask, createTask]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Filter + Bulk Actions */}
      <div className="space-y-2 px-4 pt-3">
        <AdvancedFilterBar
          projectId={projectId}
          filter={filter}
          onFilterChange={setFilter}
        />
        <BulkActionBar
          selectedCount={selectedTaskIds.size}
          onClear={() => setSelectedTaskIds(new Set())}
          onBulkStatusChange={handleBulkStatusChange}
          onBulkDelete={handleBulkDelete}
        />
      </div>

      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          tasks={filteredTasks}
          onTaskClick={handleTaskClick}
          onStatusChange={handleStatusChange}
          onCreateTask={handleCreateTask}
          selectedTaskIds={selectedTaskIds}
          onToggleSelect={handleToggleSelect}
        />
      </div>

      <SidePanel open={!!selectedTask} onClose={() => setSelectedTask(null)}>
        {selectedTask && (
          <TaskDetail
            task={selectedTask}
            projectId={projectId}
            allTasks={tasks}
            outputs={taskOutputs ?? []}
            pendingApproval={pendingApproval}
            onUpdateTask={async () => mutateTasks()}
            onDeleteTask={handleDeleteTask}
            onSpawnAgent={handleSpawnAgent}
            onApprovalResolve={handleApprovalResolve}
            onAgentStatusChange={handleAgentStatusChange}
            onCreateSubtask={handleCreateSubtask}
            onTaskClick={handleTaskClick}
          />
        )}
      </SidePanel>

      <TaskForm
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSubmit={handleSubmitTask}
        defaultStatus={taskFormStatus}
      />
    </div>
  );
}
