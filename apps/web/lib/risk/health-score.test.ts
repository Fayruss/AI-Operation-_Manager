import { describe, expect, it } from "vitest";
import { calculateCompanyHealthScore } from "@/lib/risk/health-score";

/**
 * SAD §7.1 Executive Dashboard health score. Deterministic math (Test Plan
 * §1's "no LLM involvement, fully unit-testable" category) — deducts 15 per
 * high, 5 per medium, 1 per low, floored at 0.
 */
describe("calculateCompanyHealthScore", () => {
  it("returns a perfect score when there are no active risks", () => {
    expect(calculateCompanyHealthScore({ high: 0, medium: 0, low: 0 })).toBe(100);
  });

  it("deducts the documented weight per severity band", () => {
    expect(calculateCompanyHealthScore({ high: 1, medium: 0, low: 0 })).toBe(85);
    expect(calculateCompanyHealthScore({ high: 0, medium: 1, low: 0 })).toBe(95);
    expect(calculateCompanyHealthScore({ high: 0, medium: 0, low: 1 })).toBe(99);
  });

  it("accumulates deductions across bands", () => {
    expect(calculateCompanyHealthScore({ high: 2, medium: 3, low: 5 })).toBe(50);
  });

  it("floors at zero rather than going negative under heavy risk load", () => {
    expect(calculateCompanyHealthScore({ high: 20, medium: 0, low: 0 })).toBe(0);
    expect(calculateCompanyHealthScore({ high: 100, medium: 100, low: 100 })).toBe(0);
  });
});
