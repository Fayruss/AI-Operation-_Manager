import "server-only";
import { prisma, type RiskSignal, type RiskEntityType, type RiskSignalType, type RiskSeverity, type Prisma } from "@ai-ops/database";
import { ApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/api/audit";
import { cursorWhere, paginate, type CursorPosition } from "@/lib/api/pagination";

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface RiskSignalFilters {
  resolved?: boolean;
  severity?: RiskSeverity;
}

export interface CreateRiskSignalInput {
  entityType: RiskEntityType;
  entityId: string;
  signalType: RiskSignalType;
  severity: RiskSeverity;
  detail: Record<string, unknown>;
}

export const RiskSignalRepository = {
  async list(orgId: string, filters: RiskSignalFilters, cursor: CursorPosition | null, limit: number) {
    const rows = await prisma.riskSignal.findMany({
      where: { orgId, resolved: filters.resolved, severity: filters.severity, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    return paginate(rows, limit);
  },

  /** SAD §13.1 Chat Workspace grounding — bounded set of currently-active risk signals, most severe/recent first, for the Chat Agent's candidate list (chat-agent.ts). */
  async listActiveForGrounding(orgId: string, limit = 6): Promise<RiskSignal[]> {
    return prisma.riskSignal.findMany({
      where: { orgId, resolved: false },
      orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
      take: limit
    });
  },

  async getByIdInOrg(orgId: string, id: string): Promise<RiskSignal> {
    const signal = await prisma.riskSignal.findFirst({ where: { id, orgId } });
    if (!signal) {
      throw new ApiError("NOT_FOUND", "Risk signal not found", undefined, "RISK_SIGNAL_NOT_FOUND");
    }
    return signal;
  },

  /**
   * Idempotency for the scheduled scan (n8n Workflow Spec §4: "idempotent
   * by design... on any node failure, the entire run is skipped and simply
   * re-evaluated at the next cycle"): don't create a second open signal for
   * an entity/signalType pair that already has one unresolved.
   */
  async findActiveForEntity(orgId: string, entityType: RiskEntityType, entityId: string, signalType: RiskSignalType): Promise<RiskSignal | null> {
    return prisma.riskSignal.findFirst({ where: { orgId, entityType, entityId, signalType, resolved: false } });
  },

  async create(orgId: string, input: CreateRiskSignalInput): Promise<RiskSignal> {
    const signal = await prisma.riskSignal.create({
      data: {
        orgId,
        entityType: input.entityType,
        entityId: input.entityId,
        signalType: input.signalType,
        severity: input.severity,
        detail: toJsonInput(input.detail)
      }
    });

    await writeAuditLog({
      orgId,
      actorId: null,
      actorType: "ai_agent",
      action: "risk_signal.created",
      resourceType: "risk_signal",
      resourceId: signal.id,
      metadata: { entityType: input.entityType, entityId: input.entityId, signalType: input.signalType, severity: input.severity }
    });

    return signal;
  },

  /** SAD §5 `POST /risk-signals/:id/resolve` — admin+ (enforced at the route layer). */
  async resolve(orgId: string, actorId: string, id: string, note?: string): Promise<RiskSignal> {
    await this.getByIdInOrg(orgId, id);

    const resolved = await prisma.riskSignal.update({ where: { id }, data: { resolved: true, resolvedAt: new Date() } });

    await writeAuditLog({
      orgId,
      actorId,
      action: "risk_signal.resolved",
      resourceType: "risk_signal",
      resourceId: id,
      metadata: { note }
    });

    return resolved;
  },

  /** Executive Dashboard KPI: count of unresolved signals, optionally scoped by severity. */
  async countActive(orgId: string, severity?: RiskSeverity): Promise<number> {
    return prisma.riskSignal.count({ where: { orgId, resolved: false, severity } });
  },

  /** SAD §5 `GET /projects/:id/health` "risk signals" component — active signal count for one project. */
  async countActiveForEntity(orgId: string, entityType: RiskEntityType, entityId: string): Promise<number> {
    return prisma.riskSignal.count({ where: { orgId, entityType, entityId, resolved: false } });
  },

  /** Executive Dashboard "SLA Breaches" KPI — accurate count, not derived from a length-limited list. */
  async countActiveBySignalType(orgId: string, signalType: RiskSignalType): Promise<number> {
    return prisma.riskSignal.count({ where: { orgId, signalType, resolved: false } });
  },

  /** SAD §8.6 Memory Consolidation workflow — "high-signal events since last run... resolved risks." Relies on `resolvedAt` (audit fix, Phase 7). */
  async listResolvedSince(orgId: string, since: Date, limit = 200): Promise<RiskSignal[]> {
    return prisma.riskSignal.findMany({
      where: { orgId, resolved: true, resolvedAt: { gte: since } },
      orderBy: { resolvedAt: "asc" },
      take: limit
    });
  }
};
