import { z } from "zod";

/**
 * SAD §13.1/§13.3 `contextEntity` — set by the AI Copilot (SAD §13.3) when
 * a page-scoped question is asked, or omitted for a plain Chat Workspace
 * question. `type` is free-text (mirrors `memory_entries.entity_type`'s
 * precedent) rather than a closed enum since new page types shouldn't
 * require a schema migration.
 */
export const chatContextEntitySchema = z.object({
  type: z.string().min(1).max(50),
  id: z.string().uuid()
});

/** POST /api/v1/chat — send a message (SAD §13.1). `sessionId: null`/omitted starts a new session. */
export const sendChatMessageSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  message: z.string().min(1).max(4000),
  contextEntity: chatContextEntitySchema.optional()
});
export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;

/** GET /api/v1/chat/sessions — Chat Workspace history list, cursor-paginated per API Contract Global Conventions. */
export const listChatSessionsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});
export type ListChatSessionsQuery = z.infer<typeof listChatSessionsQuerySchema>;
