import "server-only";
import { OrganizationRepository } from "@/lib/repositories/organization-repository";
import { TaskRepository } from "@/lib/repositories/task-repository";
import { UserRepository } from "@/lib/repositories/user-repository";
import { NotificationRepository } from "@/lib/repositories/notification-repository";
import { RiskSignalRepository, type CreateRiskSignalInput } from "@/lib/repositories/risk-signal-repository";
import { runRiskAgent, type RiskCandidateInput } from "@/lib/ai/agents/risk-agent";
import { calculateStaleTaskSeverity, calculateSlaBreachSeverity, calculateVelocityDropSeverity } from "@/lib/risk/severity";

/**
 * SAD §2.4/§8.4 Risk Detection Workflow — direct-invocation stand-in for
 * the n8n scheduled workflow (n8n Workflow Spec §4), called by the cron
 * route (Phase 5's "Background Jobs"). Steps, matching the spec exactly:
 * query stale tasks / SLA-breach candidates / velocity trend → score
 * severity (deterministic, lib/risk/severity.ts) → batch through the Risk
 * Agent for rationale → write risk_signals → notify on high severity.
 *
 * "Idempotent by design... on any node failure, the entire run is skipped
 * and simply re-evaluated at the next cycle; no retry needed within-run" —
 * this function does not wrap itself in retry logic for that reason; the
 * Claude call inside runRiskAgent still gets claude-client's own
 * transient-failure retry (2s/8s/32s), which is a different, lower-level
 * concern than whole-run retry.
 */

const VELOCITY_DROP_MIN_PRIOR = 3; // ignore near-zero-baseline noise (a project with 1 prior task isn't a meaningful trend)

export interface RiskScanResult {
  orgId: string;
  candidatesFound: number;
  signalsCreated: number;
  agentRunId: string | null;
  skipped: boolean;
}

async function notifyForSignal(orgId: string, assigneeId: string | null, message: string): Promise<void> {
  let recipientIds = assigneeId ? [assigneeId] : [];

  if (recipientIds.length === 0) {
    // No task assignee (or a project-level signal) — fall back to notifying admins/owners.
    const admins = await UserRepository.listAdmins(orgId);
    recipientIds = admins.map((a) => a.id);
  }

  await NotificationRepository.createMany(
    orgId,
    recipientIds.map((userId) => ({
      userId,
      type: "risk.high_severity",
      payload: { title: "High-severity risk detected", description: message, href: "/app/operations" }
    }))
  );
}

export async function runRiskScanForOrg(orgId: string): Promise<RiskScanResult> {
  const org = await OrganizationRepository.getById(orgId);

  const [staleTasks, slaBreaches, velocityStats] = await Promise.all([
    TaskRepository.findStaleCandidates(orgId, org.staleTaskThresholdDays),
    TaskRepository.findSlaBreachCandidates(orgId),
    TaskRepository.getVelocityByProject(orgId)
  ]);

  interface PendingSignal {
    input: CreateRiskSignalInput;
    entityLabel: string;
    assigneeId: string | null;
  }
  const pending: PendingSignal[] = [];

  for (const task of staleTasks) {
    const daysStale = Math.floor((Date.now() - task.updatedAt.getTime()) / (24 * 60 * 60 * 1000));
    const criticality = task.board.project.health;
    const severity = calculateStaleTaskSeverity(daysStale, criticality);
    const existing = await RiskSignalRepository.findActiveForEntity(orgId, "task", task.id, "stale_task");
    if (existing) continue;
    pending.push({
      entityLabel: `Task "${task.title}" (project: ${task.board.project.name})`,
      assigneeId: task.assigneeId,
      input: {
        entityType: "task",
        entityId: task.id,
        signalType: "stale_task",
        severity,
        detail: { daysStale, projectId: task.board.project.id, projectHealth: criticality }
      }
    });
  }

  for (const task of slaBreaches) {
    if (!task.dueDate) continue;
    const hoursOverdue = Math.floor((Date.now() - task.dueDate.getTime()) / (60 * 60 * 1000));
    const severity = calculateSlaBreachSeverity(hoursOverdue);
    const existing = await RiskSignalRepository.findActiveForEntity(orgId, "task", task.id, "sla_breach");
    if (existing) continue;
    pending.push({
      entityLabel: `Task "${task.title}" (project: ${task.board.project.name})`,
      assigneeId: task.assigneeId,
      input: {
        entityType: "task",
        entityId: task.id,
        signalType: "sla_breach",
        severity,
        detail: { hoursOverdue, projectId: task.board.project.id }
      }
    });
  }

  for (const stat of velocityStats) {
    if (stat.previous < VELOCITY_DROP_MIN_PRIOR) continue;
    const dropPercent = Math.round(((stat.previous - stat.current) / stat.previous) * 100);
    if (dropPercent <= 0) continue;
    const severity = calculateVelocityDropSeverity(dropPercent);
    const existing = await RiskSignalRepository.findActiveForEntity(orgId, "project", stat.projectId, "velocity_drop");
    if (existing) continue;
    pending.push({
      entityLabel: `Project "${stat.projectName}"`,
      assigneeId: null,
      input: {
        entityType: "project",
        entityId: stat.projectId,
        signalType: "velocity_drop",
        severity,
        detail: { dropPercent, tasksCompletedThisWeek: stat.current, tasksCompletedPriorWeek: stat.previous }
      }
    });
  }

  if (pending.length === 0) {
    return { orgId, candidatesFound: 0, signalsCreated: 0, agentRunId: null, skipped: true };
  }

  const agentCandidates: RiskCandidateInput[] = pending.map((p) => ({
    signalType: p.input.signalType,
    entityLabel: p.entityLabel,
    severity: p.input.severity,
    detail: p.input.detail
  }));

  // Risk Agent failure fails the whole cycle (n8n Workflow Spec §4: "if the
  // Claude API call fails entirely for a cycle, agent_runs.status='failed'
  // logged... single-cycle misses are expected/tolerated") — signals are
  // still created with a fallback rationale rather than lost entirely,
  // since the deterministic severity computation already succeeded.
  let agentResult: Awaited<ReturnType<typeof runRiskAgent>> = null;
  try {
    agentResult = await runRiskAgent(orgId, agentCandidates);
  } catch {
    agentResult = null;
  }

  let signalsCreated = 0;
  for (const [index, item] of pending.entries()) {
    const agentDetail = agentResult?.output.results.find((r) => r.index === index);
    const signal = await RiskSignalRepository.create(orgId, {
      ...item.input,
      detail: {
        ...item.input.detail,
        rationale: agentDetail?.rationale ?? null,
        recommendedAction: agentDetail?.recommended_action ?? null,
        agentRunId: agentResult?.agentRunId ?? null
      }
    });
    signalsCreated += 1;

    if (signal.severity === "high") {
      await notifyForSignal(orgId, item.assigneeId, agentDetail?.rationale ?? item.entityLabel);
    }
  }

  return { orgId, candidatesFound: pending.length, signalsCreated, agentRunId: agentResult?.agentRunId ?? null, skipped: false };
}
