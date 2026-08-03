import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parsePaginationParams } from "@/lib/api/pagination";
import { listEmailsQuerySchema } from "@/lib/validation/email";
import { EmailMessageRepository } from "@/lib/repositories/email-message-repository";

/** SAD §5 `GET /emails` — member+, paginated cursor-based, filter by urgency/status. */
export const GET = apiRoute(async (request, ctx) => {
  const { cursor, limit } = parsePaginationParams(request.nextUrl.searchParams);
  const filters = listEmailsQuerySchema.parse({
    status: request.nextUrl.searchParams.get("status") ?? undefined,
    urgency: request.nextUrl.searchParams.get("urgency") ?? undefined
  });
  const page = await EmailMessageRepository.list(ctx.orgId, filters, cursor, limit);
  return NextResponse.json(page);
});
