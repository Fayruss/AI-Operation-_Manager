import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { UserRepository } from "@/lib/repositories/user-repository";

/** SAD §7.8 Settings → Users & Roles. member+ can view the roster. */
export const GET = apiRoute(async (_request, ctx) => {
  const users = await UserRepository.listByOrg(ctx.orgId);
  return NextResponse.json({ users });
});
