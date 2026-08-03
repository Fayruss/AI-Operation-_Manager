import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/security/webhook";
import { n8nCallbackSchema } from "@/lib/validation/agent";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { writeAuditLog } from "@/lib/api/audit";

/**
 * SAD §5 `POST /webhooks/n8n/callback` — "n8n workflow result callback,
 * system (HMAC), writes agent_runs." This is the app-side half of the n8n
 * integration contract: a real n8n workflow (Phase 5+ when n8n is actually
 * connected — infra/n8n/workflows/*.json export the workflow definitions
 * that would call this) reports the outcome of work it performed, and this
 * app persists it to `agent_runs` exactly like an in-process agent would,
 * so the AI Control Center / audit trail don't need to know which
 * orchestration path produced a given run.
 *
 * Auth: a single shared `N8N_WEBHOOK_SECRET` (server-to-server, "service
 * role" per SAD §3.2/n8n Workflow Spec — not per-org like the email/meeting
 * provider webhooks, since n8n is our own infrastructure, not a third-party
 * per-tenant integration).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Signature");
  const secret = process.env.N8N_WEBHOOK_SECRET;

  if (!secret || !verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: { code: "INVALID_SIGNATURE", message: "Signature verification failed" } }, { status: 401 });
  }

  let parsed: ReturnType<typeof n8nCallbackSchema.safeParse>;
  try {
    parsed = n8nCallbackSchema.safeParse(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Request body must be valid JSON" } }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid callback payload", details: { issues: parsed.error.issues } } },
      { status: 400 }
    );
  }

  const input = parsed.data;

  try {
    const run = await AgentRunRepository.recordExternalResult(input);

    await writeAuditLog({
      orgId: input.orgId,
      actorId: null,
      actorType: "system",
      action: "n8n.callback_received",
      resourceType: "agent_run",
      resourceId: run.id,
      metadata: { agentName: input.agentName, status: input.status }
    });

    return NextResponse.json({ agentRunId: run.id, status: run.status });
  } catch (error) {
    console.error("[webhooks/n8n/callback] failed to record result", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to record workflow result" } }, { status: 500 });
  }
}
