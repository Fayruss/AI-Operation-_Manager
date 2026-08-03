AI-Operations-Manager-SAD.md


# AI Operations Manager — Software Architecture Document (SAD)
 
**Version 1.0 · Prepared for Senior Engineering Team**
 
---
 
## Section 1 — Product Vision
 
### What it is
AI Operations Manager (AIOM) is an **AI-native operations layer** that sits across a company's email, project management, and meetings, and behaves like a tireless operations employee: it reads inbound signal (emails, meeting transcripts, task updates), decides what matters, and takes structured action (creates tasks, updates boards, escalates risk, writes reports) — always leaving an auditable trail and asking for human approval on high-stakes actions.
 
It is **not** a chatbot bolted onto a dashboard. It is an event-driven system where AI agents are workers with defined responsibilities, memory, and retry semantics, and the UI is a control tower for supervising them.
 
### Who uses it
| User | Primary Need |
|---|---|
| Founder / Exec (startup, agency) | One glance at company health, no manual status-chasing |
| Ops / PM lead | Automatic task creation from email/meetings, risk visibility |
| Team member (IC) | Fewer manual updates; tasks show up where they already work |
| Agency account manager | Client email triage, SLA/urgency detection |
| IT/Admin | Governance: who/what the AI can touch, audit log, permissions |
 
### Why companies need it
Mid-sized orgs (20–500 people) drown in **coordination overhead**: status meetings, "did anyone see this email," manually re-typing action items into Jira/Linear, and execs finding out about risk too late. Point tools (Linear, Slack, email) each do one job well but none of them *connect the dots* or *act* on the connections. AIOM's differentiator is closing the loop: **signal → understanding → action → memory**, not just another dashboard.
 
### How AI improves operations
- **Classification & triage at scale**: every email/meeting gets urgency + intent classification in seconds, not hours.
- **Action, not just insight**: agents create/update tasks and boards directly rather than surfacing a suggestion nobody applies.
- **Institutional memory**: a vector-backed memory store means the system gets smarter about a specific company's vendors, clients, and recurring issues over time — something static workflow tools cannot do.
- **Risk detection before humans notice**: pattern + LLM-based anomaly detection on project velocity, email sentiment, and deadline slippage.
**Architectural stance:** AI is a *reasoning and classification layer* over deterministic business logic — never the system of record. Postgres is truth; the LLM proposes, the workflow engine and human approval gates decide.
 
---
 
## Section 2 — Feature Breakdown (Modules)
 
### 2.1 Email Intelligence Module
- **Purpose**: Ingest, classify, and route email into operational signal.
- **Responsibilities**: IMAP/Graph ingestion, urgency scoring, intent classification (task/FYI/question/complaint), thread linking, auto-draft replies (human-approved).
- **Inputs**: Email webhook payloads (Gmail Pub/Sub, MS Graph subscriptions).
- **Outputs**: `email_messages` rows, `tasks` (when actionable), `notifications`.
- **Dependencies**: AI Layer (Classifier Agent), Auth (OAuth mail scopes), Workflow Layer.
### 2.2 Task & Project Module
- **Purpose**: System of record for work items and boards.
- **Responsibilities**: CRUD tasks/boards/sprints, dependency tracking, assignment logic, status transitions.
- **Inputs**: Manual UI actions, Email module, Meeting module, n8n webhooks.
- **Outputs**: `tasks`, `task_activity`, board state for Kanban/Gantt views.
- **Dependencies**: Postgres/Prisma, Notification module.
### 2.3 Meeting Intelligence Module
- **Purpose**: Turn meeting transcripts/recordings into structured action.
- **Responsibilities**: Transcript ingestion, summarization, action-item extraction, decision logging.
- **Inputs**: Transcript text/audio-to-text webhook (Zoom/Meet/Otter-style integration).
- **Outputs**: `meetings`, `meeting_action_items` → auto-linked `tasks`.
- **Dependencies**: AI Layer (Summarizer Agent), Task Module.
### 2.4 Operations Health & Risk Module
- **Purpose**: Continuously score project/org health and flag risk.
- **Responsibilities**: Velocity tracking, SLA breach detection, sentiment trend, staleness detection (tasks untouched N days).
- **Inputs**: Task Module events, Email sentiment, Meeting cadence.
- **Outputs**: `risk_signals`, dashboard KPIs, escalation notifications.
- **Dependencies**: AI Layer (Risk Agent), scheduled n8n jobs.
### 2.5 Reporting Module
- **Purpose**: Generate executive-ready summaries on demand/schedule.
- **Responsibilities**: Aggregate cross-module data, LLM narrative generation, export (PDF/Slack/email).
- **Inputs**: All modules (read-only aggregation).
- **Outputs**: `reports`, downloadable PDFs, scheduled digests.
- **Dependencies**: AI Layer (Report Agent), pdf generation service.
### 2.6 Memory Module
- **Purpose**: Long-term organizational knowledge (people, vendors, decisions, recurring issues).
- **Responsibilities**: Embedding generation, semantic retrieval (RAG), memory decay/consolidation.
- **Inputs**: All modules write memory candidates; agents read via retrieval.
- **Outputs**: `memory_entries` (pgvector), retrieval context injected into agent prompts.
- **Dependencies**: pgvector, Claude API (embeddings via a dedicated embedding call or Voyage-style embedding model).
### 2.7 Agent Orchestration Module
- **Purpose**: Coordinate specialized AI agents, manage retries/handoffs.
- **Responsibilities**: Task queueing, agent-to-agent messaging, cost/rate governance, human-in-the-loop approval gates.
- **Inputs**: Events from all modules.
- **Outputs**: Agent invocation logs, approval requests.
- **Dependencies**: n8n (orchestration substrate), Claude API.
### 2.8 Identity, Auth & Governance Module
- **Purpose**: Multi-tenant auth, RBAC, audit.
- **Responsibilities**: SSO/OAuth, role/permission enforcement, immutable audit log, data-scoping per org.
- **Inputs**: Supabase Auth events.
- **Outputs**: `users`, `roles`, `audit_log`.
- **Dependencies**: Supabase Auth, Postgres RLS.
### 2.9 Notification Module
- **Purpose**: Real-time and digest notifications across channels.
- **Responsibilities**: In-app real-time (Supabase Realtime), email digests, Slack webhook out.
- **Inputs**: Events from all modules.
- **Outputs**: `notifications`, delivery receipts.
- **Dependencies**: Supabase Realtime, n8n.
---
 
## Section 3 — System Architecture
 
### 3.1 High-Level Diagram
 
```
                                   ┌────────────────────────────┐
                                   │        Vercel Edge         │
                                   │   Next.js 15 (App Router)  │
                                   │  React 19 · TS · Tailwind  │
                                   └──────────────┬─────────────┘
                                                   │ HTTPS / REST + Realtime WS
                     ┌─────────────────────────────┼─────────────────────────────┐
                     │                              │                             │
         ┌───────────▼───────────┐     ┌───────────▼───────────┐     ┌───────────▼───────────┐
         │  Next.js API Routes   │     │   Supabase Auth (SSO)  │     │  Supabase Realtime     │
         │  (BFF layer, Zod val) │     │   JWT / RLS policies   │     │  (live board/notify)   │
         └───────────┬───────────┘     └───────────┬───────────┘     └────────────────────────┘
                     │                              │
      ┌──────────────┼──────────────────────────────┘
      │              │
┌─────▼─────┐  ┌─────▼──────────────┐        ┌────────────────────────┐
│  Prisma   │  │   n8n Workflow      │──────▶ │   Claude API (Agents)   │
│  ORM      │  │   Engine (self-host │◀───────│  Classifier/Summarizer/ │
│           │  │   on Docker)        │        │  Risk/Report/Reply Agent│
└─────┬─────┘  └─────┬──────────────┘        └────────────┬────────────┘
      │              │  Webhooks out to:                    │ embeddings
┌─────▼──────────────▼───┐  Gmail/Graph, Slack, Zoom API     │
│  Supabase Postgres 15   │◀──────────────────────────────────┘
│  + pgvector extension   │
│  (multi-tenant, RLS)    │
└──────────────────────────┘
 
External Integrations: Gmail API / Microsoft Graph · Slack · Zoom/Google Meet transcripts · Calendar APIs
Infra: Docker (n8n + workers) · GitHub Actions (CI/CD) · Vercel (frontend+API) · Supabase Cloud (DB/Auth/Realtime)
```
 
### 3.2 Why this topology
- **Next.js API Routes as a thin BFF, not the business-logic owner**: business logic that must be reliable (task state transitions, risk scoring) lives in **n8n workflows + Postgres functions**, not in serverless API routes, because Vercel functions are stateless/timeout-bound (10–60s) and unsuitable for multi-step agent orchestration with retries. API routes validate, authorize, and delegate.
- **n8n as the orchestration substrate**: rather than hand-rolling a job queue, n8n gives visual, debuggable workflows with built-in retry/error branches — critical for a system whose credibility depends on *not silently dropping* an email or task. It's self-hosted via Docker so we control execution time limits and secrets.
- **Supabase over vanilla Postgres+Auth0**: bundles Postgres, Row-Level-Security-based multi-tenancy, Auth, and Realtime in one platform, cutting integration surface for a v1 team. RLS is the mechanism enforcing tenant isolation at the DB layer — not just app-layer checks — which matters a lot when an AI agent has write access.
- **pgvector co-located with operational data**: memory retrieval needs to join against `tasks`/`emails` metadata; keeping vectors in the same Postgres instance (vs. a separate vector DB) avoids a second source of truth and simplifies RLS-scoped retrieval (a memory query is just a SQL query with tenant filters).
- **Claude API called only from n8n/server contexts, never client-side**: keeps API keys server-side and lets every agent call pass through the orchestration layer for logging/retry/cost governance.
---
 
## Section 4 — Database Design
 
All tables are tenant-scoped via `org_id` with RLS policies `org_id = auth.jwt() -> 'org_id'`.
 
### 4.1 Core Entities
 
```sql
-- ORGANIZATIONS & USERS
organizations (id uuid PK, name text, plan enum('free','pro','enterprise'), created_at timestamptz)
 
users (id uuid PK, org_id uuid FK->organizations, email text UNIQUE, name text,
       role enum('owner','admin','member','viewer'), avatar_url text, created_at timestamptz)
  INDEX idx_users_org (org_id)
 
-- EMAIL
email_accounts (id uuid PK, org_id uuid FK, user_id uuid FK->users, provider enum('gmail','outlook'),
                 oauth_token_encrypted text, sync_cursor text, created_at timestamptz)
 
email_messages (id uuid PK, org_id uuid FK, account_id uuid FK->email_accounts,
                 thread_id text, sender text, subject text, body_snippet text,
                 urgency enum('low','medium','high','critical'),
                 intent enum('task','question','fyi','complaint','other'),
                 status enum('unprocessed','processed','archived'),
                 received_at timestamptz, created_at timestamptz)
  INDEX idx_email_org_status (org_id, status)
  INDEX idx_email_thread (thread_id)
 
-- TASKS / PROJECTS
projects (id uuid PK, org_id uuid FK, name text, status enum('active','on_hold','completed','archived'),
          health enum('on_track','at_risk','critical'), start_date date, target_date date, created_at timestamptz)
 
boards (id uuid PK, org_id uuid FK, project_id uuid FK->projects, name text, type enum('kanban','sprint'))
 
tasks (id uuid PK, org_id uuid FK, board_id uuid FK->boards, title text, description text,
       status enum('backlog','todo','in_progress','in_review','done','blocked'),
       priority enum('low','medium','high','urgent'),
       assignee_id uuid FK->users, source enum('manual','email','meeting','ai_risk'),
       source_ref_id uuid NULL, due_date timestamptz, created_at timestamptz, updated_at timestamptz)
  INDEX idx_tasks_board_status (board_id, status)
  INDEX idx_tasks_assignee (assignee_id)
 
task_dependencies (task_id uuid FK->tasks, depends_on_task_id uuid FK->tasks, PK(task_id, depends_on_task_id))
 
task_activity (id uuid PK, task_id uuid FK->tasks, actor_id uuid NULL, actor_type enum('user','ai_agent'),
                action text, diff jsonb, created_at timestamptz)
  INDEX idx_task_activity_task (task_id)
 
-- MEETINGS
meetings (id uuid PK, org_id uuid FK, title text, transcript text, summary text,
          occurred_at timestamptz, created_at timestamptz)
 
meeting_action_items (id uuid PK, meeting_id uuid FK->meetings, description text,
                       linked_task_id uuid NULL FK->tasks, owner_id uuid NULL FK->users)
 
-- RISK & OPS HEALTH
risk_signals (id uuid PK, org_id uuid FK, entity_type enum('project','task','account'),
              entity_id uuid, signal_type enum('sla_breach','stale_task','velocity_drop','sentiment_negative'),
              severity enum('low','medium','high'), detail jsonb, resolved boolean DEFAULT false,
              created_at timestamptz)
  INDEX idx_risk_org_resolved (org_id, resolved)
 
-- REPORTS
reports (id uuid PK, org_id uuid FK, type enum('weekly_exec','project_status','custom'),
         content jsonb, generated_by enum('scheduled','manual'), created_at timestamptz)
 
-- MEMORY (pgvector)
memory_entries (id uuid PK, org_id uuid FK, entity_type text, entity_id uuid NULL,
                 content text, embedding vector(1536), importance real DEFAULT 0.5,
                 created_at timestamptz)
  INDEX idx_memory_embedding USING ivfflat (embedding vector_cosine_ops)
  INDEX idx_memory_org (org_id)
 
-- NOTIFICATIONS
notifications (id uuid PK, org_id uuid FK, user_id uuid FK->users, type text, payload jsonb,
                read boolean DEFAULT false, created_at timestamptz)
  INDEX idx_notif_user_read (user_id, read)
 
-- AUDIT (immutable, append-only)
audit_log (id uuid PK, org_id uuid FK, actor_id uuid NULL, actor_type enum('user','ai_agent','system'),
           action text, resource_type text, resource_id uuid, metadata jsonb, created_at timestamptz)
  INDEX idx_audit_org_created (org_id, created_at)
 
-- AGENT ORCHESTRATION
agent_runs (id uuid PK, org_id uuid FK, agent_name text, trigger_source text,
            input jsonb, output jsonb, status enum('queued','running','success','failed','awaiting_approval'),
            retry_count int DEFAULT 0, error text, started_at timestamptz, completed_at timestamptz)
  INDEX idx_agent_runs_org_status (org_id, status)
```
 
**Design rationale**: `source`/`source_ref_id` on `tasks` traces every AI-created task back to its origin email/meeting — required for trust and for undo. `task_activity` and `audit_log` are separate: activity is product-facing history (shown in UI), audit_log is compliance-grade and covers *every* mutating action including AI agent writes, never editable. `agent_runs` gives per-invocation observability, essential for debugging non-deterministic LLM behavior and for enforcing retry limits.
 
---
 
## Section 5 — API Design
 
All endpoints under `/api/v1`, authenticated via Supabase JWT (Bearer), org-scoped by RLS. Standard error envelope:
```json
{ "error": { "code": "string", "message": "string", "details": {} } }
```
 
| Method | Endpoint | Purpose | Auth | Notes |
|---|---|---|---|---|
| GET | `/emails` | List classified emails, filter by urgency/status | member+ | paginated cursor-based |
| POST | `/emails/:id/convert-to-task` | Manually promote email to task | member+ | writes `task_activity` + `audit_log` |
| GET | `/tasks` | List tasks, filter by board/assignee/status | member+ | supports `?view=kanban\|list` |
| POST | `/tasks` | Create task | member+ | Zod-validated body |
| PATCH | `/tasks/:id` | Update task (status/assignee/etc.) | member+ | optimistic concurrency via `updated_at` |
| DELETE | `/tasks/:id` | Soft-delete task | admin+ | never hard-deletes |
| GET | `/projects/:id/health` | Aggregated health score + risk signals | member+ | computed, cached 5 min |
| POST | `/meetings/ingest` | Webhook: receive transcript | system (HMAC) | triggers Summarizer Agent |
| GET | `/meetings/:id` | Meeting summary + action items | member+ | |
| GET | `/risk-signals` | Active risk signals, filterable | member+ | |
| POST | `/risk-signals/:id/resolve` | Mark resolved | admin+ | |
| POST | `/reports/generate` | On-demand report generation | admin+ | async, returns `report_id`, poll status |
| GET | `/reports/:id` | Fetch report (or PDF export link) | admin+ | |
| GET | `/notifications` | List, mark read | member+ | |
| GET | `/audit-log` | Query audit trail | owner/admin | filterable by actor/resource |
| POST | `/agents/:name/approve` | Approve a pending agent action | admin+ | for high-stakes AI actions |
| POST | `/webhooks/gmail` | Inbound mail push notification | system (signed) | enqueues to n8n |
| POST | `/webhooks/n8n/callback` | n8n workflow result callback | system (HMAC) | writes `agent_runs` |
 
**Error handling standard**: 4xx = client/validation (Zod errors surfaced as `details`), 401/403 = auth/authorization split explicitly (403 always means "authenticated but not permitted," never used to mask 404 for security — we use 404 for cross-tenant resource access to avoid leaking existence), 5xx = logged to Sentry with `agent_run_id` correlation when applicable, 429 for rate limits with `Retry-After`.
 
---
 
## Section 6 — Frontend Architecture
 
### 6.1 Page Map (App Router)
```
/                          → marketing/landing (public)
/login, /signup            → auth flow
/app/dashboard             → Executive Dashboard (default post-login)
/app/emails                → Email Dashboard
/app/projects              → Project list
/app/projects/[id]         → Project Dashboard (kanban/gantt/health)
/app/meetings               → Meeting Dashboard
/app/meetings/[id]         → Meeting detail (summary/action items)
/app/operations             → Operations/Risk Dashboard
/app/reports                → Reports Dashboard
/app/analytics              → Analytics Dashboard
/app/settings/*             → org, users, integrations, billing
```
 
### 6.2 Layout & Navigation
Root `/app` layout: persistent left sidebar (module nav) + top bar (org switcher, search, notification bell with Realtime badge) + main content slot. Sidebar collapses to icon-rail below `lg` breakpoint; mobile uses a bottom sheet nav.
 
### 6.3 Component Strategy
- `components/ui/*` — shadcn primitives (unmodified, themeable via CSS vars).
- `components/shared/*` — cross-module composites (KpiCard, DataTable, StatusBadge, RiskPill).
- `components/[module]/*` — module-owned (e.g. `components/tasks/KanbanBoard.tsx`).
- Composition over configuration: dashboards assemble from `KpiCard`+chart primitives rather than one monolithic `Dashboard` component per page.
### 6.4 Global State
- **Server state**: TanStack Query (React Query) for all API data — handles caching, revalidation, optimistic updates for task drag-drop.
- **Realtime state**: Supabase Realtime subscriptions feed directly into Query cache invalidation (no separate realtime store) to avoid two sources of truth.
- **UI/local state**: Zustand for cross-component UI state (sidebar collapsed, active filters) — deliberately not Redux; this app doesn't need time-travel debugging or middleware complexity.
- **Auth state**: Supabase client session via React Context, hydrated server-side in root layout to avoid auth flash.
### 6.5 Auth Flow
Supabase Auth (SSO: Google/Microsoft OAuth + email/password) → JWT stored in httpOnly cookie via `@supabase/ssr` → middleware.ts checks session on every `/app/*` route, redirects to `/login` if absent → org context resolved from JWT claim, injected into all queries.
 
### 6.6 Loading / Error States
- Route-level `loading.tsx` with skeleton components matching final layout shape (no generic spinners for data-heavy views).
- `error.tsx` boundaries per route segment with retry action; agent-triggered errors (e.g., failed classification) surface as inline banners, not full-page errors.
- Empty states are designed, not blank ("No risk signals — you're on track" with icon), to avoid the dashboard reading as broken.
### 6.7 Responsive Behavior
Desktop-first (this is a work tool used primarily on laptops), but all dashboards degrade to single-column stacked cards below `md`; Kanban becomes swipeable single-column-per-status on mobile; charts switch to simplified sparklines on narrow viewports rather than being cropped.
 
---
 
## Section 7 — Dashboard Design
 
### 7.1 Executive Dashboard
**Purpose**: One-screen company health for founders/execs.
| Widget | Type | Why |
|---|---|---|
| Company Health Score | Progress Ring | Single glanceable number rolling up project health, risk count, SLA compliance |
| Revenue-impacting risk | KPI Cards (Active Risks, Overdue Tasks, SLA breaches) | Surfaces what needs attention *now* |
| Project Portfolio | Horizontal bar (health by project) | Compare projects at a glance, spot the outlier |
| Activity Timeline | Timeline view | Recent AI actions + human decisions in one feed, builds trust in automation |
| Weekly Trend | Line Chart (tasks completed vs created) | Shows if the org is gaining or losing ground on throughput |
 
### 7.2 Project Dashboard
Kanban Board (primary work surface, drag-drop status), Gantt/Timeline view (dependencies via React Flow — dependency graph), Burndown Area Chart (scope vs time, shows if a project is trending late), Team workload Bar Chart (tasks per assignee, spot overload before it causes risk).
 
### 7.3 Email Dashboard
Inbox-style list grouped by urgency (Critical/High/Medium/Low as colored sections), Donut Chart of intent distribution (task/question/fyi/complaint) — shows what kind of noise is coming in, Response-time Line Chart — SLA trend over time.
 
### 7.4 Operations Dashboard
Heat Map (day × team, task completion density) — spots systemic slow days/teams, Risk Signal feed (severity-sorted list), Dependency Graph (React Flow) — visualizes cross-project blocking chains that are invisible in a flat task list.
 
### 7.5 Meeting Dashboard
Calendar view of meetings, Action-item conversion rate KPI (meetings → tasks created), Meeting list with AI summary preview.
 
### 7.6 Reports Dashboard
Report history table, scheduled report config, PDF preview/export, on-demand "Generate Report" with agent status (Live Workflow Status indicator while the Report Agent runs).
 
### 7.7 Analytics Dashboard
Cross-cutting Line/Area Charts (velocity over time, AI-action volume, cost of AI usage), Org Chart (React Flow) for team structure vs. workload correlation.
 
### 7.8 Settings
Org profile, Users & Roles (RBAC table), Integrations (Gmail/Outlook/Slack/Zoom connect flows), AI Agent controls (per-agent enable/disable, approval-required toggle), Audit Log viewer, Billing.
 
### 7.9 Real-time elements (cross-dashboard)
Notification bell (Supabase Realtime), Live Workflow Status chip on any record currently being processed by an agent (e.g., "Classifying…", "Drafting summary…") so users never wonder if the AI silently failed.
 
---
 
## Section 8 — Workflow Architecture (n8n)
 
### 8.1 Email Processing Workflow
**Trigger**: Gmail/Graph push webhook → `/api/webhooks/gmail` → enqueue n8n workflow.
**Steps**: (1) Fetch full message → (2) Classifier Agent call (urgency + intent) → (3) Decision: if intent=`task` and confidence>0.75 → create task automatically (`source=email`), else → create `notifications` "review suggested task" → (4) Write `email_messages` row + `audit_log`.
**Retry**: Claude API call retried 3x exponential backoff; on final failure, email marked `status=unprocessed` and flagged for manual review — **never silently dropped**.
 
### 8.2 Task Creation Workflow
**Trigger**: Internal event (from Email/Meeting workflows) or manual API call.
**Steps**: Validate assignee exists → apply project default board → write task → emit Realtime event → notify assignee.
 
### 8.3 Meeting Processing Workflow
**Trigger**: Transcript webhook (`/meetings/ingest`).
**Steps**: Summarizer Agent extracts summary + action items → each action item → Task Creation sub-workflow (linked via `meeting_action_items.linked_task_id`) → summary saved → notify meeting owner.
 
### 8.4 Risk Detection Workflow (scheduled, every 15 min)
**Steps**: Query stale tasks (no update > threshold), SLA breach candidates, velocity drop (rolling 7-day completion rate vs. prior period) → Risk Agent scores severity → write `risk_signals` → if severity=high, immediate notification to project owner; else batched into daily digest.
 
### 8.5 Reporting Workflow
**Trigger**: Schedule (weekly) or manual `/reports/generate`.
**Steps**: Aggregate module data for period → Report Agent generates narrative → render to PDF → store, notify subscribers.
 
### 8.6 Memory Consolidation Workflow (nightly)
**Steps**: Pull high-signal events (resolved risks, completed projects, meeting decisions) → generate embeddings → upsert `memory_entries` → decay `importance` on stale entries to bound retrieval noise.
 
### 8.7 Agent Communication Pattern
Agents do not call each other directly. All inter-agent "communication" is mediated by n8n: Agent A writes a structured output → n8n workflow branches on it → invokes Agent B with that output as input context, plus relevant `memory_entries` retrieved via similarity search. This keeps every hop **logged, retryable, and debuggable** rather than opaque agent-to-agent chains.
 
---
 
## Section 9 — AI Architecture (Agents)
 
All agents call Claude via server-side n8n HTTP nodes. Shared conventions: structured JSON output (enforced via system prompt + schema validation on response), every call logged to `agent_runs`, temperature low (0–0.3) for classification/extraction agents, moderate (0.5) for narrative generation.
 
### 9.1 Classifier Agent
- **Purpose**: Urgency + intent classification for inbound email.
- **Input**: email subject/body, sender history (from memory).
- **Output**: `{urgency, intent, confidence, suggested_task: {title, priority} | null}`.
- **Memory**: reads recent memory entries for the sender (past complaints, VIP status).
- **Prompt strategy**: few-shot with org-specific examples pulled from `task_activity` corrections (agent learns from human overrides over time).
- **Retry**: 3x on API error; on schema-validation failure, one repair attempt with the error appended to the prompt, then fallback to `status=unprocessed`.
### 9.2 Summarizer Agent (Meetings)
- **Purpose**: Transcript → summary + discrete action items with suggested owners.
- **Input**: full transcript, participant list.
- **Output**: `{summary, action_items: [{description, suggested_owner, due_hint}], decisions: []}`.
- **Memory**: reads prior meetings for the same project to maintain continuity ("as discussed last week…").
- **Retry**: chunked map-reduce for transcripts >100k tokens; partial failure retries only the failed chunk.
### 9.3 Risk Agent
- **Purpose**: Score severity of detected anomalies (stale tasks, SLA breach, velocity drop, sentiment).
- **Input**: aggregated project metrics + relevant memory (past incidents on this project).
- **Output**: `{severity, rationale, recommended_action}`.
- **Prompt strategy**: chain-of-thought suppressed in output (reasoning kept server-side only, final structured verdict returned) to keep this auditable and concise.
- **Retry**: idempotent — safe to re-run; failures simply skip that cycle's signal (next 15-min run recovers).
### 9.4 Report Agent
- **Purpose**: Turn aggregated metrics into an executive narrative.
- **Input**: period metrics, top risks, completed milestones, memory of prior report (avoid repetitive phrasing, show trend deltas).
- **Output**: structured sections (Highlights, Risks, Recommendations) in markdown, rendered to PDF downstream.
- **Retry**: single retry; on failure falls back to a template-based (non-LLM) metrics report so exec reporting never silently fails to appear.
### 9.5 Reply-Draft Agent (human-approved)
- **Purpose**: Draft suggested email replies for high-urgency threads.
- **Output**: draft text — **never sent automatically**; always requires human approval via `/agents/reply-draft/approve`.
- **Memory**: org tone/voice examples from previously approved drafts (few-shot).
**Cross-cutting governance**: any agent whose action is irreversible or externally visible (sending email, notifying a client) requires `agent_runs.status=awaiting_approval` and a human approval step — codified once in Section 8.7's orchestration pattern, not re-implemented per agent.
 
---
 
## Section 10 — Folder Structure
 
```
ai-ops-manager/
├── apps/
│   └── web/                        # Next.js 15 app
│       ├── app/
│       │   ├── (marketing)/        # public routes
│       │   ├── (auth)/             # login/signup
│       │   ├── app/                # authenticated app shell
│       │   │   ├── dashboard/
│       │   │   ├── emails/
│       │   │   ├── projects/[id]/
│       │   │   ├── meetings/
│       │   │   ├── operations/
│       │   │   ├── reports/
│       │   │   ├── analytics/
│       │   │   └── settings/
│       │   └── api/v1/             # API routes (BFF)
│       ├── components/
│       │   ├── ui/                 # shadcn primitives
│       │   ├── shared/             # KpiCard, DataTable, etc.
│       │   └── [module]/           # module-owned components
│       ├── lib/
│       │   ├── supabase/           # client/server helpers
│       │   ├── validation/         # Zod schemas (shared client+server)
│       │   ├── query/              # React Query hooks per module
│       │   └── utils/
│       ├── stores/                 # Zustand stores
│       └── middleware.ts
├── packages/
│   ├── database/                   # Prisma schema + migrations
│   ├── types/                      # shared TS types (generated from Prisma + Zod)
│   └── config/                     # eslint/tsconfig/tailwind shared config
├── infra/
│   ├── n8n/
│   │   └── workflows/              # exported workflow JSON, version-controlled
│   ├── docker/
│   │   ├── docker-compose.yml      # n8n + local postgres for dev
│   │   └── Dockerfile.n8n
│   └── github-actions/
│       ├── ci.yml                  # lint/typecheck/test
│       └── deploy.yml              # Vercel deploy + Prisma migrate
├── prompts/                        # versioned agent system prompts (reviewed like code)
│   ├── classifier.md
│   ├── summarizer.md
│   ├── risk.md
│   └── report.md
└── docs/
    └── architecture/                # this document + ADRs
```
 
**Rationale**: `prompts/` is version-controlled and code-reviewed separately from application code — prompt changes are a deploy-worthy event and need the same rigor as schema migrations, since they change agent behavior in production. Each file under `prompts/` (`classifier.md`, `summarizer.md`, `risk.md`, `reporter.md`, `reply_draft.md`, `planner.md`) is loaded at n8n workflow runtime by agent name (Section 9's stable identifiers), never inlined in a workflow node — this is what makes Section 16's correction-driven few-shot updates possible without a code deploy: examples are appended to the loaded prompt file, not hardcoded in the orchestration logic. `infra/n8n/workflows` stores exported JSON so workflow changes are diffable in PRs, not silently edited in the n8n UI.
 
---
 
## Section 11 — Development Roadmap
 
### Phase 0.5 — Design System & Product Specification (1–2 weeks, Medium, precedes all coding)
**Objective**: Produce a complete UI/UX blueprint so implementation is assembly, not improvisation.
- **Deliverables**: Wireframes for every screen in Section 6.1/7; user flows (onboarding, email→task, approval flow); navigation map; component inventory (extends Section 6.3 with states — default/hover/loading/error/disabled for each); color palette + dark enterprise theme tokens (see Section 13.10); typography scale; 8px spacing system; icon set (Lucide, consistent sizing); per-chart spec (which of Section 7's chart types, axes, empty/loading states); animation/motion guidelines (Framer Motion easing/duration standards); responsive breakpoint behavior per screen.
- **Dependencies**: none — this precedes Phase 0.
- **Testing**: design review against shadcn/ui conventions and WCAG AA contrast checks on the palette before any component is built.
- **Acceptance**: every screen in Sections 6–7 and the new Section 13 surfaces has an approved wireframe and token set; no engineer should need to invent a color, spacing value, or chart type during Phases 0–6.
- **Why this belongs before Phase 0**: for a small/solo-plus-AI team, the highest-leverage cost cut isn't writing less code, it's eliminating the back-and-forth of "what should this look like" mid-implementation. A locked design system turns every later phase into implementation against spec.
### Phase 0 — Foundations (2 weeks, Low-Medium complexity)
- **Objectives**: Auth, multi-tenant DB schema, base layout shell.
- **Deliverables**: Supabase project + RLS policies, Prisma schema migrated, login/signup, empty dashboard shell.
- **Dependencies**: none.
- **Testing**: RLS policy tests (cross-tenant access must fail), auth flow e2e.
- **Acceptance**: A second org's data is provably inaccessible to org A's users.
### Phase 1 — Task & Project Core (2–3 weeks, Medium)
- **Deliverables**: Task/board CRUD API, Kanban UI with drag-drop, project dashboard v1.
- **Dependencies**: Phase 0.
- **Testing**: API integration tests, optimistic-update conflict tests.
- **Acceptance**: A user can create a project, board, and tasks, and reorder via drag-drop with correct persistence.
### Phase 2 — Email Intelligence (3 weeks, High)
- **Deliverables**: OAuth mail connect, ingestion webhook, Classifier Agent, email → task pipeline.
- **Dependencies**: Phase 1 (tasks must exist to be created from email).
- **Testing**: Classifier accuracy eval set (min. 100 labeled emails), retry/failure-path tests.
- **Acceptance**: 90%+ of test-set emails correctly classified for urgency; failed classifications never silently lost.
### Phase 3 — Meetings & Notifications (2 weeks, Medium)
- **Deliverables**: Meeting ingest, Summarizer Agent, action-item→task linking, Realtime notifications.
- **Dependencies**: Phase 2 (shares agent infra patterns).
- **Testing**: transcript-chunking tests for long meetings.
- **Acceptance**: A sample transcript produces correctly-owned tasks within 2 minutes.
### Phase 4 — Risk & Operations Dashboard (2–3 weeks, High)
- **Deliverables**: Scheduled risk detection workflow, Risk Agent, Operations Dashboard, heat map/dependency graph.
- **Dependencies**: Phases 1–3 (needs task + email history as signal).
- **Testing**: synthetic stale-project scenario must surface correct risk signal within one cycle.
- **Acceptance**: Exec can see an at-risk project flagged before it's overdue.
### Phase 5 — Reporting & Memory (2 weeks, Medium)
- **Deliverables**: Memory module (pgvector), Report Agent, PDF export, scheduled digests.
- **Dependencies**: All prior phases (reports aggregate everything).
- **Testing**: report generation fallback path (LLM failure → template report) explicitly tested.
- **Acceptance**: Weekly report generates automatically and is never blank even on agent failure.
### Phase 6 — Governance, Polish, Hardening (2 weeks, Medium)
- **Deliverables**: Audit log UI, agent approval flows, RBAC refinement, accessibility pass, performance tuning.
- **Dependencies**: all prior phases functionally complete.
- **Testing**: full regression suite, load test on webhook ingestion path, a11y audit (axe).
- **Acceptance**: Every AI-mutating action is visible in audit log; irreversible actions require approval.
### Phase 7 — Product Differentiation Layer (2–3 weeks, High)
- **Objectives**: Build the surfaces that make the platform feel alive rather than a static CRUD dashboard (full spec in Section 13): AI Chat Workspace, Command Center (⌘K), AI Copilot panel, Time-Saved/ROI metrics, Workflow Builder, Memory Explorer, Organization Map, AI Confidence indicators, AI Action Timeline, dark enterprise theme.
- **Deliverables**: Chat Workspace backed by a RAG endpoint over `memory_entries`+live data; `cmdk`-based command palette wired to existing API routes (no new backend needed — it's a UI layer over Section 5's endpoints); floating Copilot button per page context; ROI metrics view computed from `agent_runs`+`task_activity`; visual Workflow Builder (React Flow canvas that reads/writes n8n workflow JSON — v1 can be read-only/preview before allowing edits); Memory Explorer UI over `memory_entries`; Org Map (React Flow) over `users`/`projects`; confidence field surfaced wherever `agent_runs.output.confidence` exists; Action Timeline component reused across Meeting/Email/Task detail views; theme tokens applied platform-wide.
- **Dependencies**: Phases 0–6 (this is a layer over the completed core — chat workspace and command center both depend on every module's API existing; confidence display depends on agents already emitting confidence scores, which should be added to Section 9's output schemas from Phase 2 onward rather than retrofitted here).
- **Testing**: Chat Workspace answer-grounding eval (answers must cite real records, not hallucinate); command palette keyboard-only e2e test; Workflow Builder read/write-back-to-n8n integration test.
- **Acceptance**: A user can ask the Chat Workspace "why is Project X delayed" and get an answer traceable to specific `tasks`/`risk_signals` rows; ⌘K can execute at least the 7 example commands listed in Section 13.2 end-to-end.
*(Total: ~18–21 weeks for a small senior team to reach a fully differentiated v1, including Phase 0.5 and Phase 7.)*
 
---
 
## Section 12 — Engineering Standards
 
**Naming**: `camelCase` (TS vars/functions), `PascalCase` (components/types), `kebab-case` (files/routes), DB `snake_case`. Agent names are stable string identifiers (`classifier`, `summarizer`, `risk`, `report`) used consistently across `agent_runs`, prompt filenames, and n8n workflow names.
 
**Code style**: ESLint + Prettier enforced in CI (not just pre-commit — pre-commit can be bypassed). Strict TypeScript (`strict: true`, no implicit `any`). Zod schemas are the single source of truth for both runtime validation and inferred types (`z.infer`) to prevent client/server type drift.
 
**Architecture principles**: (1) Postgres is the only system of record — AI never mutates state directly, only via validated API/workflow paths. (2) Every AI-initiated mutation is traceable to an `agent_run_id`. (3) Irreversible/external actions require human approval by default. (4) No business logic in React components — components render, hooks/services decide.
 
**Reusable component strategy**: shadcn primitives stay unmodified at the `ui/` layer; all customization happens in a composed `shared/` layer, so upstream shadcn updates remain low-friction.
 
**Security**: RLS on every table, secrets never in client bundles, mail OAuth tokens encrypted at rest (pgcrypto), webhook endpoints HMAC-verified, rate limiting on all public webhooks, principle of least privilege for agent DB roles (agents write via API, not direct DB creds).
 
**Performance**: React Query caching + stale-while-revalidate, DB indexes on every foreign key and filter column (see Section 4), pgvector IVFFlat index tuned for recall/latency tradeoff, dashboard aggregate queries materialized/cached (5 min TTL) rather than computed live on every load.
 
**Accessibility**: WCAG 2.1 AA target — keyboard-navigable Kanban (not just drag-drop), color is never the sole status indicator (icon + text pairing), charts include data-table fallback for screen readers.
 
**Logging & Monitoring**: structured JSON logs, Sentry for exceptions with `agent_run_id`/`org_id` correlation, n8n execution history retained 30 days minimum, dashboard for agent success/failure rates and Claude API cost per org.
 
**Testing**: unit tests for business logic (Vitest), integration tests for API routes against a test DB, Playwright e2e for critical flows (auth, task creation, email→task), agent evaluation sets (golden datasets) checked in CI whenever a prompt changes.
 
**Documentation**: ADRs (Architecture Decision Records) in `docs/architecture/` for any deviation from this document, prompts self-documented with inline rationale comments, README per package in the monorepo.
 
---
 
---
 
## Section 13 — Product Differentiation Layer
 
These are the surfaces that separate a "dashboard with an AI feature" from a system that reads as genuinely intelligent. Architecturally, **none of these require new infrastructure** — they are new UI surfaces plus two schema additions (13.11) over the modules already defined in Sections 2–9. That's a deliberate design choice: differentiation should be additive, not a fork of the core architecture.
 
### 13.1 AI Chat Workspace
**Purpose**: Conversational interface over the entire org's live + historical data — the "ask anything" surface.
**Architecture**: A dedicated `/api/v1/chat` endpoint, not a new agent type but a **retrieval-orchestrating agent** that: (1) embeds the user's question, (2) runs similarity search over `memory_entries` scoped to `org_id`, (3) pulls supplementary live rows (open tasks, active risk_signals for entities mentioned), (4) composes a Claude call with retrieved context, (5) returns a structured response with **inline entity references** (task IDs, not just prose) so the UI can render "Would you like me to notify John?" as an actual actionable button, not decorative text.
**Why not just RAG-over-everything naively**: cost and latency — a company with 50k tasks can't stuff them all into context. The retrieval step is scoped by (a) entities named/implied in the question and (b) recency/importance-weighted memory, same pattern as Section 9's agents.
**Action execution**: when the AI proposes an action (e.g., "notify John"), it does **not** execute directly — it returns a proposed `agent_runs` entry with `status=awaiting_approval`, rendered as the `[Yes]` button in the transcript. Clicking it hits the existing `/agents/:name/approve` endpoint from Section 5. This reuses the approval-gate pattern from Section 8.7/9.5 rather than inventing a new execution path.
**UI placement**: persistent right-side panel (collapsible), available from every authenticated route, not a separate page — this is what makes it feel ambient rather than a destination.
 
### 13.2 Command Center (⌘K)
**Purpose**: Zero-navigation control surface, à la Linear.
**Architecture**: Pure frontend layer using `cmdk` (headless command menu), fuzzy-matching a registry of actions. Every command maps to an **existing API route from Section 5** — this is intentionally a thin client feature, not new backend surface:
| Command | Maps to |
|---|---|
| Create project | `POST /projects` (opens quick-create form inline) |
| Assign [person] | `PATCH /tasks/:id` |
| Generate report | `POST /reports/generate` |
| Summarize emails | reuses Classifier Agent output already on `email_messages` |
| Search meeting | `GET /meetings?q=` |
| Open Project X | client-side route push, fuzzy-matched against cached project list |
| Notify everyone | `POST /notifications` broadcast, requires admin+ role check same as any other notify action |
Free-text natural-language commands ("assign the client redesign task to John") fall through to the Chat Workspace's intent parser rather than duplicating NLU logic in the command palette.
 
### 13.3 AI Copilot (per-page contextual)
**Purpose**: A floating "✨ Ask AI" affordance whose suggested actions change based on the current page/entity in view (project, task, meeting).
**Architecture**: Not a new agent — a **context injector** in front of the Chat Workspace endpoint. The floating button passes `{page_type, entity_id}` to `/api/v1/chat`, which prepends the relevant record(s) to context and offers page-specific quick-prompts (e.g., on a project page: "Summarize progress," "Predict completion," "Find blockers," "Write client update," "Generate sprint plan"). "Predict completion" is the one genuinely new capability — a lightweight forecast agent using historical velocity from `task_activity`, not a general LLM guess.
 
### 13.4 Time-Saved / ROI Metrics
**Purpose**: Make automation value tangible to buyers/execs, not just visible.
**Architecture**: Computed, not estimated by an LLM — trust requires this to be auditable math. Each `agent_runs` completion writes an estimated `time_saved_minutes` (a configurable per-agent-type constant, e.g., "email triage saves ~3 min of human read/route time," editable in Settings so it reflects the org's own baseline rather than a marketing number). Dashboard aggregates: Hours saved (today/week), Tasks automated, Meetings summarized, Emails processed, and a derived $ figure using org-configured hourly cost. This lives in the Analytics Dashboard (Section 7.7) as a new KPI row, not a separate page.
 
### 13.5 Workflow Builder
**Purpose**: Visual editor over the automations defined in Section 8, so ops leads can adjust routing without engineering.
**Architecture**: React Flow canvas that reads/writes **n8n's own workflow JSON** via n8n's REST API (n8n exposes workflow CRUD natively) rather than us building a second workflow engine. v1 scope is deliberately constrained: users can view any workflow from Section 8 as a graph, and edit **parameters only** (e.g., "which Slack channel," "confidence threshold for auto-task-creation") via a form bound to specific node fields — full drag-and-drop node creation is a v2 capability, gated because letting non-engineers rewire trigger logic without validation is a reliability risk (Section 8's retry/audit guarantees only hold for workflows we've tested).
 
### 13.6 AI Memory Explorer
**Purpose**: Transparency into what the system "knows" — critical for trust, since Section 2.6's memory silently shapes agent behavior otherwise.
**Architecture**: Read-only UI over `memory_entries`, grouped by `entity_type`/`entity_id` (e.g., all memory tied to Client ABC). Shows: derived preferences (tone, cadence), linked project/meeting counts (joined live from `projects`/`meetings`, not stored redundantly), and top memory entries by `importance`. Includes a **delete/forget** action per entry — required for reasonable data-governance posture, and logged to `audit_log` like any other mutation.
 
### 13.7 Organization Map
**Purpose**: Visual structure connecting people → projects → tasks → meetings → emails.
**Architecture**: React Flow graph, data assembled from existing joins (`users`→`projects`→`tasks`, `meetings`/`email_messages` linked via `source_ref_id`) — no new tables. Node size/color encodes workload or health (reusing Section 7.2/7.4's existing health computations) so the map doubles as a workload-imbalance detector, not just an org chart.
 
### 13.8 AI Confidence Display
**Purpose**: Every AI decision shows its confidence and a one-line rationale, addressed at the schema level below (13.11) rather than bolted onto the UI alone.
**UI**: wherever an `agent_runs.output` is rendered (suggested task, risk severity, classification badge), show `confidence` as a percentage chip and `rationale` as a tooltip ("Similar to 42 previous emails"). Low-confidence outputs (below an org-configurable threshold, default 70%) are visually distinguished and routed to the approval-required path from Section 9 rather than auto-applied — confidence display isn't just cosmetic, it's wired into the same governance gate as irreversible actions.
 
### 13.9 AI Action Timeline
**Purpose**: A literal, chronological trace of an automation from trigger to resolution, for one specific entity (an email, a meeting, a task).
**Architecture**: Pure read view over `agent_runs` + `audit_log` + `task_activity` filtered by `source_ref_id`/`resource_id`, rendered as a vertical timeline component (reused across Email/Meeting/Task detail pages, per Phase 7's component reuse goal). No new write path — this is why Section 4's decision to separate `task_activity` (product-facing) from `audit_log` (compliance-facing) pays off: the timeline merges both for a complete human+AI story.
 
### 13.10 Dark Enterprise Theme
**Purpose**: Visual bar-raise to Linear/Vercel/Stripe/Notion tier.
**Architecture note**: This is a Phase 0.5 deliverable, not a Phase 7 one — token definitions (color scale, glass/blur surface treatment, gradient accents, motion durations) must exist before any component is built in Phase 0, or the team pays a re-skinning tax later. Implementation detail: CSS variables in `globals.css` consumed by shadcn's theming layer, with a light theme as a secondary (not primary) target — this product is used in focused work sessions where dark enterprise UI is the default expectation for this category.
 
### 13.11 Schema Additions Required
Two additive changes support this whole section without touching existing tables:
```sql
-- extends agent_runs (Section 4) rather than new table
ALTER TABLE agent_runs ADD COLUMN confidence real NULL;
ALTER TABLE agent_runs ADD COLUMN rationale text NULL;
ALTER TABLE agent_runs ADD COLUMN time_saved_minutes int NULL;
 
-- new: chat workspace conversation history (separate from agent_runs since it's user-initiated, multi-turn)
chat_sessions (id uuid PK, org_id uuid FK, user_id uuid FK->users, created_at timestamptz)
chat_messages (id uuid PK, session_id uuid FK->chat_sessions, role enum('user','assistant'),
               content text, referenced_entities jsonb, proposed_action_run_id uuid NULL FK->agent_runs,
               created_at timestamptz)
  INDEX idx_chat_messages_session (session_id)
```
`proposed_action_run_id` is the link between "AI: Would you like me to notify John? [Yes]" in chat and the actual approval-gated `agent_runs` row the button triggers — keeping chat a thin UI over the same governed action pipeline as everything else in this document, rather than a parallel execution path with weaker guarantees.
 
---
 
## Section 14 — Event Catalog (Event-Driven Backbone)
 
Sections 8/9 described workflows as direct chains; in practice every workflow **emits and reacts to named events** rather than calling the next workflow directly. This is the difference between a pipeline and a platform — new automations subscribe to existing events without touching the emitter.
 
### 14.1 Event Bus
Implemented as a `domain_events` table + Postgres `LISTEN/NOTIFY` (via Supabase Realtime channel `events:{org_id}`), consumed by n8n via a Postgres-trigger webhook node. This avoids introducing Kafka/SQS for a v1 — Postgres-native pub/sub is sufficient at this scale and keeps the event log queryable with plain SQL.
 
```sql
domain_events (id uuid PK, org_id uuid FK, event_type text, entity_type text, entity_id uuid,
                payload jsonb, emitted_by enum('user','ai_agent','system'), created_at timestamptz)
  INDEX idx_events_org_type (org_id, event_type, created_at)
```
 
### 14.2 Canonical Event Catalog
| Event | Emitted when | Typical subscribers |
|---|---|---|
| `email.received` | Ingestion webhook writes `email_messages` | Classifier Agent workflow |
| `email.classified` | Classifier Agent completes | Task Creation workflow, Chat Workspace memory writer |
| `task.created` | Any path writes to `tasks` | Notification module, Org Map cache invalidation |
| `task.updated` | Status/assignee/priority change | Risk Detection workflow (staleness reset), Realtime UI push |
| `task.completed` | status→`done` | ROI metrics counter, Burndown chart cache invalidation |
| `meeting.ingested` | Transcript webhook received | Summarizer Agent workflow |
| `meeting.summarized` | Summarizer Agent completes | Task Creation workflow (per action item), Chat memory writer |
| `risk.detected` | Risk Agent writes `risk_signals` | Notification module, Executive Dashboard cache invalidation |
| `risk.resolved` | Manual or auto-resolution | Analytics trend counters |
| `report.generated` | Report Agent completes | Notification module (digest delivery) |
| `notification.sent` | Notification dispatched | Delivery-tracking / audit |
| `agent.started` | Any `agent_runs` row created | AI Control Center live view (Section 15) |
| `agent.completed` | `agent_runs.status=success` | AI Control Center, ROI metrics |
| `agent.failed` | `agent_runs.status=failed` | AI Control Center alert, retry scheduler |
| `agent.approval_requested` | `agent_runs.status=awaiting_approval` | Notification module, Chat Workspace action button |
| `agent.correction_recorded` | User edits AI output (Section 16) | Learning Loop consolidation job |
 
**Rule**: workflows in Section 8 are re-specified as *subscribers to events*, not callers of each other. E.g., the Task Creation workflow doesn't get invoked "by" the Email workflow — it subscribes to `email.classified` and decides independently whether to act. This means Phase 7's Command Center/Chat Workspace, or a future integration (Section 17), can hook into `task.created` without anyone touching the Email module.
 
---
 
## Section 15 — Observability: AI Control Center
 
**Purpose**: A dedicated operational view of the AI layer itself — distinct from the Analytics Dashboard (Section 7.7), which is business-facing; this is engineering/ops-facing.
 
**Location**: `/app/settings/ai-control-center` (admin+ only).
 
| Panel | Source | Why |
|---|---|---|
| Running agents (live) | `agent_runs` where `status=running`, pushed via Realtime | See what's in flight right now, not just history |
| Queue size | count of `status=queued` | Detect backlog before users notice delay |
| API latency (p50/p95) | computed from `agent_runs.started_at`/`completed_at` | Catch Claude API degradation early |
| Token usage & est. cost | logged per call (add `input_tokens`, `output_tokens` to `agent_runs`) | Budget governance, matches the ROI panel's cost math in 13.4 |
| Success / failure rate | `agent_runs` grouped by `agent_name`, `status` | Per-agent health, not just aggregate |
| Retry count distribution | `agent_runs.retry_count` histogram | Flags a specific agent/prompt regressing |
| Pending human approvals | `status=awaiting_approval`, joined to requester | Nothing silently stuck waiting on a human |
| Agent history / drill-down | `agent_runs` table view, filterable | Root-cause a specific failure, same data the Chat Workspace's action-trace uses |
 
**Schema addition**:
```sql
ALTER TABLE agent_runs ADD COLUMN input_tokens int NULL;
ALTER TABLE agent_runs ADD COLUMN output_tokens int NULL;
ALTER TABLE agent_runs ADD COLUMN estimated_cost_usd numeric(10,4) NULL;
```
This reuses the existing `agent_runs` table rather than a parallel metrics store — the Control Center is a view, not a new subsystem.
 
---
 
## Section 16 — AI Learning Loop (Correction Feedback)
 
**Purpose**: Every human correction of an AI output is captured, not discarded, so agents improve per-organization over time — this is what makes Section 9's "few-shot with org-specific examples" claim actually true rather than aspirational.
 
### 16.1 Flow
```
AI Suggestion (agent_runs.output)
        ↓
User edits (task field changed, reply rejected/edited, classification overridden)
        ↓
Diff captured (old value from agent_runs.output vs. new value from the edit)
        ↓
Written to agent_corrections + domain_events (agent.correction_recorded)
        ↓
Nightly Memory Consolidation workflow (Section 8.6) embeds high-signal corrections
        ↓
Future Classifier/Risk/Summarizer prompts retrieve these as few-shot examples (Section 9.1)
```
 
### 16.2 Schema
```sql
agent_corrections (id uuid PK, org_id uuid FK, agent_run_id uuid FK->agent_runs,
                    field_name text, ai_value jsonb, corrected_value jsonb,
                    corrected_by uuid FK->users, created_at timestamptz)
  INDEX idx_corrections_org_agent (org_id, agent_run_id)
```
**Capture points**: any `PATCH /tasks/:id` where the changed field's prior value came from `source=email|meeting|ai_risk` and was set within the last 24h is treated as a correction, not just an edit — detected via a diff against `task_activity`, no extra UI needed from the user. Reply-Draft Agent edits (13.1/9.5) are captured explicitly since drafts are always human-reviewed before send.
 
**Design constraint**: corrections influence *future prompts via retrieval*, not fine-tuning — this keeps the system auditable (you can always see *which* past correction influenced a given suggestion, via the memory citation) and avoids the operational overhead of managing per-org fine-tuned models.
 
---
 
## Section 17 — Integration Provider Layer
 
**Purpose**: Let future connectors (CRM, accounting, support tools, code repos, cloud storage, HR) be added without rewriting Sections 2/8's existing workflows.
 
### 17.1 Provider Interface
Every external integration implements a common contract, regardless of vendor:
```ts
interface IntegrationProvider {
  id: string;                     // e.g. "salesforce", "hubspot", "github"
  category: 'crm' | 'accounting' | 'support' | 'code' | 'storage' | 'hr';
  authenticate(orgId: string): Promise<void>;       // OAuth or API-key flow
  ingest(): Promise<DomainEvent[]>;                 // polls/webhooks → emits Section 14 events
  actions: Record<string, (params: unknown) => Promise<unknown>>; // e.g. actions.createContact
}
```
### 17.2 Why this shape
- **`ingest()` emits Section 14 events, not module-specific writes**: a new CRM connector emitting `deal.stage_changed` can be picked up by the *existing* Risk Detection workflow (subscribe to it as a new signal type) without the connector knowing anything about `risk_signals`. This is the payoff of Section 14's event-first redesign.
- **`actions` are named and typed, invoked only through the same approval-gate pattern as Section 9's agents** — an AI-suggested "create CRM contact" goes through `agent_runs.status=awaiting_approval` exactly like a reply draft, so adding a provider never bypasses governance.
- **Registered, not hardcoded**: providers live in `packages/integrations/{provider-id}/` implementing the interface, registered in an `integration_providers` table (`id, org_id, provider_key, config_encrypted, enabled`) — enabling one is a config row + OAuth flow, not a code change to Sections 2/8.
```sql
integration_providers (id uuid PK, org_id uuid FK, provider_key text, config_encrypted jsonb,
                        enabled boolean DEFAULT false, connected_at timestamptz)
  INDEX idx_integrations_org (org_id)
```
 
---
 
*End of Architecture Document.*
 
