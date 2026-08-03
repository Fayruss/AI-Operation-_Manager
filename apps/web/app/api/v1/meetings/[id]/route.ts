import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { MeetingRepository } from "@/lib/repositories/meeting-repository";

/** SAD §5 `GET /meetings/:id` — "Meeting summary + action items." */
export const GET = apiRoute<{ id: string }>(async (_request, ctx, { id }) => {
  const meeting = await MeetingRepository.getByIdWithActionItems(ctx.orgId, id);
  return NextResponse.json(meeting);
});
