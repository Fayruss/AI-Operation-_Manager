import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { ApiError } from "@/lib/api/errors";

/** Parses + Zod-validates a JSON request body; malformed JSON is a 400, not a 500. */
export async function parseJsonBody<Schema extends z.ZodTypeAny>(
  request: NextRequest,
  schema: Schema
): Promise<z.infer<Schema>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Request body must be valid JSON");
  }
  return schema.parse(raw);
}

export function getIdempotencyKey(request: NextRequest): string | null {
  return request.headers.get("Idempotency-Key");
}
