import { z } from "zod";
import { taskPrioritySchema } from "@/lib/validation/task";

/** Mirrors prompts/classifier.md's documented output contract exactly (SAD §9.1). */
export const classifierOutputSchema = z.object({
  urgency: z.enum(["low", "medium", "high", "critical"]),
  intent: z.enum(["task", "question", "fyi", "complaint", "other"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(500),
  suggested_task: z
    .object({
      title: z.string().min(1).max(200),
      priority: taskPrioritySchema
    })
    .nullable()
});
export type ClassifierOutput = z.infer<typeof classifierOutputSchema>;

/** SAD §9.2 Summarizer Agent output contract, mirrored in prompts/summarizer.md. */
export const summarizerActionItemSchema = z.object({
  description: z.string().min(1).max(500),
  suggested_owner: z.string().max(200).nullable(),
  due_hint: z.string().max(100).nullable()
});

export const summarizerOutputSchema = z.object({
  summary: z.string().min(1).max(5000),
  action_items: z.array(summarizerActionItemSchema),
  decisions: z.array(z.string().min(1).max(500))
});
export type SummarizerOutput = z.infer<typeof summarizerOutputSchema>;

/** SAD §5 `POST /webhooks/n8n/callback` — "n8n workflow result callback... writes agent_runs." */
export const n8nCallbackSchema = z.object({
  agentRunId: z.string().uuid().optional(),
  orgId: z.string().uuid(),
  agentName: z.enum(["classifier", "summarizer", "risk", "report", "reply_draft"]),
  triggerSource: z.string().min(1).max(200).default("n8n.workflow"),
  status: z.enum(["success", "failed", "awaiting_approval"]),
  output: z.unknown().optional(),
  error: z.string().max(2000).optional(),
  confidence: z.number().min(0).max(1).optional(),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional()
});
export type N8nCallbackInput = z.infer<typeof n8nCallbackSchema>;

/** SAD §9.3 Risk Agent output contract, mirrored in prompts/risk.md. Batched — one call scores the whole cycle's candidates (n8n Workflow Spec §4). */
export const riskAgentResultSchema = z.object({
  index: z.number().int().min(0),
  rationale: z.string().min(1).max(500),
  recommended_action: z.string().min(1).max(300)
});

export const riskAgentOutputSchema = z.object({
  results: z.array(riskAgentResultSchema)
});
export type RiskAgentOutput = z.infer<typeof riskAgentOutputSchema>;

/** SAD §9.4 Report Agent output contract, mirrored in prompts/report.md. */
export const reportAgentOutputSchema = z.object({
  executiveSummary: z.string().min(1).max(2000),
  highlights: z.array(z.string().min(1).max(300)).max(10),
  risks: z.array(z.string().min(1).max(300)).max(10),
  recommendations: z.array(z.string().min(1).max(300)).max(10),
  /** SAD §9.4: "memory of prior report (avoid repetitive phrasing, show trend deltas)" — null when there's no previous report to compare against. */
  trendComparison: z.string().max(500).nullable()
});
export type ReportAgentOutput = z.infer<typeof reportAgentOutputSchema>;

/**
 * SAD §13.1 Chat Agent output contract, mirrored in prompts/chat.md.
 * `referenced_entity_indices` are positions into the candidate-entity list
 * the agent was grounded against (chat-agent.ts's `buildCandidateBlock`) —
 * never raw IDs the model could invent, so grounding is enforced
 * structurally rather than only by instruction (Test Plan §4's "Chat/
 * Planner grounding eval: assert referenced_entities... actually exist").
 * `proposed_action` mirrors the Reply-Draft/§9.5 pattern: the agent never
 * executes, it only proposes — chat-service.ts turns an approved-shape
 * proposal into an `agent_runs` row with `status=awaiting_approval`.
 */
export const chatAgentOutputSchema = z.object({
  answer: z.string().min(1).max(4000),
  referenced_entity_indices: z.array(z.number().int().min(0)).max(20),
  proposed_action: z
    .object({
      type: z.enum(["notify_user"]),
      target_user_index: z.number().int().min(0),
      summary: z.string().min(1).max(300)
    })
    .nullable()
});
export type ChatAgentOutput = z.infer<typeof chatAgentOutputSchema>;

/** API Contract Pattern D — `POST /agents/:name/approve`. */
export const approveAgentRunSchema = z.object({
  agentRunId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(2000).optional()
});
export type ApproveAgentRunInput = z.infer<typeof approveAgentRunSchema>;
