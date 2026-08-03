/**
 * SAD §7.1 Executive Dashboard "Company Health Score | Progress Ring |
 * Single glanceable number rolling up project health, risk count, SLA
 * compliance." Pure function (no DB/network deps, matching severity.ts's
 * testability rationale) — deducts points per active risk signal by
 * severity, floored at 0.
 */
export function calculateCompanyHealthScore(riskCounts: { high: number; medium: number; low: number }): number {
  const deduction = riskCounts.high * 15 + riskCounts.medium * 5 + riskCounts.low * 1;
  return Math.max(0, 100 - deduction);
}
