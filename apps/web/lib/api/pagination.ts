import "server-only";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";

/** API Contract Global Conventions: cursor-based, ?cursor=<opaque>&limit=50 (max 100). */
export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorPosition {
  createdAt: Date;
  id: string;
}

/**
 * Opaque cursor = base64("<createdAt ISO>|<id>"). Encodes both fields so
 * pagination stays correct (stable, no skipped/duplicated rows) even though
 * rows are ordered by createdAt desc with non-sequential UUID PKs.
 */
export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(`${position.createdAt.toISOString()}|${position.id}`, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPosition {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!iso || !id) throw new Error("malformed");
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) throw new Error("malformed");
    return { createdAt, id };
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Invalid pagination cursor");
  }
}

/** Prisma `where` fragment for "rows strictly after this cursor" under `createdAt desc, id desc` ordering. */
export function cursorWhere(cursor: CursorPosition | null): Record<string, unknown> {
  if (!cursor) return {};
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } }
    ]
  };
}

export function paginate<T extends { id: string; createdAt: Date }>(rows: T[], limit: number): Page<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null };
}

export function parsePaginationParams(searchParams: URLSearchParams): {
  cursor: CursorPosition | null;
  limit: number;
} {
  const result = paginationQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined
  });
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Invalid pagination parameters", { issues: result.error.issues });
  }
  return { cursor: result.data.cursor ? decodeCursor(result.data.cursor) : null, limit: result.data.limit };
}
