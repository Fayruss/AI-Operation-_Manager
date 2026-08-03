import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { getOrganizationMap } from "@/lib/analytics/org-map-service";

/** SAD §13.7 Organization Map — used by the client-rendered React Flow canvas on the Analytics Dashboard. */
export const GET = apiRoute(async (_request, ctx) => {
  const map = await getOrganizationMap(ctx.orgId);
  return NextResponse.json(map);
});
