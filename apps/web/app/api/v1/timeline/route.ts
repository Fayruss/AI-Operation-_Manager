import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api/handler";
import { ApiError } from "@/lib/api/errors";
import { getActionTimeline, type TimelineEntityType } from "@/lib/timeline/action-timeline-service";

const timelineQuerySchema = z.object({
  entityType: z.enum(["task", "email", "meeting", "report"]),
  entityId: z.string().uuid()
});

/**
 * SAD §13.9 AI Action Timeline. Not in the API Contract's four canonical
 * patterns (it's a pure aggregation read, closest to Pattern A's GET
 * variant) — client-side ActionTimeline usages (e.g. from the AI Copilot)
 * hit this route; server-rendered detail pages (meeting/report) call
 * `getActionTimeline` directly per Next.js 15 Server Component convention.
 */
export const GET = apiRoute(async (request, ctx) => {
  const parsed = timelineQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", "entityType and entityId are required", parsed.error.flatten());
  }
  const events = await getActionTimeline(ctx.orgId, parsed.data.entityType as TimelineEntityType, parsed.data.entityId);
  return NextResponse.json(events);
});
