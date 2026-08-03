"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/session";
import { createBoardSchema } from "@/lib/validation/board";
import { BoardRepository } from "@/lib/repositories/board-repository";
import { apiErrorResponse } from "@/lib/api/errors";

export interface BoardActionState {
  error: string | null;
}

/**
 * Server Action for creating a board from the Project detail page — same
 * rationale as actions/projects.ts: a pure internal UI mutation, no
 * external consumer needs this path, and it calls the same
 * BoardRepository the REST route (`POST /api/v1/boards`) uses.
 */
export async function createBoardAction(_prevState: BoardActionState, formData: FormData): Promise<BoardActionState> {
  const parsed = createBoardSchema.safeParse({
    projectId: formData.get("projectId"),
    name: formData.get("name"),
    type: formData.get("type") || undefined
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const ctx = await getAuthContext();
    await BoardRepository.create(ctx.orgId, ctx.userId, parsed.data);
  } catch (error) {
    const response = apiErrorResponse(error);
    const body = (await response.json()) as { error: { message: string } };
    return { error: body.error.message };
  }

  revalidatePath(`/app/projects/${parsed.data.projectId}`);
  return { error: null };
}
