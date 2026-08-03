AI-Operations-Manager-Implementation-Guide.md


# AI Operations Manager — Implementation Guide
 
Granular execution plan. Expands SAD Section 11's phases into build-order tasks. Each phase: Deliverables, Dependencies, Definition of Done, Test Cases.
 
---
 
## Phase 0 — Repository Setup
**Deliverables**: Monorepo scaffold (SAD §10 folder structure), Turborepo/pnpm workspaces, ESLint/Prettier/TS-strict config in `packages/config`, GitHub Actions CI skeleton (lint+typecheck on PR), Docker Compose for local Postgres+n8n.
**Dependencies**: none.
**Definition of Done**: `pnpm install && pnpm dev` runs a blank Next.js app locally; CI passes on an empty commit; `docker-compose up` starts local n8n reachable at `localhost:5678`.
**Test Cases**: CI fails on introduced lint error (sanity check); Docker Compose services report healthy.
 
## Phase 1 — Authentication & Multi-Tenancy
**Deliverables**: Supabase project provisioned, `organizations`/`users` tables + RLS policies, Google/Microsoft OAuth login, `middleware.ts` session guard, org-switcher UI stub.
**Dependencies**: Phase 0.
**Definition of Done**: A user can sign up, an `organizations` row is created, login redirects to `/app/dashboard` (even if empty); a second test org cannot query the first org's rows via direct API call.
**Test Cases**: RLS cross-tenant test (org B's JWT querying org A's `users` returns empty, not error-leaking); OAuth happy path e2e (Playwright); session expiry redirects to `/login`.
 
## Phase 2 — Database & Prisma
**Deliverables**: Full Prisma schema from SAD §4 migrated (all tables except future-phase additions like `chat_sessions`), seed script with fixture org/users/projects for local dev.
**Dependencies**: Phase 1.
**Definition of Done**: `prisma migrate deploy` runs clean on a fresh DB; seed script populates a demo org fully navigable in Phase 3's shell.
**Test Cases**: Migration is reversible (`prisma migrate reset` succeeds); every FK constraint verified via an intentional bad-insert test (should reject).
 
## Phase 3 — Dashboard Shell
**Deliverables**: App layout (sidebar/topbar per SAD §6.2) using Design System tokens, route stubs for all Section 7 dashboards (empty states only), notification bell UI (no live data yet).
**Dependencies**: Phase 1, Design System doc.
**Definition of Done**: All nav items route correctly; responsive collapse works at `lg` breakpoint; empty states render per Design System §6.
**Test Cases**: Playwright nav smoke test across all routes; Lighthouse a11y score ≥90 on shell.
 
## Phase 4 — Task & Project Core
**Deliverables**: `/api/v1/tasks`, `/api/v1/projects`, `/api/v1/boards` CRUD, `KanbanBoard` component wired to real data with drag-drop + optimistic updates, Project Dashboard populated.
**Dependencies**: Phase 2, 3.
**Definition of Done**: A user creates a project, board, and task through the UI and it persists correctly with `task_activity` logged.
**Test Cases**: API integration tests per endpoint (SAD §5); drag-drop reorder persists on refresh; concurrent edit conflict test (two tabs, optimistic concurrency via `updated_at`).
 
## Phase 5 — Email Intelligence
**Deliverables**: Gmail/Graph OAuth connect flow, ingestion webhook, Classifier Agent (n8n workflow + `prompts/classifier.md`), email→task pipeline, Email Dashboard.
**Dependencies**: Phase 4 (tasks must exist), Prompt Library doc.
**Definition of Done**: A test email with clear task intent produces a task within 60s, correctly tagged `source=email`.
**Test Cases**: Classifier eval set ≥90% accuracy (Test Plan §4); retry-on-API-failure test; low-confidence email produces suggestion not auto-task.
 
## Phase 6 — Meeting Intelligence
**Deliverables**: Transcript ingest webhook, Summarizer Agent (+`prompts/summarizer.md`), action-item→task linking, Meeting Dashboard.
**Dependencies**: Phase 5 (shares agent/workflow infra pattern).
**Definition of Done**: Sample transcript produces correctly-owned tasks linked to the meeting record.
**Test Cases**: Long-transcript chunking test (>100k tokens); partial-chunk-failure retry test.
 
## Phase 7 — Risk & Operations
**Deliverables**: Scheduled Risk Detection workflow, Risk Agent (+`prompts/risk.md`), Operations Dashboard, Executive Dashboard health score.
**Dependencies**: Phases 4–6 (needs task/email/meeting history as signal).
**Definition of Done**: Synthetic stale-task scenario surfaces a correctly-severity-scored risk signal within one scheduled cycle.
**Test Cases**: Staleness threshold boundary test; SLA breach detection test; velocity-drop synthetic dataset test.
 
## Phase 8 — Reporting & Memory
**Deliverables**: pgvector memory module, Memory Consolidation workflow, Report Agent (+`prompts/report.md`), Reports Dashboard, PDF export.
**Dependencies**: Phases 4–7 (reports aggregate everything).
**Definition of Done**: Weekly report generates automatically; on forced agent failure, falls back to template report (never blank).
**Test Cases**: Report Agent failure → fallback path test; memory retrieval relevance spot-check (Test Plan §4).
 
## Phase 9 — Analytics & Differentiation Layer
**Deliverables**: Analytics Dashboard, AI Chat Workspace, Command Center (⌘K), Copilot panel, Confidence display, Action Timeline, Memory Explorer, Org Map, ROI metrics, dark theme finalized.
**Dependencies**: Phases 4–8 (this is a layer over the completed core).
**Definition of Done**: Chat Workspace answers a grounded question citing real records; ⌘K executes the 7 example commands (PRD-adjacent, SAD §13.2) end-to-end.
**Test Cases**: Chat grounding eval (no hallucinated entity references); command palette keyboard-only e2e; confidence threshold routes correctly to approval gate.
 
## Phase 10 — Governance, Hardening & Production Deployment
**Deliverables**: Audit Log UI, agent approval flows, AI Control Center, RBAC refinement, full a11y pass, load testing, Vercel production deploy + GitHub Actions CD, monitoring/alerting wired (Sentry, uptime).
**Dependencies**: all prior phases functionally complete.
**Definition of Done**: Every AI-mutating action visible in audit log; production deploy passes smoke test; load test meets latency targets under expected concurrency.
**Test Cases**: Full regression suite (Test Plan); webhook ingestion load test; multi-tenant isolation re-verified at scale; rollback drill (deploy → detect issue → rollback within SLA).
 
---
 
*End of Implementation Guide.*
 
