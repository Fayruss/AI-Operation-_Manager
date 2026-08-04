/** Centralized query key factory (SAD §6.4) — keeps cache invalidation consistent across hooks. */

/**
 * Filter bags are declared as plain `interface`s (EmailFilters,
 * TaskFilters, …). Interfaces get no implicit index signature, so they
 * aren't assignable to `Record<string, …>`. Each `list`/`search` factory
 * therefore takes the bag as a generic constrained to string-valued
 * optional fields, letting those interfaces be passed directly rather than
 * cast at each call site.
 */
type QueryFilters<T> = { [K in keyof T]: string | undefined };

export const queryKeys = {
  projects: {
    all: ["projects"] as const,
    detail: (id: string) => ["projects", id] as const
  },
  boards: {
    byProject: (projectId: string) => ["boards", { projectId }] as const
  },
  tasks: {
    all: ["tasks"] as const,
    list: <T extends QueryFilters<T>>(filters: T) => ["tasks", filters] as const,
    detail: (id: string) => ["tasks", id] as const
  },
  users: {
    all: ["users"] as const
  },
  auditLog: {
    list: <T extends QueryFilters<T>>(filters: T) => ["audit-log", filters] as const
  },
  approvals: {
    all: ["approvals"] as const
  },
  emails: {
    list: <T extends QueryFilters<T>>(filters: T) => ["emails", filters] as const,
    detail: (id: string) => ["emails", id] as const
  },
  emailAccounts: {
    all: ["email-accounts"] as const
  },
  meetings: {
    all: ["meetings"] as const,
    detail: (id: string) => ["meetings", id] as const
  },
  riskSignals: {
    list: <T extends QueryFilters<T>>(filters: T) => ["risk-signals", filters] as const
  },
  reports: {
    all: ["reports"] as const,
    detail: (id: string) => ["reports", id] as const
  },
  memory: {
    all: ["memory"] as const,
    list: <T extends QueryFilters<T>>(filters: T) => ["memory", filters] as const,
    detail: (id: string) => ["memory", id] as const,
    related: (id: string) => ["memory", id, "related"] as const,
    search: <T extends QueryFilters<T>>(query: string, filters: T) => ["memory", "search", query, filters] as const,
    stats: () => ["memory", "stats"] as const
  },
  chat: {
    sessions: () => ["chat", "sessions"] as const,
    messages: (sessionId: string) => ["chat", "sessions", sessionId, "messages"] as const
  },
  timeline: {
    forEntity: (entityType: string, entityId: string) => ["timeline", entityType, entityId] as const
  },
  analytics: {
    roi: (period: string) => ["analytics", "roi", period] as const,
    orgMap: () => ["analytics", "org-map"] as const,
    velocity: () => ["analytics", "velocity"] as const,
    aiVolume: () => ["analytics", "ai-volume"] as const
  }
};
