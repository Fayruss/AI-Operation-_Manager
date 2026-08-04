/**
 * Confidence-threshold routing — Test Plan §1: "Confidence-threshold
 * routing logic (does a given confidence correctly route to auto-apply vs.
 * approval-required)."
 *
 * SAD §9.1/§13.3: an agent's structured output is auto-applied only when
 * the model's self-reported confidence meets the org's configured
 * threshold; below it, the run parks at `status=awaiting_approval` for a
 * human decision (the approval gate CLAUDE.md requires for every
 * irreversible AI action).
 *
 * Kept pure and free of DB/LLM dependencies — matching severity.ts's
 * testability rationale — so the routing guarantee stays deterministic and
 * unit-testable even though an LLM produces the confidence value.
 */

/** The classifier's `intent` values that would cause a write if auto-applied. */
type MutatingIntent = "task";

export interface ConfidenceRoutingInput {
  confidence: number;
  intent: string;
  threshold: number;
}

/**
 * Returns true when a human must approve before the agent's proposal is
 * applied. Only mutating intents gate on confidence: a low-confidence
 * classification that proposes no write (e.g. `intent: "fyi"`) has nothing
 * to approve, so it routes straight to success.
 */
export function requiresHumanApproval({ confidence, intent, threshold }: ConfidenceRoutingInput): boolean {
  return isMutatingIntent(intent) && confidence < threshold;
}

function isMutatingIntent(intent: string): intent is MutatingIntent {
  return intent === "task";
}
