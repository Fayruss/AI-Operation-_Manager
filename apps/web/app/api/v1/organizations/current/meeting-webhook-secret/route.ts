import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api/handler";
import { OrganizationRepository } from "@/lib/repositories/organization-repository";

/**
 * Provisioning endpoint for the `POST /meetings/ingest` webhook secret
 * (API Contract Pattern C's "org's webhook secret" — there's no
 * meeting-accounts table to generate one per-connection like email's
 * OAuth flow does, so this is the org-level equivalent of Settings →
 * Integrations "show connection details"). Admin+ since it returns a
 * live secret usable to forge ingestion requests.
 */
export const GET = apiRoute(
  async (_request, ctx) => {
    const secret = await OrganizationRepository.getOrCreateMeetingWebhookSecret(ctx.orgId);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.json({
      webhookUrl: `${appUrl}/api/v1/meetings/ingest?orgId=${ctx.orgId}`,
      secret
    });
  },
  { minRole: "admin" }
);
