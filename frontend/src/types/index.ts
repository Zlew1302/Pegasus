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
  phase: string | null;
  start_date: string | null;
  end_date: string | null;
  budget_cents: number;
  team_id: string | null;
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
  start_date: string | null;
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
  parent_instance_id: string | null;
  total_cost_cents: number;
}

export interface AgentInstanceWithTask extends AgentInstance {
  task_title: string | null;
  agent_type_name: string | null;
}

export interface ExecutionStep {
  id: string;
  agent_instance_id: string;
  step_number: number;
  step_type: string;
  description: string | null;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_cents: number | null;
  duration_ms: number | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface AgentSuggestion {
  agent_type_id: string;
  agent_type_name: string;
  confidence: number;
  reason: string;
}

export interface ToolCallEvent {
  tool_name: string;
  parameters: Record<string, unknown>;
  iteration: number;
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

// --- Dependency Types ---

export interface TaskDependency {
  task_id: string;
  depends_on_task_id: string;
  depends_on_title: string | null;
  depends_on_status: string | null;
}

// --- Comment Types ---

export interface Comment {
  id: string;
  task_id: string;
  author_type: string;
  author_name: string;
  content: string;
  created_at: string;
}

// --- Notification Types ---

export interface Notification {
  id: string;
  user_id: string | null;
  type: string;
  priority: string;
  title: string;
  message: string | null;
  link: string | null;
  bundle_group: string | null;
  is_read: boolean;
  created_at: string;
}

// --- Team Types ---

export interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface TeamMember {
  id: string;
  team_id: string;
  member_type: string;
  member_id: string;
  member_name: string | null;
  role: string;
  joined_at: string;
}

// --- Saved View Types ---

export interface SavedView {
  id: string;
  name: string;
  project_id: string;
  filter_json: string;
  sort_order: number;
  created_at: string;
}

// --- Dashboard Types ---

export interface DashboardStats {
  active_agents: number;
  pending_inputs: number;
  weekly_token_cost_cents: number;
  tasks_completed_this_week: number;
}

export interface ActivityEntry {
  instance_id: string;
  agent_name: string;
  task_title: string;
  status: string;
  started_at: string | null;
  progress_percent: number;
}

export interface CostEntry {
  date: string;
  cost_cents: number;
  project_id: string | null;
  project_title: string | null;
}

export interface ProductivityEntry {
  date: string;
  tasks_completed: number;
}

// --- Todo Types ---

export interface Todo {
  id: string;
  title: string;
  sort_order: number;
  is_completed: boolean;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

// --- Profile Types ---

export interface UserProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  global_system_prompt: string | null;
  preferences_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyEntry {
  id: string;
  provider: string;
  key_name: string;
  key_masked: string;
  is_active: boolean;
  created_at: string;
}

export interface AuditEntry {
  timestamp: string;
  actor_type: string;
  actor_id: string | null;
  action: string;
  target_type: string;
  target_title: string;
  details: string | null;
  tokens: number | null;
  cost_cents: number | null;
}

export interface TokenUsageEntry {
  group_id: string;
  group_name: string;
  total_tokens_in: number;
  total_tokens_out: number;
  total_cost_cents: number;
}

// --- Document / Block Types ---

export type BlockType =
  | "paragraph"
  | "heading_1"
  | "heading_2"
  | "heading_3"
  | "bullet_list"
  | "numbered_list"
  | "todo"
  | "code"
  | "divider"
  | "quote"
  | "agent"
  | "image"
  | "table";

export interface Block {
  id: string;
  document_id: string;
  block_type: BlockType;
  content: string | null;
  sort_order: number;
  indent_level: number;
  meta_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  title: string;
  icon: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  block_count: number;
}

export interface DocumentDetail {
  id: string;
  project_id: string;
  title: string;
  icon: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  blocks: Block[];
}

export const BLOCK_TYPE_CONFIG: Record<
  BlockType,
  { label: string; icon: string }
> = {
  paragraph: { label: "Text", icon: "Type" },
  heading_1: { label: "Überschrift 1", icon: "Heading1" },
  heading_2: { label: "Überschrift 2", icon: "Heading2" },
  heading_3: { label: "Überschrift 3", icon: "Heading3" },
  bullet_list: { label: "Aufzählung", icon: "List" },
  numbered_list: { label: "Nummerierte Liste", icon: "ListOrdered" },
  todo: { label: "Aufgabe", icon: "CheckSquare" },
  code: { label: "Code", icon: "Code" },
  divider: { label: "Trennlinie", icon: "Minus" },
  quote: { label: "Zitat", icon: "Quote" },
  agent: { label: "Agent-Block", icon: "Bot" },
  image: { label: "Bild", icon: "Image" },
  table: { label: "Tabelle", icon: "Table" },
};

// --- Widget Layout ---

export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  static?: boolean;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
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

// Tag configuration for tasks
export const TAG_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  MARKETING: { label: "Marketing", color: "text-pink-400", bg: "bg-pink-500/10" },
  RESEARCH: { label: "Research", color: "text-blue-400", bg: "bg-blue-500/10" },
  DEV: { label: "Development", color: "text-green-400", bg: "bg-green-500/10" },
  DESIGN: { label: "Design", color: "text-purple-400", bg: "bg-purple-500/10" },
  DATA: { label: "Daten", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  CONTENT: { label: "Content", color: "text-amber-400", bg: "bg-amber-500/10" },
};

// ── Knowledge Base ─────────────────────────────────────────

export type KnowledgeDocumentStatus = "processing" | "ready" | "error";

export interface KnowledgeDocument {
  id: string;
  filename: string;
  file_type: string;
  title: string;
  description: string | null;
  status: KnowledgeDocumentStatus;
  error_message: string | null;
  total_chunks: number;
  character_count: number;
  word_count: number;
  file_size_bytes: number;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSearchResult {
  chunk_content: string;
  document_title: string;
  document_id: string;
  score: number;
  chunk_index: number;
}

export interface KnowledgeStats {
  total_documents: number;
  total_chunks: number;
  total_words: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
}

// ── Spotlight ────────────────────────────────────────────────

export interface SpotlightContext {
  current_path: string;
  current_page_type: string;
  current_entity_id?: string;
  current_entity_title?: string;
}

export interface SpotlightAction {
  type: "navigate" | "created" | "updated" | "spawned";
  label: string;
  path?: string;
  entityId?: string;
}

export interface SpotlightToolCall {
  name: string;
  status: "running" | "done";
}

export interface SpotlightMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: SpotlightToolCall[];
  actions?: SpotlightAction[];
  timestamp: Date;
}

// ── Decision Tracks ────────────────────────────────────────────

export interface TrackPointEntry {
  id: string;
  system_type: string;
  action_type: string;
  tool_name: string;
  entities: { type: string; name: string; source?: string }[];
  input_summary: string | null;
  output_summary: string | null;
  signal_score: number | null;
  sequence_index: number;
  duration_ms: number | null;
  created_at: string | null;
}

export interface EntityNodeEntry {
  id: string;
  type: string;
  name: string;
  occurrences: number;
  last_seen?: string | null;
}

export interface EntityRelationshipEntry {
  source: { name: string; type: string };
  target: { name: string; type: string };
  type: string;
  weight: number;
  observations: number;
}

export interface OrgInsights {
  summary: {
    total_entities: number;
    total_relationships: number;
    total_track_points: number;
  };
  top_entities: EntityNodeEntry[];
  top_relationships: EntityRelationshipEntry[];
}

export interface EntityGraphData {
  nodes: { id: string; type: string; name: string; occurrences: number }[];
  edges: { source: string; target: string; type: string; weight: number }[];
}

export interface WorkflowPatternEntry {
  id: string;
  label: string;
  sequence: { system: string; action: string }[];
  frequency: number;
  confidence: number;
  avg_signal: number;
  last_observed: string | null;
}

export interface InstanceTracks {
  instance_id: string;
  track_points: TrackPointEntry[];
  total_points: number;
}

export const ENTITY_TYPE_COLORS: Record<
  string,
  { color: string; bg: string }
> = {
  Person: { color: "text-cyan-400", bg: "bg-cyan-500/10" },
  Organization: { color: "text-blue-400", bg: "bg-blue-500/10" },
  SoftwareApplication: { color: "text-amber-400", bg: "bg-amber-500/10" },
  SoftwareSourceCode: { color: "text-green-400", bg: "bg-green-500/10" },
  DigitalDocument: { color: "text-purple-400", bg: "bg-purple-500/10" },
  CommunicationChannel: { color: "text-pink-400", bg: "bg-pink-500/10" },
  Project: { color: "text-indigo-400", bg: "bg-indigo-500/10" },
};
