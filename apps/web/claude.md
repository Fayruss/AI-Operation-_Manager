CLAUDE.md




# Startup Procedure

Whenever a new Claude Code session begins:

1. Read CLAUDE.md.
2. Read BUILD_STATUS.md.
3. Read CHANGELOG_AI.md.
4. Read .ai/state.json.
5. Inspect the current repository.
6. Verify previously completed work has been preserved.
7. Continue from the current build state.
8. Never regenerate the repository.
9. Continue fixing build errors until the build succeeds.
10. Update BUILD_STATUS.md, CHANGELOG_AI.md and .ai/state.json before ending the session.



# CLAUDE.md
 
This file guides Claude Code when working in this repository.
 
## Project
 
**AI Operations Manager** — an enterprise-grade AI SaaS platform (AI employee that reads email/meetings, classifies signal, creates/updates tasks, detects risk, and generates reports under human approval gates).
 
## Source of Truth
 
The following documents are authoritative and take precedence over any convention Claude would otherwise default to:
 
- Software Architecture Document (SAD)
- Product Requirements Document (PRD)
- UI/UX Design System
- API Contract
- Component Specification
- n8n Workflow Specification
- Test Plan
- Prompt Library (`/prompts`)
- Portfolio Case Study
**Never deviate from these documents unless explicitly instructed.** If a task seems to require deviating from them, stop and ask rather than improvising.
 
## Development Philosophy
 
- Design first, architecture first — think before writing code.
- Maintainability over speed. Write for a senior engineer maintaining this years from now.
- Every implementation decision must align with enterprise SaaS standards.
- Act as a senior engineer, not a code generator: explain architectural decisions when introducing any new pattern.
## Core Rules
 
- Never invent architecture, APIs, or folder structure not defined in the docs above.
- Never ignore the uploaded documentation.
- Never duplicate logic — refactor and extract instead of copy-pasting.
- Never take a shortcut that creates technical debt "because it's easier."
- Keep every feature modular, single-responsibility.
- Prefer composition over inheritance.
- Keep business logic separated from UI.
## Next.js (Mandatory)
 
- Next.js 15 **App Router only** — never the Pages Router.
- React Server Components by default; add `"use client"` only when strictly necessary, and keep Client Components as small as possible.
- Never fetch sensitive data inside Client Components; never place secrets in frontend code.
- Use Server Actions where appropriate; Route Handlers only for external APIs/webhooks.
- Use `loading.tsx`, `error.tsx`, `not-found.tsx`, and the Metadata API on every route that needs them.
- Use Suspense/streaming where beneficial.
- Optimize images with `next/image`, fonts with `next/font`.
- Use dynamic imports when beneficial. Prefer server rendering; never create an unnecessary Client Component.
## TypeScript
 
- Strict mode. No `any`. No `ts-ignore`. No `eslint-disable` unless absolutely required.
- Interfaces for public contracts, types for unions. Infer types where possible.
- Every function is typed.
## Folder Structure
 
Follow the architecture exactly — organize by feature:
 
```
app/
components/
features/
hooks/
lib/
services/
store/
types/
actions/
providers/
utils/
styles/
```
 
Do not create ad hoc folders outside this structure.
 
## Component Architecture
 
- Reusable, composable, accessible, responsive, small, focused.
- Avoid giant components — if a component exceeds ~250 lines, split it.
## UI Rules
 
- shadcn/ui + Radix primitives, following the Design System exactly (spacing, typography, color tokens).
- Never hardcode colors — use CSS variables + Tailwind utilities.
- Animations: Framer Motion. Charts: Recharts. Graph visualization: React Flow.
## State Management
 
- Server state: TanStack Query. Realtime: Supabase Realtime.
- Local UI state: Zustand. **Do not introduce Redux.**
## API Rules
 
- Validate every request with Zod. Return typed responses.
- Never expose internal errors to the client. Use proper HTTP status codes.
- Rate-limit public endpoints. Never trust client input.
## Database Rules
 
- Supabase PostgreSQL + Prisma ORM.
- Every table is tenant-scoped; every query respects Row Level Security.
- Soft delete where required — never hard-delete production data.
- Add indexes where needed; optimize queries; avoid N+1 queries.
## Authentication
 
- Supabase Auth with organizations, RBAC, multi-tenancy.
- Protect every route and every API. Never expose private data across tenants.
## AI Rules
 
- Claude API is called server-side only — never from the frontend.
- Every AI response must validate against its defined schema (see Prompt Library).
- Every AI action is logged. Every irreversible AI action requires human approval.
- Every workflow is auditable.
## n8n Rules
 
- n8n orchestrates workflows; business logic lives inside workflows where the architecture defines it.
- Support retries, failure handling, and idempotency. Never silently fail.
## Performance
 
- Server Components by default; lazy-load heavy components; code split; optimize bundle size.
- Memoize expensive computations. Paginate and virtualize large tables/lists.
- Optimize database queries. Avoid unnecessary re-renders.
## Accessibility
 
- WCAG AA. Full keyboard navigation. ARIA labels. Visible focus states. Screen-reader support.
- Never rely on color alone to convey state.
## Security
 
- Sanitize inputs, escape outputs. Prevent XSS and CSRF.
- Protect secrets and service keys — never expose them client-side.
- Validate permissions and resource ownership on every request.
## Logging
 
- Meaningful logs; no `console.log` in production code.
- Audit important actions and AI activity. Log failures in a way that supports debugging.
## Testing
 
Every feature should be written to support: unit tests, integration tests, end-to-end tests, and AI evaluation tests (per the Test Plan).
 
## Code Quality
 
- Readable, self-documenting names. Small functions. No magic numbers — extract constants.
- Prefer `async`/`await`. Handle every error explicitly.
## Git
 
- Small commits with clear messages.
- No dead code, no commented-out code, no unused imports, no duplicate utilities.
## Definition of Done (every phase)
 
Before marking any phase complete, verify:
 
- [ ] Project builds successfully
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Responsive design
- [ ] Accessibility
- [ ] Performance
- [ ] Security
- [ ] Documentation alignment (matches SAD/PRD/Design System/API Contract)
- [ ] Architecture compliance
Only mark a phase complete once every item above passes.
 
Whenever a meaningful milestone is completed:

Update BUILD_STATUS.md.

Include:

- completed work

- remaining blockers

- current build state

- next action

Never overwrite historical progress.

Append instead.

This file is the authoritative continuation point for future Claude sessions.