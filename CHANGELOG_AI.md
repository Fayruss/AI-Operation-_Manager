# AI Changelog

2026-08-04 — Phase 10 (Governance, Hardening & Deployment Readiness)

Scope per the Implementation Guide's Phase 10 definition. Analytics
(Phase 9) deliberately untouched.

Added:

- Audit Log UI (components/audit/audit-log-table.tsx) over the existing
  GET /audit-log. Semantic table, native <details> metadata viewer,
  cursor pagination, admin-gated tab.
- Approval Center (components/approvals/approval-center.tsx) + the read
  endpoint it needed (GET /agents/approvals) and
  AgentRunRepository.listAwaitingApproval. Approvals previously had no
  central queue — only an inline chat button.
- AI Control Center implemented against SAD §15's panel table: running,
  queued, p50/p95 latency, tokens, cost, pending approvals, per-agent
  success rate, retry histogram. Was an empty-state stub.
- Vitest + 92 unit tests across 9 files (Test Plan §1).
- GitHub Actions CI (.github/workflows/ci.yml).
- docs/DEPLOYMENT.md — runbook, verification, rollback, limitations.

Fixed (security):

- RBAC: 8 write endpoints had no minRole despite the API Contract
  documenting "member+ required", so `viewer` could create and update
  tasks, projects, boards, and decide approvals. Several already had
  docstrings claiming member+ that were never enforced.

Fixed (accessibility):

- No focus ring existed anywhere: the `ring` color token was missing from
  tailwind-preset.ts. Added per Design System §10, then applied to Button,
  Input, Textarea, Sheet close, user menu, and two form controls that
  suppressed the outline with no replacement.
- KpiCard had role="button" + tabIndex but no key handler — focusable yet
  unusable by keyboard.

Refactored:

- Extracted lib/ai/confidence-routing.ts from classifier-agent.ts so Test
  Plan §1's confidence-routing requirement is unit-testable.
- Extracted lib/utils/percentile.ts for SAD §15's latency panels.

Avoided:

- Started a second environment-validation module, then deleted it on
  finding lib/env.ts already implements it. Added a .env.example ↔ schema
  drift test instead.

Files Modified

- .github/workflows/ci.yml (new)
- docs/DEPLOYMENT.md (new)
- apps/web/components/audit/audit-log-table.tsx (new)
- apps/web/components/approvals/approval-center.tsx (new)
- apps/web/app/api/v1/agents/approvals/route.ts (new)
- apps/web/lib/query/use-approvals.ts (new)
- apps/web/lib/ai/confidence-routing.ts (new)
- apps/web/lib/utils/percentile.ts (new)
- apps/web/vitest.config.ts (new)
- apps/web/test/stubs/server-only.ts (new)
- apps/web/lib/{risk/severity,risk/health-score,ai/confidence-routing,validation/task,validation/agent,api/pagination,auth/rbac,utils/percentile,env}.test.ts (new)
- apps/web/app/app/settings/ai-control-center/page.tsx
- apps/web/app/app/settings/page.tsx
- apps/web/app/api/v1/{tasks,projects,boards}/route.ts
- apps/web/app/api/v1/tasks/[id]/route.ts
- apps/web/app/api/v1/projects/[id]/route.ts
- apps/web/app/api/v1/emails/[id]/convert-to-task/route.ts
- apps/web/app/api/v1/agents/[name]/approve/route.ts
- apps/web/app/api/v1/chat/route.ts
- apps/web/lib/repositories/agent-run-repository.ts
- apps/web/lib/ai/agents/classifier-agent.ts
- apps/web/lib/query/{use-audit-log,keys}.ts
- apps/web/components/ui/{button,input,textarea,sheet}.tsx
- apps/web/components/shared/kpi-card.tsx
- apps/web/components/layout/user-menu.tsx
- apps/web/components/emails/convert-to-task-dialog.tsx
- apps/web/components/memory/memory-actions.tsx
- packages/config/tailwind-preset.ts
- apps/web/package.json, package.json, turbo.json

2026-08-04

Build now succeeds end to end (pnpm install, prisma:generate, pnpm build).

Fixed:

- ESLint preset resolution. The recorded blocker was diagnosed as a path
  resolution failure, but `require.resolve` resolved the subpath fine.
  ESLint 8 interprets `extends` entries as config *names* via its
  `eslint-config-` naming convention, so neither the scoped subpath nor
  the bare package name resolved through pnpm's symlink. Switched
  apps/web/.eslintrc.json to the relative path form.
- eslint-config-prettier was referenced by the shared preset's `extends`
  but was never installed or declared anywhere in the workspace. Declared
  it in packages/config.
- typedRoutes type errors. `href` values widened to `string` (an
  unannotated array, and `NavItem.href: string`) lose the literal types
  typedRoutes requires. Typed both as `Route` from "next" so build-time
  route checking is preserved rather than cast away.
- Zod request payload types. `CreateMemoryEntryInput`/`SearchMemoryInput`
  used `z.infer` (output type), making `.default()` fields required for
  callers. Switched to `z.input`.
- Query key factories required `Record<string, string | undefined>`, which
  plain interfaces are not assignable to. Made the factories generic,
  removing a pre-existing cast at the use-memory call site.
- useReports: overloaded so callers passing `initialData` get a
  non-optional `data`.
- task-repository getWorkloadByAssignee: restructured the accumulator to
  carry assigneeId/projectId instead of re-splitting a composite key,
  which produced `string | undefined`.
- risk-detection-service: narrowed PendingSignal.signalType to the three
  types this scan's detectors emit, matching the Risk Agent contract.
- supabase middleware.ts/server.ts: annotated the `setAll` cookie
  parameter with the library's own type (no `any` introduced).

Files Modified

- apps/web/.eslintrc.json
- apps/web/components/command/command-palette.tsx
- apps/web/components/layout/nav-config.ts
- apps/web/lib/query/keys.ts
- apps/web/lib/query/use-memory.ts
- apps/web/lib/query/use-reports.ts
- apps/web/lib/repositories/task-repository.ts
- apps/web/lib/risk/risk-detection-service.ts
- apps/web/lib/supabase/middleware.ts
- apps/web/lib/supabase/server.ts
- apps/web/lib/validation/memory.ts
- packages/config/package.json
- pnpm-lock.yaml

2026-08-03

Fixed:

- Prisma block comments
- React stable migration
- React types
- Route handler typing
- Next.js compatibility
- removed after API
- next.config compatibility

Files Modified

- package.json
- pnpm-lock.yaml
- schema.prisma
- route.ts
- next.config.mjs