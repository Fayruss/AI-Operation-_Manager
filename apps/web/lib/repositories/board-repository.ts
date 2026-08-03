import "server-only";
import { prisma, type Board } from "@ai-ops/database";
import { ApiError } from "@/lib/api/errors";
import { writeAuditLog } from "@/lib/api/audit";
import type { CreateBoardInput } from "@/lib/validation/board";

export const BoardRepository = {
  async listByProject(orgId: string, projectId: string): Promise<Board[]> {
    return prisma.board.findMany({ where: { orgId, projectId }, orderBy: { createdAt: "asc" } });
  },

  /** Cross-tenant or nonexistent board → identical 404, no existence leakage (API Contract Pattern A). */
  async getById(orgId: string, boardId: string): Promise<Board> {
    const board = await prisma.board.findFirst({ where: { id: boardId, orgId } });
    if (!board) {
      throw new ApiError("NOT_FOUND", "Board not found", undefined, "BOARD_NOT_FOUND");
    }
    return board;
  },

  async create(orgId: string, actorId: string, input: CreateBoardInput): Promise<Board> {
    // Validate the project exists in this org before creating the board —
    // same "explicit 403/404 at the API layer over a bare DB error" pattern
    // API Contract Pattern A specifies for tasks→boards.
    const project = await prisma.project.findFirst({ where: { id: input.projectId, orgId } });
    if (!project) {
      throw new ApiError("NOT_FOUND", "Project not found", undefined, "PROJECT_NOT_FOUND");
    }

    const board = await prisma.board.create({
      data: { orgId, projectId: input.projectId, name: input.name, type: input.type }
    });

    await writeAuditLog({
      orgId,
      actorId,
      action: "board.created",
      resourceType: "board",
      resourceId: board.id,
      metadata: { name: board.name, projectId: board.projectId }
    });

    return board;
  }
};
