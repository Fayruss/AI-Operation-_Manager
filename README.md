# AI Operations Manager — Monorepo

**Status: Phases 1–10 delivered. Deployment-ready, not yet
production-verified.** Current milestone: post-Phase 10 deployment and
production launch — see `docs/DEPLOYMENT.md` and `BUILD_STATUS.md`.

Delivered: application shell, multi-tenant auth/RBAC, the Task & Project
Core data/API layer, governance foundations (RLS, audit log), Email
Intelligence (Gmail/Outlook OAuth, Classifier Agent), Meeting Intelligence
(Summarizer Agent, n8n callback contract), the Operations Health & Risk
Module (scheduled risk detection, Risk Agent, live Executive/Operations
Dashboards), the Reporting Module (Report Agent, PDF export, weekly +
on-demand generation), the Memory & RAG module with the Analytics/
differentiation layer (Chat Workspace, Command Center, Memory Explorer, Org
Map, ROI metrics), and Phase 10's governance and hardening work (Audit Log
UI, Approval Center, AI Control Center, RBAC hardening, accessibility pass,
Vitest suite, CI). See `CLAUDE.md` and the Implementation Guide for phase
sequencing.

## Verification status

| Command | Result |
|---|---|
| `pnpm install` | passes |
| `pnpm --filter @ai-ops/database prisma:generate` | passes |
| `pnpm lint` | no ESLint warnings or errors |
| `pnpm typecheck` | clean |
| `pnpm build` | passes |
| `pnpm test` | 92 passing (9 files) |

Run in CI on every push and PR via `.github/workflows/ci.yml`.

## Source of truth

This repo is generated strictly from the project documentation:
SAD, PRD, Design System, API Contract, Component Spec, n8n Workflow Spec,
Test Plan, Implementation Guide, CLAUDE.md.

## Getting started (local dev)

Requires Node ≥20 and pnpm ≥9. This scaffold was authored without network
access to the npm registry or a live database, so before first run:

```bash
pnpm install
cp .env.example .env.local   # fill in Supabase project keys
docker compose -f infra/docker/docker-compose.yml up -d   # local Postgres + n8n
pnpm db:generate

# One-time only: no migration history exists yet (this repo was built
# without a live DB to generate one against). Creates packages/database/prisma/migrations/.
pnpm --filter @ai-ops/database prisma migrate dev --name init

# Repeatable from here on (teammates, CI, fresh clones): applies any
# pending migrations, then the RLS policies/auth trigger in packages/database/sql/.
pnpm db:migrate
pnpm db:seed
pnpm dev
```

App runs at http://localhost:3000. n8n (unused until Phase 2) at
http://localhost:5678.

**Phase 6 note:** report PDF export requires a private Supabase Storage
bucket named `reports` (Supabase dashboard → Storage → New bucket, not
public) and `SUPABASE_SERVICE_ROLE_KEY` set in `.env.local` —
`lib/storage/report-storage.ts` uploads there with the service role,
bypassing per-user RLS-style bucket policies by design (access control
happens at the API layer, not the bucket).

## Structure

See SAD §10 for the authoritative folder-structure rationale. Summary:

- `apps/web` — Next.js 15 App Router application (this phase's main deliverable)
- `packages/database` — Prisma schema + RLS SQL migrations (SAD §4: org/user/notification + Task & Project Core + governance tables)
- `packages/types` — shared TS types across the monorepo
- `packages/config` — shared ESLint/TS/Tailwind config
- `infra/docker` — local Postgres + n8n via Docker Compose
- `prompts/` — versioned agent system prompts (empty until Phase 2 — Email Intelligence)

## Environment configuration

There is a single `.env.local` at the **repo root** (validated at startup by
`apps/web/lib/env.ts` via `instrumentation.ts`). Next.js only auto-loads env
files from its own app directory, and Prisma only auto-loads from
`packages/database`, so local-only scripts (`pnpm dev`, `pnpm db:*`) are
wrapped with `dotenv-cli` pointing at the root file — don't duplicate
`.env.local` into `apps/web/` or `packages/database/`, edit the root one.
`pnpm build`/`pnpm start` are deliberately **not** wrapped: in CI/Vercel, env
vars come from the platform directly, and a dotenv wrapper expecting a
checked-in file would break that.

## What's implemented

**Phase 1 — Foundation & Infrastructure**
- Application shell: collapsible sidebar, top bar with org switcher, notification
  center, user menu (SAD §6.2, §7.9); dark-first theme with light mode toggle

**Phase 2 — Backend Foundation**
- Supabase Auth (Google/Microsoft OAuth + email/password), full multi-tenant
  RLS, RBAC (owner/admin/member/viewer), Prisma + repository pattern,
  `/api/v1` REST routes (cursor pagination, `Idempotency-Key`, optimistic
  concurrency, soft-delete, standardized error envelope), Zod validation,
  Server Actions, immutable audit log, TanStack Query hooks, environment
  validation, seed data

**Phase 3 — Email Intelligence**
- Gmail/Outlook OAuth connect flows, AES-256-GCM encrypted token storage,
  HMAC-signed ingestion webhooks, Classifier Agent (Claude API + Zod-validated
  structured output + schema-repair retry), confidence-threshold routing to
  an approval gate (`POST /agents/:name/approve`), automatic task creation
  from classified email, live Email Dashboard

**Phase 4 — Meeting Intelligence**
- Signed transcript ingestion webhook, Summarizer Agent with map-reduce
  chunking for long transcripts (multi-step `agent_runs` traces via
  `parentRunId`), action-item/decision extraction, automatic task creation
  + `meeting_action_items.linked_task_id` linking, `POST
  /webhooks/n8n/callback` + exported n8n workflow JSON
  (`infra/n8n/workflows/`), generic exponential-backoff retry
  (`lib/api/retry.ts`) wired into the shared Claude client, live Meeting
  Dashboard

**Phase 5 — Operations Health & Risk Module**
- Scheduled risk detection (`GET /api/v1/cron/risk-scan`, Vercel Cron every
  15 min per `vercel.json`) — deterministic, unit-testable severity scoring
  (`lib/risk/severity.ts`) for stale tasks, SLA breaches, and velocity drops,
  idempotent by construction (skips entities with an existing unresolved
  signal), batched Risk Agent call per cycle for rationale/recommended
  action, high-severity notifications, full audit logging
- Live Executive Dashboard (Company Health score, Active Risks, Overdue
  Tasks, SLA Breaches, Project Portfolio, Weekly Trend, Risk Timeline — all
  real repository queries, zero mock data) and Operations Dashboard (live
  risk feed with optimistic-update resolve action via TanStack Query)

**Phase 6 — Reporting Module**
- Report Agent (Claude + Zod-validated structured output) with a
  guaranteed-non-empty template fallback (SAD §9.4) when the LLM call
  fails, trend comparison against the org's most recent completed report,
  full `agent_runs` tracing
- Report generation pipeline: aggregates Task/Project/Meeting/Risk data for
  an arbitrary period → Report Agent → deterministic Markdown rendering →
  branded PDF (`@react-pdf/renderer`, no headless-browser dependency) →
  Supabase Storage → signed-URL download endpoint that always mints a
  fresh link rather than trusting a possibly-expired stored one
- `POST /reports/generate` (API Contract Pattern B: 202 + poll, 5/hour/org
  rate limit) and `GET /api/v1/cron/weekly-report` (Vercel Cron, Fridays)
  share one pipeline (`lib/reports/report-generation-service.ts`) — no
  duplicated generation logic between the manual and scheduled paths
- Live Reports Dashboard: report history, on-demand generation with a
  live-polling status indicator, per-report preview (summary/highlights/
  risks/recommendations), PDF download

**Phases 7–9 — Memory, RAG & the Differentiation Layer**
- pgvector Memory Module, Memory Consolidation workflow, Memory Explorer
- Analytics Dashboard, ROI metrics, Org Map
- AI Chat Workspace (grounded, index-based entity references), Command
  Center (⌘K), Copilot panel, Action Timeline, confidence display

**Phase 10 — Governance, Hardening & Deployment Readiness**
- Audit Log UI over the existing `GET /audit-log` — searchable, resource-
  filterable, cursor-paginated, admin-gated
- Approval Center: a central queue for every agent run parked at
  `awaiting_approval`, with optimistic approve/reject. Adds
  `GET /agents/approvals`; reuses the existing Pattern D approve endpoint
- AI Control Center implemented against SAD §15 (running/queued, p50/p95
  latency, token usage and cost, pending approvals, per-agent success rate,
  retry distribution) — previously an empty-state stub
- RBAC hardening: eight write endpoints were missing the `member+` gate the
  API Contract documents, so `viewer` could create and update records
- Accessibility pass: added the missing `ring` design token and focus rings
  across Button/Input/Textarea/Sheet/user menu, plus keyboard activation for
  `KpiCard`
- Vitest with 92 unit tests covering Test Plan §1
- GitHub Actions CI and `docs/DEPLOYMENT.md`

## What's explicitly out of scope so far

Everything blocking production is infrastructure this repository cannot
reach: the Vercel deploy itself, a Sentry DSN, uptime alerting, load
testing (Test Plan §6), the rollback drill, and the integration/e2e suites
(Test Plan §2/§3), which need a live test database. Each is listed with its
unblocking step in `docs/DEPLOYMENT.md` §10.

The Projects/Kanban UI still renders Phase 1's mock data; heat map and
dependency graph on the Operations Dashboard are designed empty states
pending future work. n8n itself isn't connected in this environment —
Phases 3–6 use direct in-process pipelines that mirror the n8n Workflow
Spec's documented steps exactly, so a real n8n instance can be wired in
later without changing any application logic.
