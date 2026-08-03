import "server-only";
import { prisma, type Report, type ReportType, type ReportGeneratedBy, type Prisma } from "@ai-ops/database";
import { ApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/api/audit";
import { cursorWhere, paginate, type CursorPosition } from "@/lib/api/pagination";

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export interface ReportFilters {
  type?: ReportType;
}

export const ReportRepository = {
  async list(orgId: string, filters: ReportFilters, cursor: CursorPosition | null, limit: number) {
    const rows = await prisma.report.findMany({
      where: { orgId, type: filters.type, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1
    });
    return paginate(rows, limit);
  },

  async getByIdInOrg(orgId: string, id: string): Promise<Report> {
    const report = await prisma.report.findFirst({ where: { id, orgId } });
    if (!report) {
      throw new ApiError("NOT_FOUND", "Report not found", undefined, "REPORT_NOT_FOUND");
    }
    return report;
  },

  /** SAD §9.4: "memory of prior report... show trend deltas" — the most recent completed report before this period, used as trend-comparison context (no Memory/RAG module needed for this, just the last row). */
  async findMostRecentCompleted(orgId: string, type: ReportType): Promise<Report | null> {
    return prisma.report.findFirst({
      where: { orgId, type, status: { in: ["complete", "complete_fallback"] } },
      orderBy: { createdAt: "desc" }
    });
  },

  /** API Contract Pattern B: `POST /reports/generate` → 202, `status: "generating"`. */
  async create(orgId: string, input: { type: ReportType; generatedBy: ReportGeneratedBy; periodStart: Date; periodEnd: Date }): Promise<Report> {
    const report = await prisma.report.create({
      data: {
        orgId,
        type: input.type,
        generatedBy: input.generatedBy,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: "generating"
      }
    });

    await writeAuditLog({
      orgId,
      actorId: null,
      actorType: input.generatedBy === "manual" ? "user" : "system",
      action: "report.generation_started",
      resourceType: "report",
      resourceId: report.id,
      metadata: { type: input.type, generatedBy: input.generatedBy }
    });

    return report;
  },

  async markComplete(id: string, input: { status: "complete" | "complete_fallback"; content: unknown; pdfUrl: string | null }): Promise<Report> {
    return prisma.report.update({
      where: { id },
      data: { status: input.status, content: toJsonInput(input.content), pdfUrl: input.pdfUrl }
    });
  },

  async markFailed(id: string): Promise<Report> {
    return prisma.report.update({ where: { id }, data: { status: "failed" } });
  }
};
