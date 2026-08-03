import { z } from "zod";

/**
 * SAD §5 `POST /meetings/ingest` — "system (HMAC), triggers Summarizer
 * Agent." Mirrors the email webhook's shape: a transcript provider
 * (Zoom/Meet/Otter-style) posts here once a transcript is ready.
 */
export const ingestMeetingSchema = z.object({
  title: z.string().min(1, "title is required").max(300),
  transcript: z.string().min(1, "transcript is required"),
  occurredAt: z.string().datetime({ message: "occurredAt must be ISO 8601" }),
  participantEmails: z.array(z.string().email()).optional()
});
export type IngestMeetingInput = z.infer<typeof ingestMeetingSchema>;

export const listMeetingsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional()
});
