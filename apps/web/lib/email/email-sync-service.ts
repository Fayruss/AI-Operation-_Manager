import "server-only";
import { prisma } from "@ai-ops/database";
import { EmailAccountRepository } from "@/lib/repositories/email-account-repository";
import { EmailMessageRepository } from "@/lib/repositories/email-message-repository";
import { TaskRepository } from "@/lib/repositories/task-repository";
import { OrganizationRepository } from "@/lib/repositories/organization-repository";
import { runClassifierAgent } from "@/lib/ai/agents/classifier-agent";
import { fetchGmailMessage, refreshGmailAccessToken, fetchLatestGmailMessageId } from "@/lib/integrations/gmail-oauth";
import { fetchOutlookMessage, refreshOutlookAccessToken } from "@/lib/integrations/outlook-oauth";
import type { NormalizedEmail } from "@/lib/integrations/gmail-oauth";

/**
 * SAD §2.1/§8.1 Email Processing pipeline — the direct-invocation stand-in
 * for the n8n Email Processing Workflow (n8n Workflow Spec §1) described in
 * that document's Nodes 1–8. n8n itself is explicitly out of scope for this
 * phase; this service preserves the same steps and failure-handling
 * semantics in-process:
 *   1. fetch full message (provider API, refreshing the token if needed)
 *   2. write `email_messages` (status=unprocessed)
 *   3. Classifier Agent call (logged via agent_runs)
 *   4. IF intent=task AND confidence>=threshold → create task (source=email)
 *      ELSE IF intent=task → notify the account owner, awaiting approval
 *      ELSE → classification only, no task
 *   5. apply classification to the email_messages row
 * Failure at the classifier step leaves the email `status=unprocessed`
 * (never silently dropped, matching n8n Workflow Spec §1's failure handling)
 * — the caller (webhook route) is responsible for surfacing that to the
 * user via the standard error/notification paths.
 */

async function getFreshAccessToken(accountId: string, orgId: string): Promise<string> {
  const account = await EmailAccountRepository.getByIdInOrg(orgId, accountId);
  const tokens = EmailAccountRepository.getDecryptedTokens(account);

  const isExpired = new Date(tokens.expiresAt).getTime() < Date.now() + 60_000;
  if (!isExpired) {
    return tokens.accessToken;
  }
  if (!tokens.refreshToken) {
    throw new Error("Access token expired and no refresh token is stored — the account needs to be reconnected.");
  }

  const refreshed =
    account.provider === "gmail"
      ? await refreshGmailAccessToken(tokens.refreshToken)
      : await refreshOutlookAccessToken(tokens.refreshToken);

  await EmailAccountRepository.updateTokens(accountId, refreshed);
  return refreshed.accessToken;
}

async function fetchNormalizedMessage(
  provider: "gmail" | "outlook",
  accessToken: string,
  providerMessageId: string
): Promise<NormalizedEmail> {
  return provider === "gmail"
    ? fetchGmailMessage(accessToken, providerMessageId)
    : fetchOutlookMessage(accessToken, providerMessageId);
}

/**
 * A project/board must exist to attach an AI-created task to. Foundation
 * phase heuristic: use the org's first project/board (multi-project routing
 * rules are a Phase 4+ concern — Task & Project Core's board-assignment
 * logic isn't part of Email Intelligence). Returns null if the org has no
 * boards yet, in which case classification still happens but no task is
 * auto-created (surfaced via the awaiting-approval/notification path instead).
 */
export async function findDefaultBoardId(orgId: string): Promise<string | null> {
  const board = await prisma.board.findFirst({ where: { orgId }, orderBy: { createdAt: "asc" } });
  return board?.id ?? null;
}

export interface IngestEmailResult {
  emailMessageId: string;
  agentRunId: string;
  taskCreated: boolean;
  requiresApproval: boolean;
}

export async function ingestProviderMessage(
  orgId: string,
  accountId: string,
  providerMessageId: string
): Promise<IngestEmailResult> {
  const account = await EmailAccountRepository.getByIdInOrg(orgId, accountId);
  const accessToken = await getFreshAccessToken(accountId, orgId);
  const normalized = await fetchNormalizedMessage(account.provider, accessToken, providerMessageId);

  const emailMessage = await EmailMessageRepository.createFromNormalizedEmail(orgId, accountId, normalized);

  const org = await OrganizationRepository.getById(orgId);

  let classifierResult: Awaited<ReturnType<typeof runClassifierAgent>>;
  try {
    classifierResult = await runClassifierAgent(
      { orgId, emailMessage: { id: emailMessage.id, sender: emailMessage.sender, subject: emailMessage.subject, bodySnippet: emailMessage.bodySnippet } },
      org.classifierThreshold
    );
  } catch {
    // Classifier exhausted its retry/repair attempts — never silently drop
    // the email (n8n Workflow Spec §1 failure handling).
    await EmailMessageRepository.markUnprocessed(emailMessage.id);
    throw new Error(`Classification failed for email ${emailMessage.id}; left as unprocessed for manual review.`);
  }

  await EmailMessageRepository.applyClassification(emailMessage.id, {
    urgency: classifierResult.output.urgency,
    intent: classifierResult.output.intent
  });

  let taskCreated = false;

  if (classifierResult.output.intent === "task" && classifierResult.output.suggested_task) {
    if (!classifierResult.requiresApproval) {
      const boardId = await findDefaultBoardId(orgId);
      if (boardId) {
        await TaskRepository.createFromAgent(orgId, boardId, classifierResult.agentRunId, {
          title: classifierResult.output.suggested_task.title,
          priority: classifierResult.output.suggested_task.priority,
          source: "email",
          sourceRefId: emailMessage.id
        });
        taskCreated = true;
      }
      // No board exists yet — classification still succeeded; task creation
      // simply has nothing to attach to. Not an error condition.
    } else {
      // PRD acceptance criteria: low-confidence task-intent emails become a
      // notification requiring confirmation, not an auto-applied task.
      await prisma.notification.create({
        data: {
          orgId,
          userId: account.userId,
          type: "email.suggested_task",
          payload: {
            title: "Review suggested task from email",
            description: classifierResult.output.suggested_task.title,
            href: `/app/emails/${emailMessage.id}`
          }
        }
      });
    }
  }

  return {
    emailMessageId: emailMessage.id,
    agentRunId: classifierResult.agentRunId,
    taskCreated,
    requiresApproval: classifierResult.requiresApproval
  };
}

/**
 * Gmail webhook entry point — the push payload only carries `{emailAddress,
 * historyId}` (see fetchLatestGmailMessageId's doc comment), so the webhook
 * route calls this instead of `ingestProviderMessage` directly. Returns null
 * if the mailbox has no messages (nothing to ingest — not an error).
 */
export async function ingestLatestGmailMessage(orgId: string, accountId: string): Promise<IngestEmailResult | null> {
  const accessToken = await getFreshAccessToken(accountId, orgId);
  const messageId = await fetchLatestGmailMessageId(accessToken);
  if (!messageId) return null;
  return ingestProviderMessage(orgId, accountId, messageId);
}
