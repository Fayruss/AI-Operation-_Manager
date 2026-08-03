AI-Operations-Manager-n8n-Workflow-Spec.md


# AI Operations Manager — n8n Workflow Specification
 
Recreatable-from-documentation specs for the six core workflows (SAD §8). Each includes Trigger, Nodes, Branches, Retry, Rollback, Logging, Failure Handling.
 
---
 
## 1. Email Processing Workflow
**Trigger**: Webhook node, `POST /webhooks/gmail` → HMAC-verified by the API layer (API Contract Pattern C) before n8n execution starts.
 
**Nodes** (in order):
1. `Webhook` — receives verified payload.
2. `HTTP Request` — fetch full message body from Gmail API using stored OAuth token (`email_accounts.oauth_token_encrypted`).
3. `Function` — normalize payload to internal shape.
4. `HTTP Request (Claude API)` — Classifier Agent call, system prompt loaded from `prompts/classifier.md`.
5. `IF` branch — `intent == 'task' AND confidence >= org.threshold`.
   - **True →** `HTTP Request` → `POST /api/v1/tasks` (internal API call, service-role auth) → emits `task.created`.
   - **False →** `HTTP Request` → `POST /api/v1/notifications` (suggested-task review) → emits `email.classified` only.
6. `Postgres` — write `email_messages` row (both branches).
7. `Postgres` — write `agent_runs` row (`status=success`, confidence, tokens, cost per SAD §15 schema).
**Branches**: as above; additionally a parallel branch on `urgency == 'critical'` triggers an immediate Realtime push regardless of the task/notification branch outcome.
 
**Retry**: Node 4 (Claude API call) configured with n8n's built-in retry: 3 attempts, exponential backoff (2s/8s/32s). On JSON-schema validation failure of the response, one repair attempt (append validation error to prompt, re-call) before falling to failure path.
 
**Rollback strategy**: no partial task creation — the `IF` branch only calls `POST /tasks` after classification succeeds; if node 4 exhausts retries, execution proceeds directly to the failure path (node 8 below) and **skips** task creation entirely, never creating a task from unclassified data.
 
**Failure handling (node 8, on node 4 exhaustion)**: `Postgres` write `email_messages.status='unprocessed'`, `agent_runs.status='failed'` with error detail, emits `agent.failed` event → AI Control Center shows it, and a scheduled sweep (hourly) surfaces any `unprocessed` emails older than 1h as a notification to Elena (admin) — nothing is silently dropped.
 
**Logging**: every node's execution logged in n8n's native execution history (30-day retention per SAD §12) plus the explicit `agent_runs`/`domain_events` writes for cross-system queryability.
 
---
 
## 2. Task Creation Workflow (sub-workflow, called by Email/Meeting workflows)
**Trigger**: n8n "Execute Workflow" trigger, invoked with `{title, description, priority, boardId, suggestedAssigneeId, source, sourceRefId}`.
**Nodes**: `Postgres` (validate board exists) → `IF` assignee provided and valid → `Postgres` insert task → `HTTP Request` emit `task.created` to `domain_events` → `Postgres` insert `notifications` for assignee.
**Retry**: DB writes are not retried blindly (risk of duplicates) — instead wrapped in a single transaction; on failure the whole sub-workflow returns an error to the caller, which is responsible for its own failure path (Email workflow's node 8 pattern above).
**Rollback**: transactional insert — task + notification succeed or fail together.
**Logging**: `task_activity` row written with `actor_type='ai_agent'` and the originating `agent_run_id`.
 
---
 
## 3. Meeting Processing Workflow
**Trigger**: Webhook, `POST /meetings/ingest` (HMAC-verified).
**Nodes**: `Webhook` → `Postgres` insert `meetings` (raw transcript) → `Function` chunk transcript if >100k tokens → `HTTP Request (Claude API)` Summarizer Agent (`prompts/summarizer.md`), looped per chunk if chunked, then a final reduce call → `Function` parse action items array → `Loop Over Items` → for each action item, `Execute Workflow` (Task Creation, above) → `Postgres` update `meeting_action_items.linked_task_id` → `Postgres` update `meetings.summary`.
**Branches**: chunked vs. single-pass, determined by `Function` node token-count check.
**Retry**: per-chunk retry (failed chunk retried independently, doesn't restart the whole transcript) — 3x exponential backoff, matching Workflow 1.
**Rollback**: if the final reduce call fails after all chunks succeeded, chunk summaries are preserved in a `Postgres` staging write so a retry doesn't re-process already-summarized chunks (cost control).
**Failure handling**: on exhaustion, `meetings.summary` remains null, `agent_runs.status='failed'`, meeting owner notified with a manual "re-run summarization" action in the UI.
**Logging**: `agent_runs` per chunk + one for the reduce step, linked via a shared `parent_run_id` (schema note: `agent_runs.parent_run_id uuid NULL` for multi-step agent traces).
 
---
 
## 4. Risk Detection Workflow (scheduled)
**Trigger**: `Cron` node, every 15 minutes.
**Nodes**: `Postgres` query stale tasks (no update > project's threshold) → `Postgres` query SLA-breach candidates → `Postgres` query 7-day velocity trend per project → `Merge` → `HTTP Request (Claude API)` Risk Agent (`prompts/risk.md`) scores each candidate → `IF` severity == 'high' → immediate `Postgres` insert `risk_signals` + `HTTP Request` notify → **else** → batch into `Postgres` staging table for the daily digest workflow.
**Retry**: idempotent by design (SAD §9.3) — on any node failure, the entire run is skipped and simply re-evaluated at the next 15-min cycle; no retry needed within-run.
**Rollback**: n/a (read-then-write, no multi-step state to unwind).
**Failure handling**: if the Claude API call fails entirely for a cycle, `agent_runs.status='failed'` logged, AI Control Center flags it if 2+ consecutive cycles fail (single-cycle misses are expected/tolerated, consecutive failures indicate a real problem).
**Logging**: one `agent_runs` row per cycle covering all candidates scored in that run (batched, not per-candidate, to avoid `agent_runs` bloat at 15-min cadence).
 
---
 
## 5. Reporting Workflow
**Trigger**: `Cron` (weekly, Friday 4pm org-local time) or `Webhook` (`POST /reports/generate`, API Contract Pattern B).
**Nodes**: `Postgres` aggregate period metrics (tasks, risks, meetings) → `HTTP Request (Claude API)` Report Agent (`prompts/report.md`) → `IF` success → `Function` render markdown→PDF (via a headless rendering step) → `Postgres` update `reports` → `HTTP Request` notify subscribers.
**Retry**: single retry on the Claude call only.
**Failure handling**: on exhaustion, `Function` node generates a **template-based report** (pure aggregation, no narrative) as a guaranteed fallback (SAD §9.4) — `reports.generatedBy` records which path was used.
**Logging**: `agent_runs` records both the attempt and, if applicable, that the fallback path fired (`output.fallback: true`).
 
---
 
## 6. Memory Consolidation Workflow (nightly)
**Trigger**: `Cron`, nightly.
**Nodes**: `Postgres` select high-signal events since last run (resolved risks, completed projects, meeting decisions, `agent_corrections` per SAD §16) → `HTTP Request (Claude API)` generate embeddings → `Postgres` upsert `memory_entries` → `Postgres` decay `importance` on entries untouched >90 days.
**Retry**: per-batch (embeddings called in batches of 20) with 3x retry; failed batches logged and retried on the next nightly run rather than blocking the whole consolidation.
**Failure handling**: partial success is acceptable and expected — a failed batch simply means slightly stale memory until the next run, never a hard failure surfaced to users.
**Logging**: single `agent_runs` summary row per nightly run (`output: {entriesUpserted, batchesFailed}`).
 
---
 
*End of Workflow Specification. All six workflows are exported as versioned JSON in `infra/n8n/workflows/` per SAD §10, this document is the human-readable companion.*
 
