"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import type { Task, TaskStatus } from "@/types";
import { COLUMNS } from "@/types";

interface KanbanBoardProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onStatusChange: (taskId: string, newStatus: string, sortOrder: number) => void;
  onCreateTask: (status: TaskStatus) => void;
  selectedTaskIds?: Set<string>;
  onToggleSelect?: (taskId: string) => void;
}

export function KanbanBoard({
  tasks,
  onTaskClick,
  onStatusChange,
  onCreateTask,
  selectedTaskIds,
  onToggleSelect,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Compute subtask info for each parent task
  const subtaskMap = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    for (const task of tasks) {
      if (task.parent_task_id) {
        if (!map[task.parent_task_id]) {
          map[task.parent_task_id] = { total: 0, done: 0 };
        }
        map[task.parent_task_id].total++;
        if (task.status === "done") {
          map[task.parent_task_id].done++;
        }
      }
    }
    return map;
  }, [tasks]);

  const tasksByColumn = COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = tasks
        .filter((t) => t.status === col.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      return acc;
    },
    {} as Record<TaskStatus, Task[]>
  );

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetColumnId = over.id as string;

    // Check if dropped on a column
    if (COLUMNS.some((c) => c.id === targetColumnId)) {
      const currentTask = tasks.find((t) => t.id === taskId);
      if (currentTask && currentTask.status !== targetColumnId) {
        const targetTasks = tasksByColumn[targetColumnId as TaskStatus] || [];
        onStatusChange(taskId, targetColumnId, targetTasks.length);
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full gap-3 overflow-x-auto p-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            title={column.title}
            tasks={tasksByColumn[column.id] || []}
            subtaskMap={subtaskMap}
            onTaskClick={onTaskClick}
            onCreateTask={() => onCreateTask(column.id)}
            selectedTaskIds={selectedTaskIds}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? (
          <TaskCard task={activeTask} onClick={() => {}} isDragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
