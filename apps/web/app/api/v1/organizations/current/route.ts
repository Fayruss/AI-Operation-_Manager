import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { parseJsonBody } from "@/lib/api/request";
import { updateOrganizationSchema } from "@/lib/validation/organization";
import { OrganizationRepository } from "@/lib/repositories/organization-repository";

/** SAD §6.2 org switcher / Settings §7.8 org profile. */
export const GET = apiRoute(async (_request, ctx) => {
  const org = await OrganizationRepository.getById(ctx.orgId);
  return NextResponse.json(org);
});

/** Settings §7.8 "Org profile" edit — owner only (plan/billing fields stay read-only here). */
export const PATCH = apiRoute(
  async (request, ctx) => {
    const input = await parseJsonBody(request, updateOrganizationSchema);
    const updated = await OrganizationRepository.update(ctx.orgId, ctx.userId, input);
    return NextResponse.json(updated);
  },
  { minRole: "owner" }
);
