import { describe, expect, it } from "vitest";
import { hasMinRole, requireMinRole } from "@/lib/auth/rbac";
import { ApiError } from "@/lib/api/errors";
import type { UserRole } from "@ai-ops/types";

/**
 * Test Plan §5: "RBAC: every admin-only endpoint tested against a
 * member-role token, expect 403." This suite covers the pure ordering
 * primitive those endpoint tests depend on — the API Contract's documented
 * hierarchy is owner > admin > member > viewer.
 */
const ROLES: UserRole[] = ["viewer", "member", "admin", "owner"];

describe("hasMinRole", () => {
  it("lets every role satisfy its own requirement", () => {
    for (const role of ROLES) {
      expect(hasMinRole(role, role)).toBe(true);
    }
  });

  it("grants higher roles everything a lower role can do", () => {
    expect(hasMinRole("owner", "admin")).toBe(true);
    expect(hasMinRole("owner", "member")).toBe(true);
    expect(hasMinRole("owner", "viewer")).toBe(true);
    expect(hasMinRole("admin", "member")).toBe(true);
    expect(hasMinRole("member", "viewer")).toBe(true);
  });

  it("denies lower roles anything a higher role requires", () => {
    expect(hasMinRole("viewer", "member")).toBe(false);
    expect(hasMinRole("viewer", "admin")).toBe(false);
    expect(hasMinRole("member", "admin")).toBe(false);
    expect(hasMinRole("admin", "owner")).toBe(false);
  });

  it("keeps viewer read-only against every write tier", () => {
    expect(hasMinRole("viewer", "member")).toBe(false);
    expect(hasMinRole("viewer", "admin")).toBe(false);
    expect(hasMinRole("viewer", "owner")).toBe(false);
  });
});

describe("requireMinRole", () => {
  it("passes silently when the role is sufficient", () => {
    expect(() => requireMinRole("admin", "member")).not.toThrow();
  });

  it("throws a FORBIDDEN ApiError when the role is insufficient", () => {
    expect(() => requireMinRole("viewer", "admin")).toThrow(ApiError);
  });

  it("names the required role in the message so the client can explain the denial", () => {
    try {
      requireMinRole("member", "admin");
      expect.unreachable("requireMinRole should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toContain("admin");
    }
  });
});
