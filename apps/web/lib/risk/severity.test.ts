import { describe, expect, it } from "vitest";
import {
  calculateSlaBreachSeverity,
  calculateStaleTaskSeverity,
  calculateVelocityDropSeverity
} from "@/lib/risk/severity";

/**
 * Test Plan §1: "Risk severity computation logic (given criticality +
 * days-overdue inputs, correct severity band)" and §4: "assert correct
 * severity band, not just 'a signal was created'".
 *
 * Boundary values are tested on both sides of every documented threshold —
 * the Implementation Guide's Phase 7 test cases call for a "staleness
 * threshold boundary test" specifically.
 */
describe("calculateStaleTaskSeverity", () => {
  it("escalates a critical project to high after only 3 days", () => {
    expect(calculateStaleTaskSeverity(3, "critical")).toBe("high");
  });

  it("does not escalate a critical project below the 3-day boundary", () => {
    expect(calculateStaleTaskSeverity(2, "critical")).toBe("low");
  });

  it("returns high at and above 14 days regardless of criticality", () => {
    expect(calculateStaleTaskSeverity(14, "on_track")).toBe("high");
    expect(calculateStaleTaskSeverity(30, "on_track")).toBe("high");
  });

  it("returns medium in the 7-13 day band", () => {
    expect(calculateStaleTaskSeverity(7, "on_track")).toBe("medium");
    expect(calculateStaleTaskSeverity(13, "on_track")).toBe("medium");
  });

  it("returns low below 7 days", () => {
    expect(calculateStaleTaskSeverity(6, "on_track")).toBe("low");
    expect(calculateStaleTaskSeverity(0, "at_risk")).toBe("low");
  });

  it("prefers the higher band when both the criticality and day rules apply", () => {
    expect(calculateStaleTaskSeverity(20, "critical")).toBe("high");
  });
});

describe("calculateSlaBreachSeverity", () => {
  it("returns high at and above 72 hours overdue", () => {
    expect(calculateSlaBreachSeverity(72)).toBe("high");
    expect(calculateSlaBreachSeverity(100)).toBe("high");
  });

  it("returns medium in the 24-71 hour band", () => {
    expect(calculateSlaBreachSeverity(24)).toBe("medium");
    expect(calculateSlaBreachSeverity(71)).toBe("medium");
  });

  it("returns low below 24 hours", () => {
    expect(calculateSlaBreachSeverity(23)).toBe("low");
    expect(calculateSlaBreachSeverity(0)).toBe("low");
  });
});

describe("calculateVelocityDropSeverity", () => {
  it("returns high at and above a 60% drop", () => {
    expect(calculateVelocityDropSeverity(60)).toBe("high");
    expect(calculateVelocityDropSeverity(100)).toBe("high");
  });

  it("returns medium in the 30-59% band", () => {
    expect(calculateVelocityDropSeverity(30)).toBe("medium");
    expect(calculateVelocityDropSeverity(59)).toBe("medium");
  });

  it("returns low below a 30% drop", () => {
    expect(calculateVelocityDropSeverity(29)).toBe("low");
    expect(calculateVelocityDropSeverity(0)).toBe("low");
  });
});
