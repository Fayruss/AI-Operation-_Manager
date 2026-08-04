import "server-only";
import { prisma, type AgentRun, type Prisma } from "@ai-ops/database";
import type { AgentName } from "@ai-ops/types";
import { ApiError } from "@/lib/api/errors";
import { percentile } from "@/lib/utils/percentile";

/** JSON-safe serialization (same reasoning as writeAuditLog/task-repository diff — avoids raw Date/unknown values hitting a Prisma Json column). */
function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface StartAgentRunInput {
  orgId: string;
  agentName: AgentName;
  triggerSource: string;
  input: unknown;
  emailMessageId?: string;
  meetingId?: string;
  reportId?: string;
  /** n8n Workflow Spec §3: links per-chunk/reduce-step runs into one multi-step trace. */
  parentRunId?: string;
}

export interface CompleteAgentRunInput {
  output: unknown;
  confidence?: number;
  rationale?: string;
  timeSavedMinutes?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}

/**
 * SAD §4/§9/§15: every agent call is logged here, "essential for debugging
 * non-deterministic LLM behavior and for enforcing retry limits." This
 * repository owns the full lifecycle: queued/running → success | failed |
 * awaiting_approval.
 */
export const AgentRunRepository = {
  async start(input: StartAgentRunInput): Promise<AgentRun> {
    return prisma.agentRun.create({
      data: {
        orgId: input.orgId,
        agentName: input.agentName,
        triggerSource: input.triggerSource,
        emailMessageId: input.emailMessageId,
        meetingId: input.meetingId,
        reportId: input.reportId,
        parentRunId: input.parentRunId,
        input: toJsonInput(input.input),
        status: "running"
      }
    });
  },

  async markSuccess(id: string, result: CompleteAgentRunInput): Promise<AgentRun> {
    return prisma.agentRun.update({
      where: { id },
      data: {
        status: "success",
        output: toJsonInput(result.output),
        confidence: result.confidence,
        rationale: result.rationale,
        timeSavedMinutes: result.timeSavedMinutes,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostUsd: result.estimatedCostUsd,
        completedAt: new Date()
      }
    });
  },

  /**
   * PRD acceptance criteria: "Given a classification confidence below the
   * org's threshold... a suggested task is created as a notification
   * requiring confirmation, not auto-applied." This status is what routes
   * to the `POST /agents/:name/approve` flow (API Contract Pattern D).
   */
  async markAwaitingApproval(id: string, result: CompleteAgentRunInput): Promise<AgentRun> {
    return prisma.agentRun.update({
      where: { id },
      data: {
        status: "awaiting_approval",
        output: toJsonInput(result.output),
        confidence: result.confidence,
        rationale: result.rationale,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCostUsd: result.estimatedCostUsd,
        completedAt: new Date()
      }
    });
  },

  async markFailed(id: string, error: string): Promise<AgentRun> {
    return prisma.agentRun.update({
      where: { id },
      data: { status: "failed", error, completedAt: new Date(), retryCount: { increment: 1 } }
    });
  },

  /**
   * SAD §8.6 Memory Consolidation workflow — "high-signal events since
   * last run... meeting decisions." The Summarizer Agent's `decisions`
   * array (SAD §9.2) is already captured in the top-level run's `output`
   * column (summarizer-agent.ts's `parentRun`) — sourcing consolidation
   * candidates from here avoids adding a redundant `meetings.decisions`
   * column that would just duplicate data `agent_runs` already owns.
   * `parentRunId: null` excludes the per-chunk/reduce child runs
   * (n8n Workflow Spec §3) so a long transcript's map-reduce trace doesn't
   * get sourced multiple times.
   */
  async listSuccessfulTopLevelByAgentSince(orgId: string, agentName: AgentName, since: Date, limit = 200): Promise<AgentRun[]> {
    return prisma.agentRun.findMany({
      where: { orgId, agentName, status: "success", parentRunId: null, completedAt: { gte: since } },
      orderBy: { completedAt: "asc" },
      take: limit
    });
  },

  /**
   * SAD §13.4 Time-Saved/ROI Metrics — "Computed, not estimated by an LLM
   * — trust requires this to be auditable math." Sums the
   * `time_saved_minutes` every agent already writes on success
   * (classifier-agent.ts et al.) and counts successful runs per agent, for
   * one period. `parentRunId: null` matches
   * `listSuccessfulTopLevelByAgentSince`'s precedent — a chunked
   * meeting's per-chunk child runs shouldn't each count as a separate
   * "meeting summarized."
   */
  async getRoiAggregateSince(orgId: string, since: Date): Promise<{ agentName: AgentName; runCount: number; minutesSaved: number }[]> {
    const grouped = await prisma.agentRun.groupBy({
      by: ["agentName"],
      where: { orgId, status: "success", parentRunId: null, completedAt: { gte: since } },
      _count: { _all: true },
      _sum: { timeSavedMinutes: true }
    });
    return grouped.map((g) => ({
      agentName: g.agentName,
      runCount: g._count._all,
      minutesSaved: g._sum.timeSavedMinutes ?? 0
    }));
  },

  /** SAD §15 AI Control Center "Success / failure rate... per agent, not just aggregate" — reused by the Analytics Dashboard's "AI action volume" chart (SAD §13.4/§7.7). */
  async getStatusCountsSince(orgId: string, since: Date): Promise<{ agentName: AgentName; status: string; count: number }[]> {
    const grouped = await prisma.agentRun.groupBy({
      by: ["agentName", "status"],
      where: { orgId, parentRunId: null, startedAt: { gte: since } },
      _count: { _all: true }
    });
    return grouped.map((g) => ({ agentName: g.agentName, status: g.status, count: g._count._all }));
  },

  /**
   * Implementation Guide Phase 10 Approval Center — every run parked at
   * `awaiting_approval` for this org, newest first. `parentRunId: null`
   * matches the precedent set by the aggregate queries above: a chunked
   * run's children are trace rows, not separately approvable decisions.
   */
  async listAwaitingApproval(orgId: string, limit = 100): Promise<AgentRun[]> {
    return prisma.agentRun.findMany({
      where: { orgId, status: "awaiting_approval", parentRunId: null },
      orderBy: { startedAt: "desc" },
      take: limit
    });
  },

  /**
   * SAD §15 AI Control Center operational snapshot. One query per documented
   * panel that isn't already covered by `getStatusCountsSince` (success/
   * failure rate) or `listAwaitingApproval` (pending approvals):
   * in-flight/queued counts, latency percentiles, token/cost totals, and the
   * retry-count histogram.
   *
   * Latency is computed in JS from `startedAt`/`completedAt` rather than in
   * SQL: Prisma has no portable percentile aggregate, and the row count for
   * one org's recent window is small enough that pulling durations is
   * cheaper than a raw-SQL escape hatch that would bypass the tenant
   * scoping every other query here goes through.
   */
  async getControlCenterSnapshot(orgId: string, since: Date) {
    const [inFlight, queued, completed, tokenTotals, retryRows] = await Promise.all([
      prisma.agentRun.count({ where: { orgId, status: "running" } }),
      prisma.agentRun.count({ where: { orgId, status: "queued" } }),
      prisma.agentRun.findMany({
        where: { orgId, status: "success", startedAt: { gte: since }, completedAt: { not: null } },
        select: { startedAt: true, completedAt: true }
      }),
      prisma.agentRun.aggregate({
        where: { orgId, startedAt: { gte: since } },
        _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true }
      }),
      prisma.agentRun.groupBy({
        by: ["retryCount"],
        where: { orgId, startedAt: { gte: since } },
        _count: { _all: true }
      })
    ]);

    const durationsMs = completed
      .map((run) => (run.completedAt ? run.completedAt.getTime() - run.startedAt.getTime() : null))
      .filter((value): value is number => value !== null && value >= 0)
      .sort((a, b) => a - b);

    return {
      inFlight,
      queued,
      sampleSize: durationsMs.length,
      p50Ms: percentile(durationsMs, 0.5),
      p95Ms: percentile(durationsMs, 0.95),
      inputTokens: tokenTotals._sum.inputTokens ?? 0,
      outputTokens: tokenTotals._sum.outputTokens ?? 0,
      estimatedCostUsd: Number(tokenTotals._sum.estimatedCostUsd ?? 0),
      retryHistogram: retryRows
        .map((row) => ({ retryCount: row.retryCount, runs: row._count._all }))
        .sort((a, b) => a.retryCount - b.retryCount)
    };
  },

  async getByIdInOrg(orgId: string, id: string): Promise<AgentRun> {
    const run = await prisma.agentRun.findFirst({ where: { id, orgId } });
    if (!run) {
      throw new ApiError("NOT_FOUND", "Agent run not found", undefined, "AGENT_RUN_NOT_FOUND");
    }
    return run;
  },

  /** SAD §13.9 Action Timeline — every agent invocation tied to one email/meeting/report, oldest first. Exactly one of the three ref fields is set per call site. */
  async listForSourceRef(orgId: string, ref: { emailMessageId?: string; meetingId?: string; reportId?: string }, limit = 50): Promise<AgentRun[]> {
    return prisma.agentRun.findMany({
      where: {
        orgId,
        emailMessageId: ref.emailMessageId,
        meetingId: ref.meetingId,
        reportId: ref.reportId
      },
      orderBy: { startedAt: "asc" },
      take: limit
    });
  },

  /**
   * API Contract Pattern D `POST /agents/:name/approve`: "a second approval
   * attempt on a resolved run is rejected, not silently re-executed" → 400
   * ALREADY_DECIDED. The classification itself already succeeded (that's
   * why it reached `awaiting_approval`); approving/rejecting is a human
   * decision layered on top, so this transitions status to `success`
   * either way rather than encoding "rejected" as a failure state.
   */
  async resolveApproval(orgId: string, id: string): Promise<AgentRun> {
    const run = await this.getByIdInOrg(orgId, id);
    if (run.status !== "awaiting_approval") {
      throw new ApiError("ALREADY_DECIDED", "This agent run has already been decided.");
    }
    return prisma.agentRun.update({ where: { id }, data: { status: "success", completedAt: new Date() } });
  },

  /**
   * SAD §5 `POST /webhooks/n8n/callback` — a real n8n workflow (once
   * connected, Phase 5+) may either update a run this app already created
   * via `start()` (agentRunId provided) or report a run it originated
   * entirely itself (no agentRunId — n8n called Claude directly and is
   * just persisting the result here for logging/audit, per SAD §3.2's
   * "every agent call pass through the orchestration layer for
   * logging... governance" even when n8n did the actual LLM call).
   */
  async recordExternalResult(input: {
    agentRunId?: string;
    orgId: string;
    agentName: AgentName;
    triggerSource: string;
    status: "success" | "failed" | "awaiting_approval";
    output?: unknown;
    error?: string;
    confidence?: number;
    inputTokens?: number;
    outputTokens?: number;
  }): Promise<AgentRun> {
    const run = input.agentRunId
      ? await this.getByIdInOrg(input.orgId, input.agentRunId)
      : await this.start({
          orgId: input.orgId,
          agentName: input.agentName,
          triggerSource: input.triggerSource,
          input: {}
        });

    if (input.status === "failed") {
      return this.markFailed(run.id, input.error ?? "n8n workflow reported failure with no error detail");
    }
    if (input.status === "awaiting_approval") {
      return this.markAwaitingApproval(run.id, {
        output: input.output,
        confidence: input.confidence,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens
      });
    }
    return this.markSuccess(run.id, {
      output: input.output,
      confidence: input.confidence,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens
    });
  }
};
