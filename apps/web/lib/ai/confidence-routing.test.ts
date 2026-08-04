import { describe, expect, it } from "vitest";
import { requiresHumanApproval } from "@/lib/ai/confidence-routing";

/**
 * Test Plan §1: "Confidence-threshold routing logic (does a given
 * confidence correctly route to auto-apply vs. approval-required)."
 *
 * This is the guarantee behind CLAUDE.md's "every irreversible AI action
 * requires human approval" — a regression here would let a low-confidence
 * model output write straight to the board.
 */
describe("requiresHumanApproval", () => {
  const threshold = 0.8;

  it("requires approval when a task-creating intent falls below the threshold", () => {
    expect(requiresHumanApproval({ confidence: 0.79, intent: "task", threshold })).toBe(true);
  });

  it("auto-applies when confidence exactly meets the threshold", () => {
    expect(requiresHumanApproval({ confidence: 0.8, intent: "task", threshold })).toBe(false);
  });

  it("auto-applies when confidence is above the threshold", () => {
    expect(requiresHumanApproval({ confidence: 0.95, intent: "task", threshold })).toBe(false);
  });

  it("never gates a non-mutating intent, even at very low confidence", () => {
    expect(requiresHumanApproval({ confidence: 0.01, intent: "fyi", threshold })).toBe(false);
    expect(requiresHumanApproval({ confidence: 0.2, intent: "meeting", threshold })).toBe(false);
  });

  it("gates everything below the threshold when the org demands full confidence", () => {
    expect(requiresHumanApproval({ confidence: 0.99, intent: "task", threshold: 1 })).toBe(true);
  });

  it("auto-applies any task intent when the org disables the gate with a zero threshold", () => {
    expect(requiresHumanApproval({ confidence: 0, intent: "task", threshold: 0 })).toBe(false);
  });
});
