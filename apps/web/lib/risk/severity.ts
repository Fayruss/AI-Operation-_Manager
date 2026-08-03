import "server-only";
import type { RiskSeverity } from "@ai-ops/database";

/**
 * Deterministic, pure severity-scoring functions — Test Plan §1: "Risk
 * severity computation logic (given criticality + days-overdue inputs,
 * correct severity band)." Kept independent of the DB/network so they're
 * trivially unit-testable, per Test Plan §4's synthetic-scenario tests
 * ("assert correct severity band, not just 'a signal was created'").
 *
 * These are the authoritative severity source. The Risk Agent (Claude,
 * lib/ai/agents/risk-agent.ts) adds a rationale/recommended_action
 * narrative on top per SAD §9.3 — it does not override these bands, so the
 * system's severity guarantees stay deterministic and testable even though
 * an LLM is in the loop for the narrative.
 */

/** SAD §2.4: "staleness detection (tasks untouched N days)." Criticality comes from the parent project's health. */
export function calculateStaleTaskSeverity(daysStale: number, projectCriticality: "on_track" | "at_risk" | "critical"): RiskSeverity {
  if (projectCriticality === "critical" && daysStale >= 3) return "high";
  if (daysStale >= 14) return "high";
  if (daysStale >= 7) return "medium";
  return "low";
}

/** SAD §2.4: "SLA breach detection." */
export function calculateSlaBreachSeverity(hoursOverdue: number): RiskSeverity {
  if (hoursOverdue >= 72) return "high";
  if (hoursOverdue >= 24) return "medium";
  return "low";
}

/** SAD §2.4/§8.4: "velocity drop (rolling 7-day completion rate vs. prior period)." dropPercent is 0-100. */
export function calculateVelocityDropSeverity(dropPercent: number): RiskSeverity {
  if (dropPercent >= 60) return "high";
  if (dropPercent >= 30) return "medium";
  return "low";
}
