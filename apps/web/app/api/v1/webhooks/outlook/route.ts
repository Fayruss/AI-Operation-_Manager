import { NextRequest, NextResponse, unstable_after as after } from "next/server";
import { EmailAccountRepository } from "@/lib/repositories/email-account-repository";
import { ingestProviderMessage } from "@/lib/email/email-sync-service";
import { writeAuditLog } from "@/lib/api/audit";

interface GraphNotification {
  subscriptionId: string;
  clientState?: string;
  resourceData?: { id: string };
}

/**
 * Microsoft Graph's real webhook contract differs from Gmail's in two ways
 * this route has to handle: (1) subscription creation requires echoing back
 * a `validationToken` query param as plain text within 10s, and (2) ongoing
 * notifications carry the message id directly in `resourceData.id` (no
 * "fetch latest message" workaround needed, unlike Gmail's push payload).
 * `clientState` plays the same role as the API Contract's generic
 * `X-Signature` — a shared secret the provider echoes back per notification.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "accountId is required" } }, { status: 400 });
  }

  const account = await EmailAccountRepository.findByIdForWebhook(accountId);
  if (!account) {
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE", message: "Signature verification failed" } }, { status: 401 });
  }

  let body: { value?: GraphNotification[] };
  try {
    body = (await request.json()) as { value?: GraphNotification[] };
  } catch {
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

  const notifications = body.value ?? [];
  const invalidClientState = notifications.some((n) => n.clientState !== account.webhookSecret);
  if (invalidClientState) {
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

  const messageIds = notifications.map((n) => n.resourceData?.id).filter((id): id is string => Boolean(id));

  after(async () => {
    for (const messageId of messageIds) {
      try {
        await ingestProviderMessage(account.orgId, account.id, messageId);
      } catch (error) {
        console.error("[webhooks/outlook] ingestion failed", error);
        await writeAuditLog({
          orgId: account.orgId,
          actorId: null,
          actorType: "system",
          action: "email.ingestion_failed",
          resourceType: "email_account",
          resourceId: account.id,
          metadata: { reason: error instanceof Error ? error.message : String(error), messageId }
        });
      }
    }
  });

  return NextResponse.json({ received: true });
}
