"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Bot,
  Bug,
  FileText,
  Lightbulb,
  ListTree,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/types";
import { PRIORITY_CONFIG } from "@/types";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  isDragging?: boolean;
  subtaskInfo?: { total: number; done: number };
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

const TASK_TYPE_ICONS: Record<string, React.ElementType> = {
  feature: Lightbulb,
  bug: Bug,
  docs: FileText,
  maintenance: Wrench,
};

export function TaskCard({ task, onClick, isDragging, subtaskInfo, isSelected, onToggleSelect }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const isAgentAssigned = !!task.assignee_agent_type_id;
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const TypeIcon = task.task_type
    ? TASK_TYPE_ICONS[task.task_type]
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group cursor-pointer rounded-lg border bg-card p-3 transition-all hover:border-foreground/20 ${
        isDragging ? "opacity-50 shadow-lg" : ""
      } ${
        isSelected
          ? "border-[hsl(var(--accent-orange))]/50 ring-1 ring-[hsl(var(--accent-orange))]/30"
          : isAgentAssigned
            ? "border-[var(--agent-glow-color)]/30 shadow-[0_0_8px_var(--agent-glow-color-dim)]"
            : "border-border"
      }`}
    >
      {/* Title + Checkbox */}
      <div className="flex items-start gap-2">
        {onToggleSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
              isSelected
                ? "border-[hsl(var(--accent-orange))] bg-[hsl(var(--accent-orange))]"
                : "border-muted-foreground/30 opacity-0 group-hover:opacity-100"
            }`}
          >
            {isSelected && (
              <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}
        <p className="text-sm font-medium leading-snug">{task.title}</p>
      </div>

      {/* Meta row */}
      <div className="mt-2 flex items-center gap-2">
        {TypeIcon && (
          <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 ${priorityConfig.color}`}
        >
          {priorityConfig.label}
        </Badge>
        {subtaskInfo && subtaskInfo.total > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <ListTree className="h-3 w-3" />
            {subtaskInfo.done}/{subtaskInfo.total}
          </span>
        )}
        {isAgentAssigned && (
          <Bot className="ml-auto h-3.5 w-3.5 text-[var(--agent-glow-color)]" />
        )}
      </div>

      {/* Agent progress bar */}
      {task.agent_instance &&
        ["running", "initializing"].includes(task.agent_instance.status) && (
          <div className="mt-2">
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-[var(--agent-glow-color)] transition-all duration-500"
                style={{ width: `${task.agent_instance.progress_percent}%` }}
              />
            </div>
            {task.agent_instance.current_step && (
              <p className="mt-1 truncate text-[10px] text-muted-foreground">
                {task.agent_instance.current_step}
              </p>
            )}
          </div>
        )}
    </div>
  );
}
