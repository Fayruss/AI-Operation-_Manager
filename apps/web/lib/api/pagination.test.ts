import { describe, expect, it } from "vitest";
import { cursorWhere, decodeCursor, encodeCursor, paginate, parsePaginationParams } from "@/lib/api/pagination";
import { ApiError } from "@/lib/api/errors";

/**
 * Test Plan §1 utility logic. Cursor pagination is the API Contract's
 * Global Convention (`?cursor=<opaque>&limit=50`, max 100) and underpins
 * every list endpoint — an off-by-one here silently skips or duplicates
 * rows across pages, so the boundaries are asserted explicitly.
 */
const CREATED_AT = new Date("2026-03-01T12:00:00.000Z");
const ID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("cursor encoding", () => {
  it("round-trips a position without loss", () => {
    const decoded = decodeCursor(encodeCursor({ createdAt: CREATED_AT, id: ID }));
    expect(decoded.createdAt.toISOString()).toBe(CREATED_AT.toISOString());
    expect(decoded.id).toBe(ID);
  });

  it("produces an opaque token rather than leaking the raw values", () => {
    const cursor = encodeCursor({ createdAt: CREATED_AT, id: ID });
    expect(cursor).not.toContain(ID);
    expect(cursor).not.toContain("2026-03-01");
  });

  it("rejects a malformed cursor with a validation error", () => {
    expect(() => decodeCursor("!!!not-base64!!!")).toThrow(ApiError);
  });

  it("rejects a well-formed base64 payload that is not a cursor", () => {
    const notACursor = Buffer.from("just-one-part", "utf8").toString("base64url");
    expect(() => decodeCursor(notACursor)).toThrow(ApiError);
  });

  it("rejects a cursor carrying an unparseable date", () => {
    const badDate = Buffer.from(`not-a-date|${ID}`, "utf8").toString("base64url");
    expect(() => decodeCursor(badDate)).toThrow(ApiError);
  });
});

describe("cursorWhere", () => {
  it("returns an empty fragment for the first page", () => {
    expect(cursorWhere(null)).toEqual({});
  });

  it("builds a strict keyset comparison that breaks ties on id", () => {
    expect(cursorWhere({ createdAt: CREATED_AT, id: ID })).toEqual({
      OR: [{ createdAt: { lt: CREATED_AT } }, { createdAt: CREATED_AT, id: { lt: ID } }]
    });
  });
});

describe("paginate", () => {
  function rows(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: `id-${i}`,
      createdAt: new Date(CREATED_AT.getTime() - i * 1000)
    }));
  }

  it("returns no cursor when the result set fits within the limit", () => {
    const page = paginate(rows(3), 5);
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeNull();
  });

  it("returns no cursor when the result set exactly fills the limit", () => {
    const page = paginate(rows(5), 5);
    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).toBeNull();
  });

  it("trims the lookahead row and emits a cursor when more rows exist", () => {
    const page = paginate(rows(6), 5);
    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).not.toBeNull();
  });

  it("anchors the next cursor on the last returned row, not the lookahead row", () => {
    const page = paginate(rows(6), 5);
    const decoded = decodeCursor(page.nextCursor as string);
    expect(decoded.id).toBe("id-4");
  });

  it("handles an empty result set", () => {
    const page = paginate([], 5);
    expect(page.items).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});

describe("parsePaginationParams", () => {
  it("defaults to a limit of 50 with no cursor", () => {
    expect(parsePaginationParams(new URLSearchParams())).toEqual({ cursor: null, limit: 50 });
  });

  it("coerces a numeric limit from the query string", () => {
    expect(parsePaginationParams(new URLSearchParams("limit=10")).limit).toBe(10);
  });

  it("accepts the documented maximum limit of 100", () => {
    expect(parsePaginationParams(new URLSearchParams("limit=100")).limit).toBe(100);
  });

  it("rejects a limit above the documented maximum", () => {
    expect(() => parsePaginationParams(new URLSearchParams("limit=101"))).toThrow(ApiError);
  });

  it("rejects a zero or negative limit", () => {
    expect(() => parsePaginationParams(new URLSearchParams("limit=0"))).toThrow(ApiError);
    expect(() => parsePaginationParams(new URLSearchParams("limit=-5"))).toThrow(ApiError);
  });
});
