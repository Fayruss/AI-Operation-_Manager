AI-Operations-Manager-API-Contract.md


# AI Operations Manager — API Contract
 
Full request/response contracts for the representative endpoint set spanning every pattern in the API (auth, CRUD, async job, webhook, approval-gated action). Every other endpoint in SAD §5 follows one of these four patterns exactly — same envelope, same auth header, same error shape.
 
**Base URL**: `/api/v1` · **Auth**: `Authorization: Bearer <supabase_jwt>` on all non-webhook routes · **Content-Type**: `application/json`
 
---
 
## Pattern A — Standard CRUD: `POST /tasks`
 
**Request**
```json
{
  "boardId": "b_8f2a...",
  "title": "Follow up with client on delayed deliverable",
  "description": "Client flagged delay in email thread #4421",
  "priority": "high",
  "assigneeId": "u_3c1d...",
  "dueDate": "2026-07-08T17:00:00Z"
}
```
**Validation rules** (Zod, shared client+server per SAD §12): `title` required, 1–200 chars; `priority` enum required; `boardId` required, must resolve to a board within the caller's org (RLS-enforced, but also explicitly 403'd at the API layer with a clear message rather than a bare DB error); `dueDate` optional, must be ISO 8601, must be ≥ now if provided.
 
**Response `201`**
```json
{
  "id": "t_91ab...",
  "boardId": "b_8f2a...",
  "title": "Follow up with client on delayed deliverable",
  "status": "todo",
  "priority": "high",
  "assignee": { "id": "u_3c1d...", "name": "Sarah Chen" },
  "source": "manual",
  "dueDate": "2026-07-08T17:00:00Z",
  "createdAt": "2026-07-01T14:22:03Z"
}
```
**Error codes**: `400 VALIDATION_ERROR` (field-level details), `401 UNAUTHENTICATED`, `403 FORBIDDEN` (valid token, insufficient role — member+ required), `404 BOARD_NOT_FOUND` (cross-tenant or nonexistent board — same response either way, no existence leakage), `429 RATE_LIMITED`.
**Rate limit**: 100 req/min per user for write endpoints.
 
---
 
## Pattern B — Async Job: `POST /reports/generate`
 
**Request**
```json
{ "type": "weekly_exec", "periodStart": "2026-06-23", "periodEnd": "2026-06-29" }
```
**Response `202 Accepted`** (job enqueued, not complete)
```json
{ "reportId": "r_4e21...", "status": "generating", "pollUrl": "/api/v1/reports/r_4e21..." }
```
**Poll — `GET /reports/:id`**
```json
{
  "id": "r_4e21...",
  "status": "complete",
  "type": "weekly_exec",
  "content": { "highlights": ["..."], "risks": ["..."], "recommendations": ["..."] },
  "pdfUrl": "https://.../reports/r_4e21....pdf",
  "generatedBy": "manual",
  "createdAt": "2026-06-29T20:00:11Z"
}
```
Intermediate poll (`status: "generating"`) returns `200` with no `content`/`pdfUrl` yet — client polls every 3s, timeout after 60s surfaces an inline retry, matching Report Agent's fallback path in SAD §9.4 (a `status: "complete_fallback"` value indicates the template-report path was used, surfaced subtly in the UI so users know a full narrative wasn't generated).
**Error codes**: `400 VALIDATION_ERROR` (bad date range), `403 FORBIDDEN` (admin+ only), `429 RATE_LIMITED` (max 5 manual generations/hour/org — cost governance).
 
---
 
## Pattern C — Signed Webhook: `POST /webhooks/gmail`
 
**Headers**: `X-Signature: <HMAC-SHA256 of body using org's webhook secret>`
**Request** (Gmail push notification format, passed through)
```json
{ "message": { "data": "base64EncodedPayload", "messageId": "...", "publishTime": "..." }, "subscription": "..." }
```
**Response `200`** (must return fast — actual processing is enqueued to n8n, not synchronous)
```json
{ "received": true }
```
**Validation**: signature verified before any parsing; invalid signature → `401 INVALID_SIGNATURE`, logged and does **not** enqueue anything (prevents spoofed ingestion). Malformed-but-signed payload → `200` (ack receipt per provider requirements) but internally logged as `email.ingestion_failed` and surfaced in AI Control Center (SAD §15), never silently dropped.
**Rate limit**: none at the app layer (provider-controlled cadence), but n8n queue depth is monitored (SAD §15) to catch abuse/misconfiguration.
 
---
 
## Pattern D — Approval-Gated Action: `POST /agents/:name/approve`
 
**Request**
```json
{ "agentRunId": "ar_77cd...", "decision": "approved", "note": "Looks good, send it" }
```
**Validation**: `agentRunId` must reference a row with `status=awaiting_approval` in the caller's org; `decision` enum `approved | rejected`; caller must be admin+ (or, for the Chat Workspace's inline approve button, the original task's assignee — role check documented per-agent since approval authority varies, e.g. reply-drafts require admin, task-reassignment-suggestions allow the assignee).
**Response `200`**
```json
{ "agentRunId": "ar_77cd...", "status": "approved", "executedAt": "2026-07-01T14:25:00Z" }
```
On `approved`, the underlying action executes synchronously if fast (e.g. send notification) or is re-enqueued to n8n if it involves an external call (e.g. send email reply) — response returns immediately with `status: "executing"` in that case, and the client subscribes to the `agent.completed`/`agent.failed` event (SAD §14) via Realtime for final confirmation.
**Error codes**: `400 ALREADY_DECIDED` (idempotency — a second approval attempt on a resolved run is rejected, not silently re-executed), `403 FORBIDDEN`, `404 AGENT_RUN_NOT_FOUND`.
 
---
 
## Global Conventions (apply to every endpoint in SAD §5)
- **Pagination**: cursor-based, `?cursor=<opaque>&limit=50` (max 100), response includes `nextCursor: string | null`.
- **Error envelope** (all non-2xx):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "title is required", "details": { "field": "title" } } }
```
- **Idempotency**: all `POST` endpoints that create resources accept an optional `Idempotency-Key` header; duplicate keys within 24h return the original response rather than creating a duplicate.
- **Versioning**: `/api/v1` is stable; breaking changes ship as `/api/v2` with v1 maintained for a documented deprecation window, not in-place breaking changes.
---
 
*End of API Contract. Remaining endpoints (SAD §5 table) are specified in-code via OpenAPI/Zod-derived schema generation, following these four patterns exactly.*
 
