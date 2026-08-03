"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth/session";
import { createProjectSchema } from "@/lib/validation/project";
import { ProjectRepository } from "@/lib/repositories/project-repository";
import { apiErrorResponse } from "@/lib/api/errors";

export interface ProjectActionState {
  error: string | null;
}

/**
 * Server Action for the Projects page's "New project" form — a pure
 * internal UI mutation with no external consumer (n8n/Command Center don't
 * need this path), so CLAUDE.md's "use Server Actions where appropriate"
 * applies directly. Calls the same ProjectRepository the REST route uses
 * (`POST /api/v1/projects`), so there's exactly one place the business
 * logic lives (CLAUDE.md: "never duplicate logic").
 */
export async function createProjectAction(
  _prevState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    status: formData.get("status") || undefined,
    health: formData.get("health") || undefined,
    startDate: formData.get("startDate") || undefined,
    targetDate: formData.get("targetDate") || undefined
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const ctx = await getAuthContext();
    await ProjectRepository.create(ctx.orgId, ctx.userId, parsed.data);
  } catch (error) {
    // Reuse the same error-envelope logic conceptually — extract just the message for the form.
    const response = apiErrorResponse(error);
    const body = (await response.json()) as { error: { message: string } };
    return { error: body.error.message };
  }

  revalidatePath("/app/projects");
  return { error: null };
}
