import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { parsePaginationParams } from "@/lib/api/pagination";
import { AuditLogRepository } from "@/lib/repositories/audit-log-repository";

const auditLogQuerySchema = z.object({
  actorId: z.string().uuid().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().uuid().optional()
});

/** SAD §5 — `GET /audit-log`, owner/admin only, filterable by actor/resource. */
export const GET = apiRoute(
  async (request, ctx) => {
    const { cursor, limit } = parsePaginationParams(request.nextUrl.searchParams);
    const filters = auditLogQuerySchema.parse({
      actorId: request.nextUrl.searchParams.get("actorId") ?? undefined,
      resourceType: request.nextUrl.searchParams.get("resourceType") ?? undefined,
      resourceId: request.nextUrl.searchParams.get("resourceId") ?? undefined
    });
    const page = await AuditLogRepository.list(ctx.orgId, filters, cursor, limit);
    return NextResponse.json(page);
  },
  { minRole: "admin" }
);
