import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { EmailMessageRepository } from "@/lib/repositories/email-message-repository";

export const GET = apiRoute<{ id: string }>(async (_request, ctx, { id }) => {
  const message = await EmailMessageRepository.getById(ctx.orgId, id);
  return NextResponse.json(message);
});
