import "server-only";
import { callClaudeJson, ClaudeApiError } from "@/lib/ai/claude-client";
import { loadPrompt } from "@/lib/ai/prompt-loader";
import { summarizerOutputSchema, type SummarizerOutput } from "@/lib/validation/agent";
import { AgentRunRepository } from "@/lib/repositories/agent-run-repository";
import { retrieveMemoryContext, formatMemoryContext } from "@/lib/memory/memory-retrieval-service";

/**
 * SAD §9.2 Summarizer Agent. Direct-invocation stand-in for n8n Workflow
 * Spec §3 nodes 3–4 (chunk if >100k tokens → Claude call, looped per chunk,
 * then a final reduce call) — n8n itself is out of scope; the map-reduce
 * orchestration and multi-step `agent_runs` trace (parent + per-chunk +
 * reduce, per the n8n spec's own schema note on `parent_run_id`) happen
 * here instead.
 *
 * ~4 chars/token is a standard rough heuristic (no real tokenizer
 * dependency added for this foundation phase) — 100k tokens ≈ 400k chars.
 */
const CHARS_PER_TOKEN_ESTIMATE = 4;
const CHUNK_TOKEN_THRESHOLD = 100_000;
const CHUNK_SIZE_CHARS = CHUNK_TOKEN_THRESHOLD * CHARS_PER_TOKEN_ESTIMATE;

export interface RunSummarizerInput {
  orgId: string;
  meetingId: string;
  title: string;
  transcript: string;
}

export interface RunSummarizerResult {
  agentRunId: string;
  output: SummarizerOutput;
}

function chunkTranscript(transcript: string): string[] {
  if (transcript.length <= CHUNK_SIZE_CHARS) return [transcript];
  const chunks: string[] = [];
  for (let i = 0; i < transcript.length; i += CHUNK_SIZE_CHARS) {
    chunks.push(transcript.slice(i, i + CHUNK_SIZE_CHARS));
  }
  return chunks;
}

async function summarizeSingle(title: string, transcriptPortion: string, isChunk: boolean, memoryContext: string | null): Promise<{
  data: SummarizerOutput;
  inputTokens: number;
  outputTokens: number;
}> {
  const prefix = isChunk
    ? `This is one chunk of a longer transcript for meeting "${title}". Summarize only this chunk.\n\n`
    : `Meeting: "${title}"\n\n`;
  // Memory context (SAD §9.2: "reads prior meetings... to maintain
  // continuity") is only relevant to a real summarization call, never a
  // per-chunk map step — a chunk needs the raw transcript segment, not
  // organizational history, matching the n8n spec's "keep the map step
  // lean" reasoning for chunked processing.
  const memorySuffix = !isChunk && memoryContext ? `\n\nRelevant prior meetings/decisions (most similar first, for continuity — reference but don't repeat unless still relevant):\n${memoryContext}` : "";

  return callClaudeJson({
    systemPrompt: loadPrompt("summarizer"),
    userPrompt: `${prefix}${transcriptPortion}${memorySuffix}`,
    schema: summarizerOutputSchema,
    temperature: 0.3,
    maxTokens: 2048
  });
}

/** Combines chunk-level summaries into one final structured result (the "reduce" step). */
async function reduceChunkSummaries(title: string, chunkOutputs: SummarizerOutput[], memoryContext: string | null): Promise<{
  data: SummarizerOutput;
  inputTokens: number;
  outputTokens: number;
}> {
  const combined = chunkOutputs
    .map(
      (chunk, i) =>
        `Chunk ${i + 1} summary: ${chunk.summary}\nChunk ${i + 1} action items: ${JSON.stringify(chunk.action_items)}\nChunk ${i + 1} decisions: ${JSON.stringify(chunk.decisions)}`
    )
    .join("\n\n");
  const memorySuffix = memoryContext ? `\n\nRelevant prior meetings/decisions (most similar first, for continuity — reference but don't repeat unless still relevant):\n${memoryContext}` : "";

  return callClaudeJson({
    systemPrompt: loadPrompt("summarizer"),
    userPrompt: `Meeting: "${title}"\n\nBelow are summaries of consecutive chunks of this meeting's transcript. Consolidate them into one final summary, deduplicating any repeated action items or decisions.\n\n${combined}${memorySuffix}`,
    schema: summarizerOutputSchema,
    temperature: 0.3,
    maxTokens: 2048
  });
}

export async function runSummarizerAgent(input: RunSummarizerInput): Promise<RunSummarizerResult> {
  const parentRun = await AgentRunRepository.start({
    orgId: input.orgId,
    agentName: "summarizer",
    triggerSource: "meeting.ingested",
    meetingId: input.meetingId,
    input: { meetingId: input.meetingId, title: input.title, transcriptLength: input.transcript.length }
  });

  try {
    // SAD §9.2: "reads prior meetings for the same project to maintain
    // continuity." No `projectId` exists on `meetings` (SAD §4's
    // documented schema doesn't link one), so this is a title-similarity
    // semantic query over `entityType: "meeting"` memory rather than a
    // strict per-project filter — the closest achievable approximation of
    // "same project" without a schema change this phase doesn't own.
    const { items: memoryItems } = await retrieveMemoryContext(input.orgId, input.title, { entityType: "meeting", topK: 5 });
    const memoryContext = formatMemoryContext(memoryItems);

    const chunks = chunkTranscript(input.transcript);
    let finalResult: { data: SummarizerOutput; inputTokens: number; outputTokens: number };
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    if (chunks.length === 1) {
      finalResult = await summarizeSingle(input.title, chunks[0] ?? "", false, memoryContext);
      totalInputTokens += finalResult.inputTokens;
      totalOutputTokens += finalResult.outputTokens;
    } else {
      // Map step: per-chunk retry is inherited from claude-client's own
      // transient-failure retry — a failed chunk after those retries fails
      // the whole run rather than silently producing a partial summary
      // (n8n Workflow Spec §3's staging-write cost-control nuance is a
      // queue-based optimization that doesn't apply to this synchronous,
      // in-process pipeline).
      const chunkOutputs: SummarizerOutput[] = [];
      for (const [index, chunk] of chunks.entries()) {
        const chunkRun = await AgentRunRepository.start({
          orgId: input.orgId,
          agentName: "summarizer",
          triggerSource: "meeting.ingested.chunk",
          meetingId: input.meetingId,
          parentRunId: parentRun.id,
          input: { chunkIndex: index, chunkLength: chunk.length }
        });

        try {
          const chunkResult = await summarizeSingle(input.title, chunk, true, null);
          await AgentRunRepository.markSuccess(chunkRun.id, {
            output: chunkResult.data,
            inputTokens: chunkResult.inputTokens,
            outputTokens: chunkResult.outputTokens
          });
          chunkOutputs.push(chunkResult.data);
          totalInputTokens += chunkResult.inputTokens;
          totalOutputTokens += chunkResult.outputTokens;
        } catch (error) {
          const message = error instanceof ClaudeApiError ? error.message : String(error);
          await AgentRunRepository.markFailed(chunkRun.id, message);
          throw error;
        }
      }

      // Reduce step: its own child run in the trace.
      const reduceRun = await AgentRunRepository.start({
        orgId: input.orgId,
        agentName: "summarizer",
        triggerSource: "meeting.ingested.reduce",
        meetingId: input.meetingId,
        parentRunId: parentRun.id,
        input: { chunkCount: chunks.length }
      });

      try {
        finalResult = await reduceChunkSummaries(input.title, chunkOutputs, memoryContext);
        await AgentRunRepository.markSuccess(reduceRun.id, {
          output: finalResult.data,
          inputTokens: finalResult.inputTokens,
          outputTokens: finalResult.outputTokens
        });
        totalInputTokens += finalResult.inputTokens;
        totalOutputTokens += finalResult.outputTokens;
      } catch (error) {
        const message = error instanceof ClaudeApiError ? error.message : String(error);
        await AgentRunRepository.markFailed(reduceRun.id, message);
        throw error;
      }
    }

    await AgentRunRepository.markSuccess(parentRun.id, {
      output: finalResult.data,
      // SAD §13.4: documented per-agent-type constant — meeting summarization's isn't specified exactly, 15 min is a reasonable default for "read transcript + write summary + file action items" time saved.
      timeSavedMinutes: 15,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens
    });

    return { agentRunId: parentRun.id, output: finalResult.data };
  } catch (error) {
    const message = error instanceof ClaudeApiError ? error.message : String(error);
    await AgentRunRepository.markFailed(parentRun.id, message);
    throw error;
  }
}
