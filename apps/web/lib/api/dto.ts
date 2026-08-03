/**
 * Client-safe response shapes for `/api/v1/*` — mirrors the repository
 * return shapes but with Date fields as ISO strings (what actually crosses
 * the wire after `NextResponse.json()` serialization). Deliberately
 * separate from the Prisma-generated types (which have real `Date` objects
 * and can't be imported into Client Components anyway).
 */
import type {
  BoardType,
  ProjectHealth,
  ProjectStatus,
  TaskPriority,
  TaskSource,
  TaskStatus,
  UserRole
} from "@ai-ops/types";

export interface ProjectDto {
  id: string;
  orgId: string;
  name: string;
  status: ProjectStatus;
  health: ProjectHealth;
  startDate: string | null;
  targetDate: string | null;
  createdAt: string;
}

export interface BoardDto {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  type: BoardType;
  createdAt: string;
}

export interface TaskAssigneeDto {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface TaskDto {
  id: string;
  orgId: string;
  boardId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assignee: TaskAssigneeDto | null;
  source: TaskSource;
  sourceRefId: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface OrgUserDto {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuditLogEntryDto {
  id: string;
  orgId: string;
  actorId: string | null;
  actorType: "user" | "ai_agent" | "system";
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** SAD §4 `email_messages`. */
export interface EmailMessageDto {
  id: string;
  orgId: string;
  accountId: string;
  threadId: string;
  sender: string;
  subject: string;
  bodySnippet: string | null;
  urgency: "low" | "medium" | "high" | "critical" | null;
  intent: "task" | "question" | "fyi" | "complaint" | "other" | null;
  status: "unprocessed" | "processed" | "archived";
  receivedAt: string;
  createdAt: string;
}

/** SAD §4/§9/§15 `agent_runs`. */
export interface AgentRunDto {
  id: string;
  orgId: string;
  agentName: "classifier" | "summarizer" | "risk" | "report" | "reply_draft";
  triggerSource: string;
  emailMessageId: string | null;
  output: Record<string, unknown> | null;
  status: "queued" | "running" | "success" | "failed" | "awaiting_approval";
  confidence: number | null;
  rationale: string | null;
  startedAt: string;
  completedAt: string | null;
}

/** SAD §4 `meetings` / `meeting_action_items`. */
export interface MeetingActionItemDto {
  id: string;
  description: string;
  linkedTaskId: string | null;
  ownerId: string | null;
}

export interface MeetingDto {
  id: string;
  orgId: string;
  title: string;
  summary: string | null;
  occurredAt: string;
  createdAt: string;
}

export interface MeetingDetailDto extends MeetingDto {
  transcript: string;
  actionItems: (MeetingActionItemDto & {
    task: { id: string; title: string; status: string } | null;
    owner: { id: string; name: string } | null;
  })[];
}

/** SAD §4 `risk_signals`. */
export interface RiskSignalDto {
  id: string;
  orgId: string;
  entityType: "project" | "task" | "account";
  entityId: string;
  signalType: "sla_breach" | "stale_task" | "velocity_drop" | "sentiment_negative";
  severity: "low" | "medium" | "high";
  detail: Record<string, unknown>;
  resolved: boolean;
  createdAt: string;
}

/** SAD §4 `reports` + API Contract Pattern B. */
export interface ReportContentDto {
  executiveSummary: string;
  highlights: string[];
  risks: string[];
  recommendations: string[];
  trendComparison: string | null;
  markdown: string;
}

export interface ReportDto {
  id: string;
  orgId: string;
  type: "weekly_exec" | "project_status" | "custom";
  status: "generating" | "complete" | "complete_fallback" | "failed";
  content: ReportContentDto | null;
  pdfUrl: string | null;
  generatedBy: "scheduled" | "manual";
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
}

/** SAD §2.6/§4 `memory_entries` — Memory Module (Phase 7). */
export interface MemoryEntryDto {
  id: string;
  orgId: string;
  entityType: string;
  entityId: string | null;
  content: string;
  embeddingStatus: "pending" | "embedded" | "failed";
  embeddingModel: string | null;
  embeddingVersion: number | null;
  importance: number;
  sourceType: string;
  sourceRefId: string | null;
  metadata: Record<string, unknown> | null;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shape returned by `retrieveMemoryContext` (memory-retrieval-service.ts)
 * via `POST /memory/search` — deliberately slimmer than `MemoryEntryDto`
 * (the retrieval layer only surfaces what a prompt/UI needs to display a
 * result, not embedding pipeline internals like `embeddingStatus`).
 */
export interface MemoryContextItemDto {
  id: string;
  entityType: string;
  entityId: string | null;
  content: string;
  importance: number;
  similarity: number;
  sourceType: string;
  sourceRefId: string | null;
}

/** SAD §13.1 AI Chat Workspace — Chat Workspace history/sidebar item. */
export interface ChatSessionDto {
  id: string;
  orgId: string;
  userId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * SAD §13.1/§13.11 — a single transcript turn. `referencedEntities` is the
 * grounded `{type, id, label}[]` the Chat Agent resolved (chat-agent.ts),
 * rendered as clickable entity chips per the Component Spec's ChatPanel
 * "inline entity references... not just prose" requirement.
 * `proposedActionRunId` set means the assistant proposed an action awaiting
 * approval — the UI renders the `[Yes]` button from SAD §13.1 for it.
 */
export interface ChatMessageDto {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  referencedEntities: { type: "task" | "risk_signal" | "user"; id: string; label: string }[] | null;
  proposedActionRunId: string | null;
  createdAt: string;
}

/** SAD §13.9 AI Action Timeline — one merged event from task_activity/audit_log/agent_runs. */
export interface TimelineEventDto {
  id: string;
  source: "task_activity" | "audit_log" | "agent_run";
  actorLabel: string;
  actorType: "user" | "ai_agent" | "system";
  action: string;
  detail: string | null;
  confidence: number | null;
  rationale: string | null;
  occurredAt: string;
}

/** SAD §13.4 ROI/Time-Saved Metrics. */
export interface RoiMetricsDto {
  periodDays: number;
  hourlyCostUsd: number;
  totalMinutesSaved: number;
  totalHoursSaved: number;
  estimatedValueUsd: number;
  tasksAutomated: number;
  emailsProcessed: number;
  meetingsSummarized: number;
  reportsGenerated: number;
  riskScansSaved: number;
  byAgent: { agentName: string; runCount: number; minutesSaved: number }[];
}

/** SAD §13.7 Organization Map. */
export interface OrgMapDto {
  users: { id: string; name: string; role: string; openTaskCount: number }[];
  projects: { id: string; name: string; health: string; score: number }[];
  edges: { userId: string; projectId: string; openTaskCount: number }[];
}
