# Deployment Runbook — AI Operations Manager

Production deployment, verification, and rollback procedure.

**Scope note.** Everything in this document requires credentials and
infrastructure that live outside the repository. Nothing here has been
executed — the repository is deployment-*ready*, not deployment-*verified*.
See [Limitations](#10-limitations) for exactly what remains unproven.

---

## 1. Prerequisites

| Requirement | Notes |
|---|---|
| Vercel account + project | Hosts the Next.js app (SAD §3.1). |
| Supabase project | Postgres + Auth + Storage. Must have the `vector` extension enabled for the Memory Module (SAD §2.6). |
| Anthropic API key | Every agent (SAD §9). |
| Voyage AI API key | Embeddings. Optional — memory degrades gracefully without it. |
| Google Cloud OAuth client | Gmail integration. Optional. |
| Microsoft Entra app registration | Outlook integration. Optional. |
| Node 20+, pnpm 9.7.0 | Matches `engines.node` and `packageManager`. |

---

## 2. Environment variables

The authoritative list is `.env.example`. `apps/web/lib/env.ts` validates it
at boot via `instrumentation.ts`, and a test (`lib/env.test.ts`) fails the
build if the two drift apart.

### Required — the app will not boot without these in production

| Variable | Purpose | Failure mode if missing |
|---|---|---|
| `DATABASE_URL` | Prisma connection string | Hard failure at startup — no mock fallback. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Throws in production; warns in development. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser Supabase client | Throws in production; warns in development. |
| `ENCRYPTION_KEY` | AES-256-GCM key for OAuth tokens at rest (SAD §12) | Throws in production. Generate: `openssl rand -hex 32`. |
| `ANTHROPIC_API_KEY` | All agent calls | Throws in production. |

### Required for specific capabilities — warn-only, app still boots

| Variable | Disabled capability if unset |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Report PDF storage and download. |
| `CRON_SECRET` | Scheduled risk scans and weekly reports reject every call, including Vercel Cron. |
| `N8N_WEBHOOK_SECRET` | `POST /api/v1/webhooks/n8n/callback` rejects every request. |
| `VOYAGE_API_KEY` | Memory embedding + semantic retrieval. Entries still record, never become retrievable. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail connect flow. |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Outlook connect flow. |

### Optional with defaults

| Variable | Default |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` — **must** be set to the production URL, or OAuth redirects break. |
| `ANTHROPIC_MODEL` | `claude-3-5-sonnet-latest` |
| `EMBEDDING_MODEL` | `voyage-3-large` (1536-dim, matching the `vector(1536)` column — only override with another 1536-dim model). |
| `DIRECT_URL` | Falls back to `DATABASE_URL`. Set when using a pooled connection. |

> **Secret handling.** Set these in Vercel's project settings (Production /
> Preview / Development scopes), never in the repository. `.env.local` is
> gitignored and must stay that way.

---

## 3. GitHub Actions setup

`.github/workflows/ci.yml` runs install → prisma generate → lint →
typecheck → build → test on every push and PR to `main`/`master`.

CI needs **no secrets**. It uses non-secret placeholder values so the build
is hermetic — it verifies the code compiles, never that it can reach a live
Supabase or Anthropic project. Do not add production secrets to CI.

To require CI before merge: **Settings → Branches → Add branch protection
rule** → require the `Lint, typecheck, build, test` status check.

---

## 4. Database migration

Run **before** the first deploy and before any deploy carrying a schema change.

```bash
pnpm --filter @ai-ops/database prisma migrate deploy
pnpm --filter @ai-ops/database run db:apply-sql   # RLS policies + pgvector setup
```

`db:apply-sql` is not optional. It applies the Row Level Security policies
that enforce tenant isolation (SAD §4). A deploy with migrations applied but
RLS missing is a **cross-tenant data exposure**, not a degraded feature.

Verify RLS is active before proceeding:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
-- every application table must show rowsecurity = true
```

---

## 5. Vercel deployment

1. **Import the repository** into Vercel.
2. **Framework preset**: Next.js. **Root directory**: `apps/web`.
3. **Build command**: `cd ../.. && pnpm build --filter @ai-ops/web`
4. **Install command**: `pnpm install --frozen-lockfile`
5. **Environment variables**: add everything from §2 to the Production scope.
6. **Deploy.**

### Cron jobs (SAD §8.4, §8.6)

Configure in `vercel.json` or the Vercel dashboard. Each sends
`Authorization: Bearer $CRON_SECRET`:

| Path | Suggested schedule | Purpose |
|---|---|---|
| `/api/v1/cron/risk-scan` | every 15 min | Risk detection cycle. |
| `/api/v1/cron/weekly-report` | Mondays 07:00 | Weekly executive report. |
| `/api/v1/cron/memory-consolidation` | nightly 02:00 | Memory consolidation. |

---

## 6. Post-deployment verification

Run in order. Stop and roll back on the first failure.

| # | Check | Expected |
|---|---|---|
| 1 | `GET /api/v1/healthcheck` | `200`. |
| 2 | Server boot logs | No `Environment validation failed`. Review any `[env]` warnings. |
| 3 | Sign in with a real account | Redirects to `/app/dashboard`. |
| 4 | Load each dashboard | No client errors; empty states render where there's no data. |
| 5 | Create a task through the UI | Persists; appears in Settings → Audit Log. |
| 6 | Open Settings → Audit Log as admin | Table populates. |
| 7 | Open Settings → Audit Log as a **member** | Tab is not shown; direct API call returns `403`. |
| 8 | Open `/app/settings/ai-control-center` as a **member** | `404` (admin-only; deliberately not `403`, per SAD §5). |
| 9 | Trigger a cron path without the bearer token | `401`. |
| 10 | **Cross-tenant check**: with org B's session, request an org A record by id | `404` — never that record's contents. |

Check 10 is the one that matters most. A failure there is a data breach, not
a bug — roll back immediately.

---

## 7. Rollback procedure

**Code rollback** (Vercel keeps every previous deployment):

1. Vercel dashboard → **Deployments**.
2. Select the last known-good deployment.
3. **⋯ → Promote to Production**. Takes effect in seconds; no rebuild.

**Database rollback** is not symmetric with code rollback. Prisma migrations
are forward-only in production. If a deploy shipped a destructive migration:

1. Promote the previous deployment first (stops further writes under the new
   schema).
2. Restore from the Supabase point-in-time backup taken before the migration.
3. Accept the data delta between backup and restore, or reconcile manually.

> **Therefore**: take a Supabase backup immediately before any deploy that
> includes a migration. This is the step that makes rollback survivable.

---

## 8. Production readiness checklist

Before announcing the deploy:

- [ ] CI green on the deployed commit
- [ ] Database migrations applied
- [ ] `db:apply-sql` run; RLS verified active on every table
- [ ] All §2 required variables set in the Production scope
- [ ] `NEXT_PUBLIC_APP_URL` set to the production URL
- [ ] OAuth redirect URIs registered with Google and Microsoft for that URL
- [ ] Supabase Auth redirect URLs include the production domain
- [ ] Cron jobs configured with `CRON_SECRET`
- [ ] All ten §6 verification checks pass
- [ ] Pre-deploy database backup taken
- [ ] Rollback target identified (the currently-good deployment)

---

## 9. Monitoring checklist

**Not configured in this repository.** Requires external services and
credentials. Set up after the first successful deploy:

- [ ] **Error tracking** (Sentry per SAD §3.1, or equivalent) — capture
      server and client exceptions.
- [ ] **Uptime monitoring** — poll `/api/v1/healthcheck`; alert on two
      consecutive failures.
- [ ] **AI Control Center review** (`/app/settings/ai-control-center`) —
      this ships in-app and needs no external service. Watch: queue depth
      (backlog), p95 latency (Claude API degradation), per-agent failure
      rate, retry distribution (a spike flags a regressing prompt).
- [ ] **Cost alerting** — Anthropic and Voyage spend against budget. The
      Control Center's token/cost panel gives the in-app view.
- [ ] **Database** — Supabase connection pool utilization and slow queries.
- [ ] **Pending approvals** — a growing queue means AI work is stuck waiting
      on humans, which is invisible from infrastructure metrics alone.

---

## 10. Limitations

The following Phase 10 deliverables **cannot be completed inside the
repository** and remain outstanding:

| Item | Why it's blocked | What it needs |
|---|---|---|
| Vercel production deploy | Requires account credentials; deploying is an outward-facing action. | Operator runs §5. |
| Sentry / error monitoring | Requires a DSN and an account. | Provision, then add the SDK. |
| Uptime alerting | External service. | Provision against `/api/v1/healthcheck`. |
| Load testing | Needs a deployed environment and realistic data volume (Test Plan §6: 10k+ tasks, 5k+ emails). | Run post-deploy. |
| Rollback drill | Requires two real deployments. | Rehearse §7 in a preview environment. |
| Integration + e2e tests | Test Plan §2/§3 need a live test database and seeded fixtures. | Provision a test database. |
| Multi-tenant isolation at scale | Test Plan §7's nightly two-org job needs a scheduled environment. | Configure post-deploy. |

Until §6's checks — particularly check 10 — have been executed against a
real deployment, treat the system as unverified in production regardless of
CI status.
