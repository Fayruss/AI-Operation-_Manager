/** Centralized query key factory (SAD §6.4) — keeps cache invalidation consistent across hooks. */
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
    list: (filters: Record<string, string | undefined>) => ["tasks", filters] as const,
    detail: (id: string) => ["tasks", id] as const
  },
  users: {
    all: ["users"] as const
  },
  auditLog: {
    list: (filters: Record<string, string | undefined>) => ["audit-log", filters] as const
  },
  emails: {
    list: (filters: Record<string, string | undefined>) => ["emails", filters] as const,
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
    list: (filters: Record<string, string | undefined>) => ["risk-signals", filters] as const
  },
  reports: {
    all: ["reports"] as const,
    detail: (id: string) => ["reports", id] as const
  },
  memory: {
    all: ["memory"] as const,
    list: (filters: Record<string, string | undefined>) => ["memory", filters] as const,
    detail: (id: string) => ["memory", id] as const,
    related: (id: string) => ["memory", id, "related"] as const,
    search: (query: string, filters: Record<string, string | undefined>) => ["memory", "search", query, filters] as const,
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
