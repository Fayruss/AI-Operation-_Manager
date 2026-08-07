import { NextRequest, NextResponse, after } from "next/server";
import { OrganizationRepository } from "@/lib/repositories/organization-repository";
import { verifyWebhookSignature } from "@/lib/security/webhook";
import { ingestMeetingSchema } from "@/lib/validation/meeting";
import { processMeetingTranscript } from "@/lib/meetings/meeting-processing-service";
import { writeAuditLog } from "@/lib/api/audit";

/**
 * SAD §5 `POST /meetings/ingest` — "Webhook: receive transcript", system
 * (HMAC), "triggers Summarizer Agent." Same shape as the email webhooks
 * (Phase 3): signature verified before parsing, org identified via
 * `?orgId=` on the URL we control, fast-ack via `after()` standing in for
 * n8n's queue (n8n itself out of scope).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const orgId = request.nextUrl.searchParams.get("orgId");
  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature");

  if (!orgId) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "orgId is required" } }, { status: 400 });
  }

  const org = await OrganizationRepository.getById(orgId).catch(() => null);
  if (!org || !org.meetingWebhookSecret || !verifyWebhookSignature(rawBody, signature, org.meetingWebhookSecret)) {
    if (org) {
      await writeAuditLog({
        orgId: org.id,
        actorId: null,
        actorType: "system",
        action: "webhook.invalid_signature",
        resourceType: "organization",
        resourceId: org.id
      });
    }
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE", message: "Signature verification failed" } }, { status: 401 });
  }

  let parsed: ReturnType<typeof ingestMeetingSchema.safeParse>;
  try {
    parsed = ingestMeetingSchema.safeParse(JSON.parse(rawBody));
  } catch {
    await writeAuditLog({
      orgId: org.id,
      actorId: null,
      actorType: "system",
      action: "meeting.ingestion_failed",
      resourceType: "organization",
      resourceId: org.id,
      metadata: { reason: "malformed_payload" }
    });
    return NextResponse.json({ received: true });
  }

  if (!parsed.success) {
    await writeAuditLog({
      orgId: org.id,
      actorId: null,
      actorType: "system",
      action: "meeting.ingestion_failed",
      resourceType: "organization",
      resourceId: org.id,
      metadata: { reason: "validation_failed", issues: parsed.error.issues }
    });
    // Still ack — the provider shouldn't retry-storm us over a payload that
    // will never validate; the failure is already logged for investigation.
    return NextResponse.json({ received: true });
  }

  const input = parsed.data;

  after(async () => {
    try {
      await processMeetingTranscript(org.id, input);
    } catch (error) {
      console.error("[meetings/ingest] processing failed", error);
      await writeAuditLog({
        orgId: org.id,
        actorId: null,
        actorType: "system",
        action: "meeting.ingestion_failed",
        resourceType: "organization",
        resourceId: org.id,
        metadata: { reason: error instanceof Error ? error.message : String(error) }
      });
    }
  });

  return NextResponse.json({ received: true });
}
