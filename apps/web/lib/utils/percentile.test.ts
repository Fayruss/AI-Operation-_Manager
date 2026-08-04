import { describe, expect, it } from "vitest";
import { percentile } from "@/lib/utils/percentile";

/**
 * SAD §15's p50/p95 latency panels depend on this. Test Plan §1 utility
 * logic — a wrong percentile would silently misreport Claude API health,
 * which is the exact degradation the panel exists to catch.
 */
describe("percentile", () => {
  const oneToTen = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("returns null for an empty sample", () => {
    expect(percentile([], 0.5)).toBeNull();
  });

  it("returns the only value for a single-element sample", () => {
    expect(percentile([42], 0.5)).toBe(42);
    expect(percentile([42], 0.95)).toBe(42);
  });

  it("computes the nearest-rank median", () => {
    expect(percentile(oneToTen, 0.5)).toBe(5);
  });

  it("computes p95 without running off the end of the array", () => {
    expect(percentile(oneToTen, 0.95)).toBe(10);
  });

  it("returns the maximum at fraction 1", () => {
    expect(percentile(oneToTen, 1)).toBe(10);
  });

  it("returns the minimum at fraction 0", () => {
    expect(percentile(oneToTen, 0)).toBe(1);
  });

  it("handles a two-element sample at both ends", () => {
    expect(percentile([10, 20], 0.5)).toBe(10);
    expect(percentile([10, 20], 0.95)).toBe(20);
  });
});
