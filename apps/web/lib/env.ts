import "server-only";
import { z } from "zod";

/**
 * Environment configuration validation. Fails fast and loud on
 * misconfiguration in production; in development, missing Supabase vars are
 * a warning (not an error) since the UI intentionally falls back to demo
 * data without a live project (see lib/mock/mock-data.ts, lib/auth/get-current-user.ts)
 * so the shell stays reviewable pre-provisioning. `DATABASE_URL` is always
 * required — Prisma has no equivalent mock fallback.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (Prisma connection string)"),
  DIRECT_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL").optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
  ENCRYPTION_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-3-5-sonnet-latest"),
  N8N_WEBHOOK_SECRET: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(1).optional(),
  /** Phase 7 — Memory Module (SAD §2.6), embedding-client.ts's Voyage provider. */
  VOYAGE_API_KEY: z.string().min(1).optional(),
  EMBEDDING_MODEL: z.string().min(1).default("voyage-3-large")
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  const env = parsed.data;
  const isProd = env.NODE_ENV === "production";
  const supabaseConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseConfigured) {
    const message =
      "Supabase environment variables are not set — authenticated API routes will reject every request " +
      "(UNAUTHENTICATED) and the UI shell falls back to demo data. See .env.example.";
    if (isProd) {
      throw new Error(message);
    }
    console.warn(`[env] ${message}`);
  }

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[env] SUPABASE_SERVICE_ROLE_KEY is not set — report PDF generation/download (lib/storage/report-storage.ts) will fail, and it's required once n8n workflows call the API (Phase 3+)."
    );
  }

  const emailOAuthConfigured = Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET
  );
  if (!emailOAuthConfigured) {
    console.warn(
      "[env] Gmail/Outlook OAuth client credentials are not fully set — Settings → Integrations connect flows will fail at the provider redirect step until configured."
    );
  }

  if (!env.ENCRYPTION_KEY) {
    const message = "ENCRYPTION_KEY is not set — connecting an email account will fail (lib/security/encryption.ts requires it to store OAuth tokens).";
    if (isProd) throw new Error(message);
    console.warn(`[env] ${message}`);
  }

  if (!env.ANTHROPIC_API_KEY) {
    const message = "ANTHROPIC_API_KEY is not set — the Classifier/Summarizer Agents will fail every run until configured.";
    if (isProd) throw new Error(message);
    console.warn(`[env] ${message}`);
  }

  if (!env.N8N_WEBHOOK_SECRET) {
    console.warn("[env] N8N_WEBHOOK_SECRET is not set — POST /api/v1/webhooks/n8n/callback will reject every request until configured.");
  }

  if (!env.CRON_SECRET) {
    console.warn("[env] CRON_SECRET is not set — GET /api/v1/cron/risk-scan will reject every request (including Vercel Cron) until configured.");
  }

  if (!env.VOYAGE_API_KEY) {
    // Deliberately warn-only, even in production: unlike ANTHROPIC_API_KEY
    // (which every core agent hard-depends on), the Memory Module is
    // designed to degrade gracefully without embeddings —
    // memory-retrieval-service.ts never throws on provider failure, it
    // just returns no context and agents run without memory augmentation.
    console.warn(
      "[env] VOYAGE_API_KEY is not set — the Memory Module's embedding pipeline and semantic retrieval (Memory Explorer search, agent memory context) will be inert until configured; memory entries will still be recorded, just never embedded/retrievable."
    );
  }

  cached = env;
  return env;
}
