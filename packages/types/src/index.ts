/**
 * Shared TypeScript types across the monorepo (SAD §10: "generated from
 * Prisma + Zod" once those layers exist — Phase 1 hand-authors the subset
 * needed for the app shell and mirrors SAD §4's schema shapes exactly so
 * later phases can swap these for `z.infer`/Prisma-generated types without
 * touching component code).
 */

export type UserRole = "owner" | "admin" | "member" | "viewer";
export type OrgPlan = "free" | "pro" | "enterprise";

/**
 * Mirrors the `AgentName` enum in schema.prisma (SAD §9/§13.1) — the set of
 * agents that write `agent_runs` rows. Declared here alongside `UserRole`
 * and `OrgPlan` for the reason given above: consumers include Client
 * Components (`app/app/analytics/page.tsx`'s label map), which must not
 * depend on the generated Prisma client. Keep in sync with schema.prisma.
 */
export type AgentName = "classifier" | "summarizer" | "risk" | "report" | "reply_draft" | "memory" | "chat";

export interface Organization {
  id: string;
  name: string;
  plan: OrgPlan;
  createdAt: string;
}

export interface AppUser {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
}

/** SAD §4 `notifications` table shape. */
export interface NotificationItem {
  id: string;
  orgId: string;
  userId: string;
  type: string;
  payload: {
    title: string;
    description?: string;
    href?: string;
  };
  read: boolean;
  createdAt: string;
}

/** SAD §4 `projects` table shape (health enum drives StatusBadge, Design System §6). */
export type ProjectHealth = "on_track" | "at_risk" | "critical";
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";

export interface Project {
  id: string;
  orgId: string;
  name: string;
  status: ProjectStatus;
  health: ProjectHealth;
  startDate: string | null;
  targetDate: string | null;
}

/** SAD §4 `tasks` table shape. */
export type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "blocked";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskSource = "manual" | "email" | "meeting" | "ai_risk";
export type BoardType = "kanban" | "sprint";

/** Component Spec: KpiCard props contract. */
export interface KpiTrend {
  direction: "up" | "down" | "flat";
  value: string;
  isPositive: boolean;
}

export type NavItemKey =
  | "dashboard"
  | "emails"
  | "projects"
  | "meetings"
  | "operations"
  | "reports"
  | "analytics"
  /** Phase 7 — Memory Explorer (SAD §13.6). */
  | "memory"
  | "settings";
