// Task statuses
export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "review"
  | "done"
  | "blocked";

export type TaskPriority = "critical" | "high" | "medium" | "low";

export type AutonomyLevel = "full_auto" | "needs_approval" | "human_only";

export type AgentInstanceStatus =
  | "initializing"
  | "running"
  | "paused"
  | "waiting_input"
  | "completed"
  | "failed"
  | "cancelled";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "changes_requested";

// API Response types
export interface Project {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  status: string;
  is_incognito: boolean;
  created_at: string;
  updated_at: string;
  task_count?: number;
}

export interface Task {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  acceptance_criteria: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  task_type: string | null;
  assignee_human_id: string | null;
  assignee_agent_type_id: string | null;
  autonomy_level: AutonomyLevel;
  estimated_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  sort_order: number;
  tags: string | null;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  agent_instance?: AgentInstance | null;
}

export interface AgentType {
  id: string;
  name: string;
  avatar: string | null;
  description: string | null;
  capabilities: string | null;
  model: string;
  max_concurrent_instances: number;
  trust_level: string;
  is_custom: boolean;
}

export interface AgentInstance {
  id: string;
  agent_type_id: string;
  task_id: string;
  status: AgentInstanceStatus;
  current_step: string | null;
  total_steps: number | null;
  progress_percent: number;
  thought_log: string | null;
  started_at: string | null;
  completed_at: string | null;
  total_cost_cents: number;
}

export interface TaskOutput {
  id: string;
  task_id: string;
  created_by_type: string;
  created_by_id: string | null;
  content_type: string;
  content: string | null;
  file_path: string | null;
  version: number;
  created_at: string;
}

export interface Approval {
  id: string;
  task_id: string;
  agent_instance_id: string | null;
  requested_at: string;
  type: string;
  status: ApprovalStatus;
  description: string | null;
  reviewer_comment: string | null;
  resolved_at: string | null;
}

export interface TaskHistory {
  id: string;
  task_id: string;
  changed_by_type: string;
  changed_by_id: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

// Column configuration for Kanban board
export const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "backlog", title: "Backlog" },
  { id: "todo", title: "Zu erledigen" },
  { id: "in_progress", title: "In Bearbeitung" },
  { id: "review", title: "Review" },
  { id: "done", title: "Erledigt" },
  { id: "blocked", title: "Blockiert" },
];

export const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: string }
> = {
  critical: { label: "Kritisch", color: "text-red-500" },
  high: { label: "Hoch", color: "text-orange-500" },
  medium: { label: "Mittel", color: "text-yellow-500" },
  low: { label: "Niedrig", color: "text-slate-400" },
};
