# Current Build Status

**Active milestone: post-Phase 10 — deployment and production launch.**

Phases 1–10 are complete and the full verification chain passes. The
remaining work is operational, not code: running `docs/DEPLOYMENT.md`
§4–§6 against real infrastructure. The system is deployment-ready but
**not production-verified** until those checks pass — see the Phase 10
entry for what that distinction means.

History below is append-only, oldest first.

---

## 2026-08-03 (historical)

Completed

✓ Prisma schema fixed

✓ Prisma generates

✓ React upgraded

✓ Route handler compatibility updated

✓ Multiple Next.js compatibility fixes

Current blocker

ESLint cannot resolve:

@ai-ops/config/eslint-preset.js

Expected next step

Fix ESLint package resolution, then run pnpm build until zero errors.

---

## 2026-08-04 — Build stabilization (Phase 9 close-out)

Completed

✓ Prisma schema fixed

✓ Prisma generates

✓ React upgraded

✓ Route handler compatibility updated

✓ Multiple Next.js compatibility fixes

✓ ESLint preset resolution fixed

✓ typedRoutes type errors fixed

✓ Remaining app-wide type errors fixed

✓ BUILD SUCCEEDS

Current blocker

None.

Build at this point

pnpm install — passes
pnpm --filter @ai-ops/database prisma:generate — passes
pnpm build — passes (1 successful, 0 failed)
next lint — no ESLint warnings or errors
tsc --noEmit — clean

Notable finding

The blocker recorded on 2026-08-03 was a misdiagnosis. The path
`@ai-ops/config/eslint-preset.js` resolved correctly via `require.resolve`;
ESLint 8 interprets `extends` entries as config *names* through its
`eslint-config-` naming convention, so neither the scoped subpath nor the
bare package name resolved through pnpm's symlink. Fixed by using the
relative path form. Separately, `eslint-config-prettier` was referenced by
the shared preset but had never been installed or declared anywhere.

Notes / remaining warnings

pnpm install reports pre-existing peer-dependency warnings from the
earlier React 19 migration (next@15.0.0 and next-themes@0.3.0 declare
peer ranges that predate React 19.0.0 stable). These are warnings only
and do not fail install or build. Not addressed here because resolving
them means a dependency upgrade, which the editing rules ask to avoid
in favor of adapting code. Still outstanding as of Phase 10.

---

## 2026-08-04 — Phase 10 (Governance, Hardening & Deployment Readiness)

Scope note: the Implementation Guide defines Phase 10 as "Governance,
Hardening & Production Deployment". Analytics belongs to Phase 9 and was
deliberately not touched.

Completed

✓ Audit Log UI (searchable, filterable, cursor-paginated, admin-gated)

✓ Approval Center (new central queue + read endpoint, optimistic updates)

✓ AI Control Center implemented against SAD §15 (was an empty-state stub)

✓ RBAC hardening — 8 write endpoints were missing their documented member+ gate

✓ Accessibility pass — focus ring token + Button/Input/Textarea rings, KpiCard keyboard activation

✓ Vitest + 92 unit tests across 9 files (Test Plan §1)

✓ GitHub Actions CI (install → prisma generate → lint → typecheck → build → test)

✓ Deployment runbook (docs/DEPLOYMENT.md)

Current build

pnpm install — passes
pnpm --filter @ai-ops/database prisma:generate — passes
pnpm lint — no ESLint warnings or errors
pnpm typecheck — clean
pnpm build — passes
pnpm test — 92 passed (9 files)

Production readiness

| Area | Status |
|---|---|
| Build / lint / types / tests | Pass |
| Security | RBAC gap closed; tenant scoping intact |
| Logging | Audit log now visible in-app |
| Monitoring | In-app AI Control Center only; no external service |
| Performance | Not load-tested |
| Documentation | Runbook written |
| Deployment | Ready, not executed |

Notable findings

- `viewer` role could create/update tasks, projects and boards, and decide
  approvals: the API Contract documents "member+ required" but no `minRole`
  was set on 8 endpoints. Several already carried docstrings claiming
  member+ that were never enforced. Fixed.
- No focus ring existed anywhere in the app — the `ring` color token was
  absent from tailwind-preset.ts, so Design System §10's "never suppressed"
  rule could not be satisfied by any component. Token added; rings applied.
- Environment validation already existed (lib/env.ts). A duplicate module was
  started and deleted; a drift test between .env.example and the Zod schema
  was added instead.
- `forbidden()` from `next/navigation` does not exist in Next 15.0.0 —
  verified before use; the admin guard uses `notFound()`, matching this
  codebase's convention and SAD §5's "403 never used to mask 404".

Not completed — requires external infrastructure

Vercel deploy, Sentry DSN, uptime alerting, load testing, rollback drill,
integration/e2e tests, and multi-tenant isolation at scale (all need a live
environment or test database). Each is documented with its unblocking step
in docs/DEPLOYMENT.md §10.

Next action

Operator runs docs/DEPLOYMENT.md §4–§6: apply migrations including the
non-optional `db:apply-sql` RLS step, configure Vercel, then work the
10-step verification list. Check 10 (cross-tenant isolation) is the gate
that matters most — a failure there is a data breach, not a bug. Until
those checks pass against a real deployment, treat the system as unverified
in production regardless of CI status.

---

## 2026-08-04 — Vercel deploy fix: implicit `any` in rebuild-embeddings

Trigger

First Vercel deploy after Phase 10 failed on a strict TypeScript error the
local build did not surface:

```
app/api/v1/memory/rebuild-embeddings/route.ts
Parameter 'e' implicitly has an 'any' type.
```

Root cause

Not a defect in the callback. `MemoryEntryRepository.listStaleEmbeddings`
had **no explicit return type**, so its type was inferred from
`prisma.memoryEntry.findMany(...)`. That inference is only resolvable when
the generated Prisma client exists on disk. On a cold Vercel builder the
client is generated into `node_modules/.pnpm/...`, and where that
resolution does not land before the type check, `prisma.memoryEntry`
degrades to `any`, the return type collapses to `any[]`, and the error
surfaces at the *call site* as an implicitly-typed parameter.

Local builds passed because an earlier `prisma:generate` had already left a
generated client in place. Reproduced by confirming
`node_modules/.prisma/client/index.d.ts` was absent before regenerating.

Fix (no suppression, no casts)

`memory-entry-repository.ts` was the only repository in
`lib/repositories/` that did not import its own Prisma model type — every
sibling (`board`, `meeting`, `project`, `task`, ...) already imports
`type Board` / `type Meeting` / etc. from `@ai-ops/database`. That omission
is exactly what left its return types dependent on inference. Fixed to
match the existing convention:

- Imported `type MemoryEntry` from `@ai-ops/database`.
- Annotated `listStaleEmbeddings` → `Promise<MemoryEntry[]>` (the reported
  error), plus `listPendingEmbeddings`, `listRelated` → `Promise<MemoryEntry[]>`
  and `getByIdInOrg` → `Promise<MemoryEntry>`, which carried identical
  latent exposure.
- Typed the route callback parameter explicitly as `(entry: MemoryEntry)`
  so the route no longer depends on cross-package inference at all.

`MemoryEntry` (not the hand-written `MemoryEntryRow`) is the correct type
here: the generated payload matches `MemoryEntryRow` field-for-field except
`metadata`, which Prisma types as `Prisma.JsonValue | null` against the
interface's `Record<string, unknown> | null`. Annotating with
`MemoryEntryRow` would have required a cast — the thing to avoid. It also
correctly omits `embedding`, the `Unsupported("vector(1536)")` column.

Files modified

- `apps/web/lib/repositories/memory-entry-repository.ts` — model type import
  + 4 explicit return types
- `apps/web/app/api/v1/memory/rebuild-embeddings/route.ts` — type-only import
  + typed callback parameter

Verification

pnpm lint — no ESLint warnings or errors
tsc --noEmit — clean (exit 0)
pnpm build — compiled successfully
pnpm test — 92 passed (9 files), unchanged

Known gap — this class of failure can recur

The fix removes this specific inference dependency, but the underlying
fragility is repository-wide: any repository method without an explicit
return type is exposed to the same cold-builder behaviour. The durable
guard is ensuring `prisma:generate` always runs before typecheck/build on
the Vercel builder (CI already orders it correctly; confirm the Vercel
install/build command does too). Worth an explicit sweep for
inference-dependent return types across `lib/repositories/` in a future
pass.

Docs note

CLAUDE.md's startup procedure references `CHANGELOG_AI.md` and
`.ai/state.json`. Neither exists in this repository; only
`BUILD_STATUS.md` is present. They were deliberately not created here
rather than fabricating state — flagging so the discrepancy can be
resolved (either create them intentionally or drop them from CLAUDE.md).

Next action

Unchanged from Phase 10: operator runs `docs/DEPLOYMENT.md` §4–§6. The
Vercel build should now clear the type check; the §10 verification list —
especially check 10 (cross-tenant isolation) — remains the real gate.