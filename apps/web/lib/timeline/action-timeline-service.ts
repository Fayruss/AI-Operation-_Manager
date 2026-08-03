import "server-only";
import { TaskRepository } from "@/lib/repositories/task-repository";
import { AuditLogRepository } from "@/lib/repositories/audit-log-repository";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { EmailMessageRepository } from "@/lib/repositories/email-message-repository";
import { MeetingRepository } from "@/lib/repositories/meeting-repository";

/**
 * SAD §13.9 AI Action Timeline — "A literal, chronological trace of an
 * automation from trigger to resolution... Pure read view over agent_runs
 * + audit_log + task_activity filtered by source_ref_id/resource_id...
 * No new write path — this is why Section 4's decision to separate
 * task_activity (product-facing) from audit_log (compliance-facing) pays
 * off: the timeline merges both for a complete human+AI story."
 */
export type TimelineEntityType = "task" | "email" | "meeting" | "report";

export interface TimelineEvent {
  id: string;
  source: "task_activity" | "audit_log" | "agent_run";
  actorLabel: string;
  actorType: "user" | "ai_agent" | "system";
  action: string;
  detail: string | null;
  confidence: number | null;
  rationale: string | null;
  occurredAt: Date;
}

function taskActivityToEvent(row: {
  id: string;
  action: string;
  diff: unknown;
  actorType: string;
  actor: { name: string } | null;
  createdAt: Date;
}): TimelineEvent {
  return {
    id: `task_activity:${row.id}`,
    source: "task_activity",
    actorLabel: row.actor?.name ?? (row.actorType === "ai_agent" ? "AI Agent" : "System"),
    actorType: row.actorType as TimelineEvent["actorType"],
    action: row.action,
    detail: row.diff ? JSON.stringify(row.diff) : null,
    confidence: null,
    rationale: null,
    occurredAt: row.createdAt
  };
}

function auditLogToEvent(row: {
  id: string;
  action: string;
  metadata: unknown;
  actorType: string;
  actor: { name: string } | null;
  createdAt: Date;
}): TimelineEvent {
  return {
    id: `audit_log:${row.id}`,
    source: "audit_log",
    actorLabel: row.actor?.name ?? (row.actorType === "ai_agent" ? "AI Agent" : "System"),
    actorType: row.actorType as TimelineEvent["actorType"],
    action: row.action,
    detail: row.metadata && Object.keys(row.metadata as object).length > 0 ? JSON.stringify(row.metadata) : null,
    confidence: null,
    rationale: null,
    occurredAt: row.createdAt
  };
}

function agentRunToEvent(row: {
  id: string;
  agentName: string;
  status: string;
  confidence: number | null;
  rationale: string | null;
  startedAt: Date;
  completedAt: Date | null;
}): TimelineEvent {
  return {
    id: `agent_run:${row.id}`,
    source: "agent_run",
    actorLabel: `${row.agentName} agent`,
    actorType: "ai_agent",
    action: `agent_run.${row.status}`,
    detail: null,
    confidence: row.confidence,
    rationale: row.rationale,
    occurredAt: row.completedAt ?? row.startedAt
  };
}

/** Fetches and merges every event source for one entity, chronologically ascending — the exact shape the ActionTimeline component (Component Spec) renders. */
export async function getActionTimeline(orgId: string, entityType: TimelineEntityType, entityId: string): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  if (entityType === "task") {
    const task = await TaskRepository.getById(orgId, entityId);
    const [activity, auditRows] = await Promise.all([
      TaskRepository.listActivityForTask(orgId, entityId),
      AuditLogRepository.listForResource(orgId, "task", entityId)
    ]);
    events.push(...activity.map(taskActivityToEvent), ...auditRows.map(auditLogToEvent));

    // A task created from email/meeting traces back to the agent run(s)
    // that produced it (SAD §4: "source/source_ref_id... traces every
    // AI-created task back to its origin").
    if (task.source === "email" && task.sourceRefId) {
      const runs = await AgentRunRepository.listForSourceRef(orgId, { emailMessageId: task.sourceRefId });
      events.push(...runs.map(agentRunToEvent));
    } else if (task.source === "meeting" && task.sourceRefId) {
      const runs = await AgentRunRepository.listForSourceRef(orgId, { meetingId: task.sourceRefId });
      events.push(...runs.map(agentRunToEvent));
    }
  } else if (entityType === "email") {
    await EmailMessageRepository.getById(orgId, entityId);
    const [auditRows, runs] = await Promise.all([
      AuditLogRepository.listForResource(orgId, "email_message", entityId),
      AgentRunRepository.listForSourceRef(orgId, { emailMessageId: entityId })
    ]);
    events.push(...auditRows.map(auditLogToEvent), ...runs.map(agentRunToEvent));
  } else if (entityType === "meeting") {
    await MeetingRepository.getByIdWithActionItems(orgId, entityId);
    const [auditRows, runs] = await Promise.all([
      AuditLogRepository.listForResource(orgId, "meeting", entityId),
      AgentRunRepository.listForSourceRef(orgId, { meetingId: entityId })
    ]);
    events.push(...auditRows.map(auditLogToEvent), ...runs.map(agentRunToEvent));
  } else {
    const [auditRows, runs] = await Promise.all([
      AuditLogRepository.listForResource(orgId, "report", entityId),
      AgentRunRepository.listForSourceRef(orgId, { reportId: entityId })
    ]);
    events.push(...auditRows.map(auditLogToEvent), ...runs.map(agentRunToEvent));
  }

  return events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}
