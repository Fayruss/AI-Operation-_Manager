import { NextRequest, NextResponse, unstable_after as after } from "next/server";
import { EmailAccountRepository } from "@/lib/repositories/email-account-repository";
import { verifyWebhookSignature } from "@/lib/security/webhook";
import { ingestLatestGmailMessage } from "@/lib/email/email-sync-service";
import { writeAuditLog } from "@/lib/api/audit";

/**
 * API Contract Pattern C `POST /webhooks/gmail`. Signature verified before
 * any parsing; invalid → 401 INVALID_SIGNATURE, logged, nothing enqueued.
 * "Must return fast — actual processing is enqueued to n8n, not
 * synchronous": with no n8n in this phase, `after()` (stable in Next.js 15)
 * schedules the ingestion pipeline to run after the response is already
 * sent, which is the in-process equivalent of "ack now, process off the
 * request path" without needing a separate queue.
 *
 * The account is identified via `?accountId=` on the webhook URL — that URL
 * is what we register with the provider as the push endpoint at connect
 * time, so this is under our control, not attacker-supplied.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const accountId = request.nextUrl.searchParams.get("accountId");
  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature");

  if (!accountId) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "accountId is required" } }, { status: 400 });
  }

  const account = await EmailAccountRepository.findByIdForWebhook(accountId);
  if (!account) {
    // Same response whether the account is missing or the signature is bad —
    // no existence leakage, matching the API Contract's general 404/401 discipline.
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE", message: "Signature verification failed" } }, { status: 401 });
  }

  if (!verifyWebhookSignature(rawBody, signature, account.webhookSecret)) {
    await writeAuditLog({
      orgId: account.orgId,
      actorId: null,
      actorType: "system",
      action: "webhook.invalid_signature",
      resourceType: "email_account",
      resourceId: account.id
    });
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE", message: "Signature verification failed" } }, { status: 401 });
  }

  let parsedOk = true;
  try {
    JSON.parse(rawBody);
  } catch {
    parsedOk = false;
  }

  if (!parsedOk) {
    // "Malformed-but-signed payload → 200 (ack) but internally logged as
    // email.ingestion_failed... never silently dropped."
    await writeAuditLog({
      orgId: account.orgId,
      actorId: null,
      actorType: "system",
      action: "email.ingestion_failed",
      resourceType: "email_account",
      resourceId: account.id,
      metadata: { reason: "malformed_payload" }
    });
    return NextResponse.json({ received: true });
  }

  after(async () => {
    try {
      await ingestLatestGmailMessage(account.orgId, account.id);
    } catch (error) {
      console.error("[webhooks/gmail] ingestion failed", error);
      await writeAuditLog({
        orgId: account.orgId,
        actorId: null,
        actorType: "system",
        action: "email.ingestion_failed",
        resourceType: "email_account",
        resourceId: account.id,
        metadata: { reason: error instanceof Error ? error.message : String(error) }
      });
    }
  });

  return NextResponse.json({ received: true });
}
