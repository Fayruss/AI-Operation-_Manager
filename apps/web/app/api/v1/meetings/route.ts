import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parsePaginationParams } from "@/lib/api/pagination";
import { MeetingRepository } from "@/lib/repositories/meeting-repository";

/** SAD §7.5 Meeting Dashboard — member+, paginated cursor-based list. */
export const GET = apiRoute(async (request, ctx) => {
  const { cursor, limit } = parsePaginationParams(request.nextUrl.searchParams);
  const page = await MeetingRepository.list(ctx.orgId, cursor, limit);
  return NextResponse.json(page);
});
