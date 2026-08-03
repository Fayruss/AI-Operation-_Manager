# n8n Workflow Exports

SAD §10: "workflow JSON exports land here... version-controlled and
diffable in PRs, not silently edited in the n8n UI."

## Current scope (Phase 4)

`meeting-processing-workflow.json` is the only workflow exported so far. It
implements n8n Workflow Spec §3 (Meeting Processing Workflow) as a **thin
orchestration layer over this app's own pipeline** rather than duplicating
the Claude-calling/parsing logic inside n8n itself:

```
Webhook (transcript provider) → HTTP Request: POST /api/v1/meetings/ingest
  → on non-2xx: retry (3x, exponential backoff, matching n8n Workflow
    Spec's documented cadence) → on final failure: HTTP Request:
    POST /api/v1/webhooks/n8n/callback (status=failed, for audit visibility)
```

This app's `lib/meetings/meeting-processing-service.ts` already does the
insert → Summarizer Agent → action-item extraction → task creation →
linking sequence in-process (Phase 4, since n8n isn't actually running in
this environment). Once a real n8n instance is connected, this workflow
lets a transcript provider's webhook go through n8n's retry/monitoring
first, then delegate to the exact same application logic — no business
logic duplicated between n8n and the app, matching CLAUDE.md's "never
duplicate logic."

## Importing

In the n8n editor: **Workflows → Import from File** → select the `.json`
file. Update the `Authorization`/`X-Signature` credential values (the
workflow references an n8n credential named `aiom-meeting-webhook-secret`,
not a hardcoded secret) before activating.

## Not yet exported

Email Processing, Task Creation (sub-workflow), Risk Detection, Reporting,
Memory Consolidation workflows (n8n Workflow Spec §1, §2, §4–§6) — those
pipelines currently run in-process only (Phase 3's email pipeline, this
phase's meeting pipeline) and don't have n8n exports yet. Exporting them
follows the same pattern once prioritized.
