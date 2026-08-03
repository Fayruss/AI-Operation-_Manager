import "server-only";
import { OrganizationRepository } from "@/lib/repositories/organization-repository";
import { ProjectRepository } from "@/lib/repositories/project-repository";
import { RiskSignalRepository } from "@/lib/repositories/risk-signal-repository";
import { EmailMessageRepository } from "@/lib/repositories/email-message-repository";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { MemoryEntryRepository, type UpsertMemoryCandidateInput } from "@/lib/repositories/memory-entry-repository";
import { embedPendingEntries } from "@/lib/memory/embedding-pipeline";
import { writeAuditLog } from "@/lib/api/audit";
import { summarizerOutputSchema } from "@/lib/validation/agent";

/**
 * SAD §8.6 Memory Consolidation workflow (n8n Workflow Spec §6, Phase 7
 * requirement §3): "Pull high-signal events since last run (resolved
 * risks, completed projects, meeting decisions, agent_corrections) →
 * generate embeddings → upsert memory_entries → decay importance on
 * entries untouched >90 days." `agent_corrections` (SAD §16, the Learning
 * Loop) is a separate module not in this phase's scope (see CLAUDE.md:
 * "never invent architecture ahead of the docs" — no `agent_corrections`
 * table exists yet); everything else in that list is implemented below.
 *
 * Logging: one `agent_runs` summary row per run, matching n8n Workflow
 * Spec §6's explicit "single agent_runs summary row per nightly run"
 * (not one row per candidate) — plus a `memory.consolidation_run`
 * audit_log entry, since every memory-module mutation must be traceable
 * through both (Phase 7 requirement: "every memory operation is fully
 * traced through agent_runs and audit_log").
 */

const DECAY_STALE_DAYS = 90; // SAD §2.6/§8.6: "decay importance on entries untouched >90 days."
const DECAY_FACTOR = 0.9;
const DECAY_FLOOR = 0.05;
const MAX_EMBED_BATCHES_PER_RUN = 50;

export interface ConsolidationResult {
  orgId: string;
  candidatesFound: number;
  entriesCreated: number;
  entriesMerged: number;
  embedded: number;
  embeddingFailed: number;
  decayedCount: number;
  agentRunId: string | null;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function buildCandidates(orgId: string, since: Date): Promise<UpsertMemoryCandidateInput[]> {
  const [completedProjects, resolvedRisks, summarizerRuns, importantEmails] = await Promise.all([
    ProjectRepository.listCompletedSince(orgId, since),
    RiskSignalRepository.listResolvedSince(orgId, since),
    AgentRunRepository.listSuccessfulTopLevelByAgentSince(orgId, "summarizer", since),
    EmailMessageRepository.listImportantSince(orgId, since)
  ]);

  const candidates: UpsertMemoryCandidateInput[] = [];

  for (const project of completedProjects) {
    candidates.push({
      entityType: "project",
      entityId: project.id,
      sourceType: "task", // Project completion is derived from task-board state, not a standalone module of its own in SAD §2 — closest documented sourceType.
      sourceRefId: project.id,
      importance: 0.7,
      content: `Project "${project.name}" was completed.${project.targetDate ? ` Target date was ${project.targetDate.toISOString().slice(0, 10)}.` : ""}`,
      metadata: { projectName: project.name, status: project.status }
    });
  }

  for (const risk of resolvedRisks) {
    const detail = risk.detail as Record<string, unknown>;
    const rationale = typeof detail.rationale === "string" ? detail.rationale : null;
    candidates.push({
      entityType: risk.entityType,
      entityId: risk.entityId,
      sourceType: "risk_signal",
      sourceRefId: risk.id,
      importance: risk.severity === "high" ? 0.8 : risk.severity === "medium" ? 0.6 : 0.4,
      content: truncate(
        `Resolved ${risk.severity}-severity ${risk.signalType.replace("_", " ")} risk on ${risk.entityType} ${risk.entityId}.${rationale ? ` ${rationale}` : ""}`,
        1000
      ),
      metadata: { signalType: risk.signalType, severity: risk.severity }
    });
  }

  for (const run of summarizerRuns) {
    if (!run.meetingId) continue;
    const parsed = summarizerOutputSchema.safeParse(run.output);
    if (!parsed.success) continue;

    if (parsed.data.summary) {
      candidates.push({
        entityType: "meeting",
        entityId: run.meetingId,
        sourceType: "meeting",
        sourceRefId: run.meetingId,
        importance: 0.5,
        content: truncate(`Meeting summary: ${parsed.data.summary}`, 2000),
        metadata: { agentRunId: run.id }
      });
    }
    for (const decision of parsed.data.decisions) {
      candidates.push({
        entityType: "meeting",
        entityId: run.meetingId,
        sourceType: "meeting",
        sourceRefId: run.meetingId,
        importance: 0.6,
        content: truncate(`Decision: ${decision}`, 1000),
        metadata: { agentRunId: run.id }
      });
    }
  }

  for (const email of importantEmails) {
    candidates.push({
      entityType: "person",
      entityId: null,
      sourceType: "email",
      sourceRefId: email.id,
      importance: email.urgency === "critical" ? 0.75 : 0.55,
      content: truncate(
        `${email.urgency} urgency email from ${email.sender}: "${email.subject}"${email.bodySnippet ? ` — ${email.bodySnippet}` : ""}`,
        1000
      ),
      metadata: { sender: email.sender, urgency: email.urgency, intent: email.intent }
    });
  }

  return candidates;
}

/**
 * Runs the full nightly consolidation cycle for one org: gather candidates
 * since the last run, upsert (dedup/merge), embed the newly-pending
 * entries, decay stale importance, advance the checkpoint, and log both
 * `agent_runs` and `audit_log` for the run as a whole.
 */
export async function runConsolidationForOrg(orgId: string): Promise<ConsolidationResult> {
  const org = await OrganizationRepository.getById(orgId);
  const since = org.lastMemoryConsolidationAt ?? org.createdAt;
  const runStartedAt = new Date();

  const agentRun = await AgentRunRepository.start({
    orgId,
    agentName: "memory",
    triggerSource: "memory.consolidation.scheduled",
    input: { since: since.toISOString() }
  });

  try {
    const candidates = await buildCandidates(orgId, since);

    let entriesCreated = 0;
    let entriesMerged = 0;
    // Sequential, not Promise.all — upsertCandidate does a
    // findFirst-then-write dedup check per candidate; running the batch
    // concurrently would let two near-duplicate candidates both pass their
    // findFirst before either write lands, creating the exact duplicate
    // rows this loop exists to prevent. Consolidation runs nightly per org
    // (not on a request/response latency budget), so the sequential cost
    // is acceptable.
    for (const candidate of candidates) {
      const { created } = await MemoryEntryRepository.upsertCandidate(orgId, candidate);
      if (created) entriesCreated += 1;
      else entriesMerged += 1;
    }

    const { embedded, failed: embeddingFailed } = await embedPendingEntries(orgId, MAX_EMBED_BATCHES_PER_RUN);
    const decayedCount = await MemoryEntryRepository.decayStaleImportance(orgId, DECAY_STALE_DAYS, DECAY_FACTOR, DECAY_FLOOR);

    await OrganizationRepository.updateLastMemoryConsolidationAt(orgId, runStartedAt);

    await AgentRunRepository.markSuccess(agentRun.id, {
      output: { entriesUpserted: candidates.length, entriesCreated, entriesMerged, embedded, embeddingFailed, decayedCount },
      timeSavedMinutes: 0 // Consolidation is infrastructure, not a human-facing time-save (unlike classifier/summarizer/risk/report) — omitted from ROI metrics (SAD §13.4) intentionally.
    });

    await writeAuditLog({
      orgId,
      actorId: null,
      actorType: "system",
      action: "memory.consolidation_run",
      resourceType: "organization",
      resourceId: orgId,
      metadata: { since: since.toISOString(), candidatesFound: candidates.length, entriesCreated, entriesMerged, embedded, embeddingFailed, decayedCount }
    });

    return {
      orgId,
      candidatesFound: candidates.length,
      entriesCreated,
      entriesMerged,
      embedded,
      embeddingFailed,
      decayedCount,
      agentRunId: agentRun.id
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await AgentRunRepository.markFailed(agentRun.id, message);
    // Matches n8n Workflow Spec §6's "partial success is acceptable... never
    // a hard failure surfaced to users" for per-batch embedding issues, but
    // a failure in candidate-gathering itself (a genuine bug, not a
    // provider hiccup) should still surface to the caller (cron route logs
    // it per-org and continues, same pattern as risk-scan/weekly-report).
    throw error;
  }
}
