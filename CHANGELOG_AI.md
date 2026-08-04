# AI Changelog

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