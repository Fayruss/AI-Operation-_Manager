AI-Operations-Manager-Component-Spec.md


# AI Operations Manager — Component Specification
 
Full specs for the core/highest-reuse components. Every other component in the Design System's inventory (§6) follows this exact template — Purpose, Props, State, Events, API calls, Loading, Error, Accessibility, Responsive — documented at build time in-code via TSDoc, with this file as the canonical reference for the components that appear across the most screens.
 
---
 
## TaskCard
**Purpose**: Represents a single task; primary unit of the Kanban board and search results.
**Used in**: Project Dashboard (Kanban), Executive Dashboard (activity feed), AI Chat Workspace (entity reference), Command Center search results.
 
```ts
interface TaskCardProps {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: { id: string; name: string; avatarUrl?: string } | null;
  dueDate: string | null;       // ISO 8601
  status: TaskStatus;
  source: 'manual' | 'email' | 'meeting' | 'ai_risk';
  confidence?: number;          // present only if source-created by AI, drives ConfidenceChip
}
```
**State**: `loading` (skeleton card, same dimensions), `active` (default), `overdue` (dueDate < now && status !== done — red left-border accent), `completed` (checked, reduced opacity), `dragging` (elevated shadow + 1.02 scale per Design System §9).
**Events**: `onDrag(taskId)`, `onDrop(taskId, newStatus)`, `onEdit(taskId)` (opens detail drawer), `onDelete(taskId)` (soft-delete, confirm dialog).
**API calls**: none directly — parent (`KanbanBoard`) owns the `PATCH /api/v1/tasks/:id` mutation via React Query; `TaskCard` is presentational + event-emitting only (SAD §12: no business logic in components).
**Loading state**: skeleton matching card layout (title bar + avatar circle + badge placeholders).
**Error state**: if the task's data fetch fails independently (rare — usually board-level), render a compact inline error variant with retry icon, not a full-card error takeover.
**Accessibility**: keyboard-focusable (`tabIndex=0`), `Enter` opens detail drawer, arrow keys reorder within column when board has focus (Design System §10 keyboard-Kanban requirement), `aria-label` includes title + status + assignee for screen readers.
**Responsive**: full detail on desktop; mobile collapses to title + status pill + avatar only, tapping opens full detail drawer instead of inline expansion.
 
---
 
## KpiCard
**Purpose**: Single-metric summary card, the atomic unit of every dashboard's top row.
**Used in**: all seven dashboards (SAD §7).
 
```ts
interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: { direction: 'up' | 'down' | 'flat'; value: string; isPositive: boolean };
  icon?: LucideIcon;
  loading?: boolean;
  onClick?: () => void;   // optional drill-down
}
```
**State**: `default`, `loading` (skeleton), `empty` (value=0 rendered distinctly from "no data yet" — e.g. "—"), trend arrow color driven by `isPositive` not just direction (a "down" trend can be positive, e.g. fewer overdue tasks).
**Events**: `onClick` (optional, navigates to detail view — e.g. Active Risks KPI → Operations Dashboard filtered view).
**API calls**: none — pure presentational, data passed from parent's React Query hook.
**Loading/Error**: skeleton on loading; on parent fetch error, card shows "—" with a small warning icon and tooltip, never blocks sibling cards from rendering.
**Accessibility**: `role="button"` only when `onClick` provided; trend direction conveyed via icon + text ("+12%"), never color alone.
**Responsive**: 3-col desktop grid → 2-col tablet → 1-col mobile stack (Design System §7).
 
---
 
## ConfidenceChip
**Purpose**: Surfaces AI decision confidence inline wherever agent output is shown (SAD §13.8).
 
```ts
interface ConfidenceChipProps {
  confidence: number;      // 0–1
  rationale?: string;      // shown in tooltip
  threshold?: number;      // org-configured, default 0.7 — drives visual tier
}
```
**State**: `high` (≥90%, subtle `--info` badge), `medium` (70–89%, same badge + slightly muted), `low` (<threshold, amber-bordered — visually distinct, signals "this needs review," ties to approval-gate routing).
**Events**: `onHover` → tooltip with rationale; no click action (informational only).
**API calls**: none — value passed down from the `agent_runs` row already fetched by the parent.
**Loading/Error**: not independently loadable (always renders with parent data) — if `confidence` is null (non-AI-sourced content), component doesn't render at all rather than showing a placeholder.
**Accessibility**: `aria-label="AI confidence: 96 percent, similar to 42 previous emails"` — full context in one string for screen readers, not split across visual-only tooltip.
**Responsive**: percentage-only on mobile (rationale still available via tap-to-reveal, not hover).
 
---
 
## ChatPanel
**Purpose**: The AI Chat Workspace surface (SAD §13.1) — persistent right-side conversational interface.
 
```ts
interface ChatPanelProps {
  sessionId: string | null;   // null = new session
  contextEntity?: { type: string; id: string };  // set by Copilot for page-scoped questions
  collapsed: boolean;
  onToggleCollapse: () => void;
}
```
**State**: `idle`, `streaming` (response rendering token-by-token), `action-pending` (assistant message includes a proposed `agent_runs` action, renders approval button), `error` (API/retrieval failure — shows retry, never a raw stack trace).
**Events**: `onSend(message)`, `onApproveAction(agentRunId)`, `onRejectAction(agentRunId)`, `onToggleCollapse()`.
**API calls**: `POST /api/v1/chat` (send message, streamed response), `POST /api/v1/agents/:name/approve` (action button).
**Loading state**: typing-indicator dots during streaming (Design System §9), not skeleton — distinguishes "processing" from "loading historical data."
**Error state**: inline error bubble in the transcript with retry, session otherwise preserved (never clears history on a single failed turn).
**Accessibility**: transcript is a live region (`aria-live="polite"`) so screen readers announce new assistant messages; input is a standard labeled textarea, `Enter` sends / `Shift+Enter` newlines.
**Responsive**: full panel on desktop (collapsible to icon rail); on mobile, opens as a full-screen sheet rather than a persistent side panel (no room to coexist with content).
 
---
 
## RiskPill
**Purpose**: Compact severity indicator for risk signals.
```ts
interface RiskPillProps { severity: 'low' | 'medium' | 'high'; label?: string; }
```
**State**: three fixed visual tiers mapped to Design System §2 warning/danger scale, icon-paired (`AlertTriangle`/`AlertCircle`) always, never color-only.
**Used in**: Operations Dashboard risk feed, Executive Dashboard risk KPI, Project Dashboard health indicator.
**Accessibility**: `aria-label="High severity risk"` in full.
 
---
 
## Pattern for all remaining components
`StatusBadge`, `AiSourceBadge`, `DataTable`, `ActionTimeline`, `CommandPalette`, `CopilotButton`, `KanbanBoard` (container), and every module-specific component follow this identical structure. Each is documented via TSDoc directly above its component definition at implementation time, using this file's five components as the canonical template for depth and tone — this keeps the spec living in the code (won't drift from implementation) while this document remains the onboarding reference for new engineers.
 
---
 
*End of Component Specification.*
 
