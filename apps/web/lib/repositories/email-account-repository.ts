import "server-only";
import { randomBytes } from "node:crypto";
import { prisma, type EmailAccount, type EmailProvider } from "@ai-ops/database";
import { ApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/api/audit";
import { encrypt, decrypt } from "@/lib/security/encryption";
import type { OAuthTokens } from "@/lib/integrations/gmail-oauth";

interface StoredTokenPayload {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
}

export const EmailAccountRepository = {
  /** Client-facing list — deliberately excludes both `oauthTokenEncrypted` and `webhookSecret`. */
  async listByOrg(orgId: string): Promise<Omit<EmailAccount, "oauthTokenEncrypted" | "webhookSecret">[]> {
    return prisma.emailAccount.findMany({
      where: { orgId },
      orderBy: { createdAt: "desc" },
      select: { id: true, orgId: true, userId: true, provider: true, syncCursor: true, createdAt: true }
    });
  },

  /** Internal use only (token refresh, webhook signature checks) — returns the full row including encrypted secrets. Never expose this response directly to a client. */
  async getByIdInOrg(orgId: string, accountId: string): Promise<EmailAccount> {
    const account = await prisma.emailAccount.findFirst({ where: { id: accountId, orgId } });
    if (!account) {
      throw new ApiError("NOT_FOUND", "Email account not found", undefined, "EMAIL_ACCOUNT_NOT_FOUND");
    }
    return account;
  },

  async connect(orgId: string, userId: string, provider: EmailProvider, tokens: OAuthTokens): Promise<EmailAccount> {
    const payload: StoredTokenPayload = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt.toISOString()
    };

    const account = await prisma.emailAccount.create({
      data: {
        orgId,
        userId,
        provider,
        oauthTokenEncrypted: encrypt(JSON.stringify(payload)),
        webhookSecret: randomBytes(32).toString("hex")
      }
    });

    await writeAuditLog({
      orgId,
      actorId: userId,
      action: "email_account.connected",
      resourceType: "email_account",
      resourceId: account.id,
      metadata: { provider }
    });

    return account;
  },

  /** Webhook routes look up the account by id (from the callback URL/payload) then verify the signature against this. */
  async findByIdForWebhook(accountId: string): Promise<EmailAccount | null> {
    return prisma.emailAccount.findUnique({ where: { id: accountId } });
  },

  getDecryptedTokens(account: EmailAccount): StoredTokenPayload {
    return JSON.parse(decrypt(account.oauthTokenEncrypted)) as StoredTokenPayload;
  },

  async updateTokens(accountId: string, tokens: OAuthTokens): Promise<void> {
    const payload: StoredTokenPayload = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt.toISOString()
    };
    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { oauthTokenEncrypted: encrypt(JSON.stringify(payload)) }
    });
  }
};
