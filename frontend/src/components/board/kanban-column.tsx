"use client";

import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";
import type { Task, TaskStatus } from "@/types";

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  subtaskMap?: Record<string, { total: number; done: number }>;
  onTaskClick: (task: Task) => void;
  onCreateTask: () => void;
  selectedTaskIds?: Set<string>;
  onToggleSelect?: (taskId: string) => void;
}

export function KanbanColumn({
  id,
  title,
  tasks,
  subtaskMap,
  onTaskClick,
  onCreateTask,
  selectedTaskIds,
  onToggleSelect,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex h-full w-72 shrink-0 flex-col rounded-lg bg-muted/30 ${
        isOver ? "ring-2 ring-[var(--agent-glow-color)]/50" : ""
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onCreateTask}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tasks */}
      <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onClick={() => onTaskClick(task)}
            subtaskInfo={subtaskMap?.[task.id]}
            isSelected={selectedTaskIds?.has(task.id) ?? false}
            onToggleSelect={onToggleSelect ? () => onToggleSelect(task.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
