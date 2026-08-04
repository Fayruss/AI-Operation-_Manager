import { describe, expect, it } from "vitest";
import { createTaskSchema, updateTaskSchema, listTasksQuerySchema } from "@/lib/validation/task";

/**
 * Test Plan §1: "Validation schemas reject malformed input for every API
 * contract field-by-field."
 *
 * Rules asserted here come from API Contract Pattern A (`POST /tasks`):
 * "title required, 1–200 chars; priority enum required; boardId required;
 * dueDate optional, must be ISO 8601, must be ≥ now if provided."
 */
const VALID_UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

function validCreateInput() {
  return {
    boardId: VALID_UUID,
    title: "Draft the Q3 board update",
    priority: "high" as const
  };
}

describe("createTaskSchema", () => {
  it("accepts a minimal valid payload", () => {
    expect(createTaskSchema.safeParse(validCreateInput()).success).toBe(true);
  });

  it("requires boardId to be a uuid", () => {
    const result = createTaskSchema.safeParse({ ...validCreateInput(), boardId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("requires boardId to be present", () => {
    const withoutBoard: Record<string, unknown> = { ...validCreateInput() };
    delete withoutBoard.boardId;
    expect(createTaskSchema.safeParse(withoutBoard).success).toBe(false);
  });

  it("rejects an empty title", () => {
    expect(createTaskSchema.safeParse({ ...validCreateInput(), title: "" }).success).toBe(false);
  });

  it("accepts a title at the 200-character boundary and rejects 201", () => {
    expect(createTaskSchema.safeParse({ ...validCreateInput(), title: "a".repeat(200) }).success).toBe(true);
    expect(createTaskSchema.safeParse({ ...validCreateInput(), title: "a".repeat(201) }).success).toBe(false);
  });

  it("rejects a priority outside the documented enum", () => {
    expect(createTaskSchema.safeParse({ ...validCreateInput(), priority: "catastrophic" }).success).toBe(false);
  });

  it("accepts every documented priority value", () => {
    for (const priority of ["low", "medium", "high", "urgent"]) {
      expect(createTaskSchema.safeParse({ ...validCreateInput(), priority }).success).toBe(true);
    }
  });

  it("rejects a non-ISO dueDate", () => {
    expect(createTaskSchema.safeParse({ ...validCreateInput(), dueDate: "next tuesday" }).success).toBe(false);
  });

  it("rejects a dueDate in the past", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(createTaskSchema.safeParse({ ...validCreateInput(), dueDate: past }).success).toBe(false);
  });

  it("accepts a dueDate in the future", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(createTaskSchema.safeParse({ ...validCreateInput(), dueDate: future }).success).toBe(true);
  });

  it("rejects a description beyond 10,000 characters", () => {
    expect(createTaskSchema.safeParse({ ...validCreateInput(), description: "a".repeat(10_001) }).success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  const updatedAt = new Date().toISOString();

  it("requires updatedAt for optimistic concurrency", () => {
    expect(updateTaskSchema.safeParse({ title: "New title" }).success).toBe(false);
  });

  it("accepts a partial update carrying updatedAt", () => {
    expect(updateTaskSchema.safeParse({ title: "New title", updatedAt }).success).toBe(true);
  });

  it("allows nullable fields to be explicitly cleared", () => {
    const result = updateTaskSchema.safeParse({ assigneeId: null, description: null, dueDate: null, updatedAt });
    expect(result.success).toBe(true);
  });

  it("rejects a status outside the documented enum", () => {
    expect(updateTaskSchema.safeParse({ status: "almost_done", updatedAt }).success).toBe(false);
  });

  it("accepts every documented status value", () => {
    for (const status of ["backlog", "todo", "in_progress", "in_review", "done", "blocked"]) {
      expect(updateTaskSchema.safeParse({ status, updatedAt }).success).toBe(true);
    }
  });
});

describe("listTasksQuerySchema", () => {
  it("accepts an entirely empty filter set", () => {
    expect(listTasksQuerySchema.safeParse({}).success).toBe(true);
  });

  it("rejects a malformed assigneeId filter", () => {
    expect(listTasksQuerySchema.safeParse({ assigneeId: "12345" }).success).toBe(false);
  });
});
