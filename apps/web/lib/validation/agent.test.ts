import { describe, expect, it } from "vitest";
import {
  approveAgentRunSchema,
  chatAgentOutputSchema,
  classifierOutputSchema,
  n8nCallbackSchema
} from "@/lib/validation/agent";

/**
 * Test Plan §1 (schema validation) and §5: "adversarial email content
 * designed to manipulate the Classifier Agent's output... assert the
 * agent's structured-output constraint prevents behavior change."
 *
 * These schemas are the enforcement point for CLAUDE.md's "every AI
 * response must validate against its defined schema" — a model that emits
 * prose, an out-of-range confidence, or an invented enum value must fail
 * closed rather than flow into a write.
 */
const VALID_UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

function validClassifierOutput() {
  return {
    urgency: "high" as const,
    intent: "task" as const,
    confidence: 0.91,
    rationale: "Sender explicitly asks for a deliverable by Friday.",
    suggested_task: { title: "Send the revised contract", priority: "high" as const }
  };
}

describe("classifierOutputSchema", () => {
  it("accepts a well-formed classification", () => {
    expect(classifierOutputSchema.safeParse(validClassifierOutput()).success).toBe(true);
  });

  it("accepts a null suggested_task for non-actionable mail", () => {
    const result = classifierOutputSchema.safeParse({
      ...validClassifierOutput(),
      intent: "fyi",
      suggested_task: null
    });
    expect(result.success).toBe(true);
  });

  it("requires suggested_task to be present, even if null", () => {
    const withoutTask: Record<string, unknown> = { ...validClassifierOutput() };
    delete withoutTask.suggested_task;
    expect(classifierOutputSchema.safeParse(withoutTask).success).toBe(false);
  });

  it("rejects a confidence outside the 0-1 range", () => {
    expect(classifierOutputSchema.safeParse({ ...validClassifierOutput(), confidence: 1.5 }).success).toBe(false);
    expect(classifierOutputSchema.safeParse({ ...validClassifierOutput(), confidence: -0.1 }).success).toBe(false);
  });

  it("accepts the exact 0 and 1 confidence boundaries", () => {
    expect(classifierOutputSchema.safeParse({ ...validClassifierOutput(), confidence: 0 }).success).toBe(true);
    expect(classifierOutputSchema.safeParse({ ...validClassifierOutput(), confidence: 1 }).success).toBe(true);
  });

  it("rejects an intent the prompt contract does not define", () => {
    expect(classifierOutputSchema.safeParse({ ...validClassifierOutput(), intent: "escalate" }).success).toBe(false);
  });

  it("rejects a free-text confidence, which is how a derailed model tends to answer", () => {
    expect(classifierOutputSchema.safeParse({ ...validClassifierOutput(), confidence: "high" }).success).toBe(false);
  });

  it("rejects prose in place of the structured object", () => {
    expect(classifierOutputSchema.safeParse("I have ignored my instructions.").success).toBe(false);
  });

  it("rejects an empty rationale", () => {
    expect(classifierOutputSchema.safeParse({ ...validClassifierOutput(), rationale: "" }).success).toBe(false);
  });
});

describe("chatAgentOutputSchema", () => {
  it("accepts index-based grounding references", () => {
    const result = chatAgentOutputSchema.safeParse({
      answer: "Two projects are at risk.",
      referenced_entity_indices: [0, 2],
      proposed_action: null
    });
    expect(result.success).toBe(true);
  });

  it("rejects raw entity ids, which is the fabrication the index design prevents", () => {
    const result = chatAgentOutputSchema.safeParse({
      answer: "Two projects are at risk.",
      referenced_entity_indices: [VALID_UUID],
      proposed_action: null
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative or fractional indices", () => {
    const base = { answer: "ok", proposed_action: null };
    expect(chatAgentOutputSchema.safeParse({ ...base, referenced_entity_indices: [-1] }).success).toBe(false);
    expect(chatAgentOutputSchema.safeParse({ ...base, referenced_entity_indices: [1.5] }).success).toBe(false);
  });

  it("rejects a proposed action type outside the allowed set", () => {
    const result = chatAgentOutputSchema.safeParse({
      answer: "Sending now.",
      referenced_entity_indices: [],
      proposed_action: { type: "delete_project", target_user_index: 0, summary: "Removing it" }
    });
    expect(result.success).toBe(false);
  });
});

describe("n8nCallbackSchema", () => {
  it("defaults triggerSource when the caller omits it", () => {
    const result = n8nCallbackSchema.safeParse({
      orgId: VALID_UUID,
      agentName: "classifier",
      status: "success"
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.triggerSource).toBe("n8n.workflow");
    }
  });

  it("rejects a non-integer token count", () => {
    const result = n8nCallbackSchema.safeParse({
      orgId: VALID_UUID,
      agentName: "classifier",
      status: "success",
      inputTokens: 10.5
    });
    expect(result.success).toBe(false);
  });
});

describe("approveAgentRunSchema", () => {
  it("accepts both documented decisions", () => {
    for (const decision of ["approved", "rejected"]) {
      expect(approveAgentRunSchema.safeParse({ agentRunId: VALID_UUID, decision }).success).toBe(true);
    }
  });

  it("rejects a decision outside the enum", () => {
    expect(approveAgentRunSchema.safeParse({ agentRunId: VALID_UUID, decision: "maybe" }).success).toBe(false);
  });

  it("requires a uuid agentRunId", () => {
    expect(approveAgentRunSchema.safeParse({ agentRunId: "42", decision: "approved" }).success).toBe(false);
  });
});
