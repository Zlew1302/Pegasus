"use client";

import { useState } from "react";
import {
  Bot,
  Calendar,
  Clock,
  Edit2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AgentLiveView } from "@/components/agent/agent-live-view";
import { AgentSpawnDialog } from "@/components/agent/agent-spawn-dialog";
import { AgentSuggestionCards } from "@/components/agent/agent-suggestion";
import { TaskOutput } from "./task-output";
import { TaskComments } from "./task-comments";
import { TaskDependencies } from "./task-dependencies";
import { TaskSubtasks } from "./task-subtasks";
import { TaskActivityStream } from "./task-activity-stream";
import { TaskAttachments } from "./task-attachments";
import { TaskTimer } from "./task-timer";
import { TaskTimeLog } from "./task-time-log";
import { ApprovalBanner } from "@/components/approval/approval-banner";
import type { Task, TaskOutput as TaskOutputType, Approval } from "@/types";
import { PRIORITY_CONFIG, COLUMNS } from "@/types";

interface TaskDetailProps {
  task: Task;
  projectId: string;
  allTasks?: Task[];
  outputs: TaskOutputType[];
  pendingApproval: Approval | null;
  onUpdateTask: (updates: Partial<Task>) => void;
  onDeleteTask: () => void;
  onSpawnAgent: (agentTypeId: string) => void;
  onApprovalResolve: (approvalId: string, status: string, comment?: string) => void;
  onCreateSubtask?: (title: string, priority: string) => void;
  onTaskClick?: (task: Task) => void;
  onAgentStatusChange?: (status: string) => void;
}

export function TaskDetail({
  task,
  projectId,
  allTasks = [],
  outputs,
  pendingApproval,
  onUpdateTask,
  onDeleteTask,
  onSpawnAgent,
  onApprovalResolve,
  onCreateSubtask,
  onTaskClick,
  onAgentStatusChange,
}: TaskDetailProps) {
  const [showSpawnDialog, setShowSpawnDialog] = useState(false);

  const statusLabel = COLUMNS.find((c) => c.id === task.status)?.title ?? task.status;
  const priorityConfig = PRIORITY_CONFIG[task.priority];
  const isAgentActive =
    task.agent_instance &&
    ["initializing", "running", "paused", "waiting_input"].includes(
      task.agent_instance.status
    );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold leading-tight">{task.title}</h2>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDeleteTask}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline">{statusLabel}</Badge>
          <Badge variant="outline" className={priorityConfig.color}>
            {priorityConfig.label}
          </Badge>
          {task.task_type && (
            <Badge variant="secondary">{task.task_type}</Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Description */}
      {task.description && (
        <div>
          <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Beschreibung
          </h3>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">
            {task.description}
          </p>
        </div>
      )}

      {/* Acceptance Criteria */}
      {task.acceptance_criteria && (
        <div>
          <h3 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
            Akzeptanzkriterien
          </h3>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">
            {task.acceptance_criteria}
          </p>
        </div>
      )}

      {/* Meta */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {task.deadline && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(task.deadline).toLocaleDateString("de-DE")}
          </span>
        )}
        {task.estimated_duration_minutes && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            ~{task.estimated_duration_minutes} Min.
          </span>
        )}
      </div>

      {/* Time Tracking */}
      <TaskTimer taskId={task.id} />

      {/* Dependencies */}
      <TaskDependencies taskId={task.id} projectId={projectId} />

      {/* Subtasks */}
      {onCreateSubtask && (
        <TaskSubtasks
          taskId={task.id}
          projectId={projectId}
          allTasks={allTasks}
          onCreateSubtask={onCreateSubtask}
          onTaskClick={onTaskClick}
        />
      )}

      <Separator />

      {/* Approval Banner */}
      {pendingApproval && (
        <ApprovalBanner
          approval={pendingApproval}
          onResolve={onApprovalResolve}
        />
      )}

      {/* Agent Section */}
      {isAgentActive && task.agent_instance ? (
        <AgentLiveView
          instanceId={task.agent_instance.id}
          onStatusChange={onAgentStatusChange}
        />
      ) : (
        <div className="space-y-3">
          {/* Agent Suggestions */}
          {!isAgentActive && task.status !== "done" && (
            <AgentSuggestionCards
              taskId={task.id}
              onSpawn={(agentTypeId) => onSpawnAgent(agentTypeId)}
            />
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setShowSpawnDialog(true)}
            disabled={task.status === "done" || isAgentActive === true}
          >
            <Bot className="h-3.5 w-3.5" />
            Agent zuweisen
          </Button>
        </div>
      )}

      {/* Attachments */}
      <TaskAttachments taskId={task.id} />

      {/* Outputs */}
      {outputs.length > 0 && (
        <div>
          <Separator className="mb-4" />
          <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Ergebnisse
          </h3>
          <div className="space-y-3">
            {outputs.map((output) => (
              <TaskOutput key={output.id} output={output} />
            ))}
          </div>
        </div>
      )}

      {/* Time Log */}
      <TaskTimeLog taskId={task.id} />

      {/* Comments */}
      <Separator />
      <TaskComments taskId={task.id} />

      {/* Activity Stream */}
      <Separator />
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          Aktivität
        </h3>
        <TaskActivityStream taskId={task.id} />
      </div>

      {/* Spawn Dialog */}
      <AgentSpawnDialog
        open={showSpawnDialog}
        onOpenChange={setShowSpawnDialog}
        onSpawn={(agentTypeId) => {
          onSpawnAgent(agentTypeId);
          setShowSpawnDialog(false);
        }}
      />
    </div>
  );
}
