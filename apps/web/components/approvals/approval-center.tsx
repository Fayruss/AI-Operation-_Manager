"use client";

import { useState } from "react";
import { Bot, CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfidenceChip } from "@/components/shared/confidence-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { usePendingApprovals, useDecideApproval } from "@/lib/query/use-approvals";
import type { AgentRunDto } from "@/lib/api/dto";

const AGENT_LABEL: Record<string, string> = {
  classifier: "Email Classifier",
  chat: "Chat Workspace",
  summarizer: "Meeting Summarizer",
  risk: "Risk Detection",
  report: "Reporting",
  reply_draft: "Reply Draft"
};

/**
 * Only these agents have a documented execute-on-approval branch in
 * `POST /agents/:name/approve`. A run from any other agent can be shown for
 * visibility but not decided here — deciding it would hit the route's
 * `AGENT_NOT_FOUND`, so the buttons are withheld rather than offered and
 * then failing.
 */
const DECIDABLE_AGENTS = new Set(["classifier", "chat"]);

/** Pulls a human-readable summary out of the agent's structured output without assuming one agent's shape. */
function describeProposal(run: AgentRunDto): string {
  const output = run.output;
  if (!output) return "Proposed action awaiting review.";

  const suggestedTask = output.suggested_task;
  if (suggestedTask && typeof suggestedTask === "object" && "title" in suggestedTask) {
    return `Create task: “${String((suggestedTask as { title: unknown }).title)}”`;
  }
  if (typeof output.summary === "string") return output.summary;
  if (typeof output.answer === "string") return output.answer;
  return "Proposed action awaiting review.";
}

/**
 * Implementation Guide Phase 10 — "agent approval flows". A central queue
 * for every run parked at `awaiting_approval`, which previously could only
 * be actioned inline from a chat bubble.
 *
 * The approval gate itself is enforced server-side (SAD §8.7/§9.5); this
 * surface only presents the decision.
 */
export function ApprovalCenter() {
  const query = usePendingApprovals();
  const runs = query.data?.items ?? [];

  if (query.isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading pending approvals…</span>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <p role="alert" className="rounded-md border border-danger/40 bg-danger/5 p-4 text-sm text-danger">
        {query.error.message}
      </p>
    );
  }

  if (runs.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Nothing awaiting approval"
        description="When an AI action falls below your organization's confidence threshold, it waits here for a human decision."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {runs.map((run) => (
        <li key={run.id}>
          <ApprovalCard run={run} />
        </li>
      ))}
    </ul>
  );
}

function ApprovalCard({ run }: { run: AgentRunDto }) {
  const decide = useDecideApproval();
  const [note, setNote] = useState("");
  const decidable = DECIDABLE_AGENTS.has(run.agentName);

  function submit(decision: "approved" | "rejected") {
    decide.mutate({
      agentRunId: run.id,
      agentName: run.agentName,
      decision,
      note: note.trim() || undefined
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-info/15 text-info" aria-hidden>
            <Bot className="h-3.5 w-3.5" />
          </span>
          <span className="text-sm font-medium">{AGENT_LABEL[run.agentName] ?? run.agentName}</span>
          <Badge variant="warning">Awaiting approval</Badge>
          <ConfidenceChip confidence={run.confidence} rationale={run.rationale} />
          <time className="ml-auto text-xs text-muted-foreground" dateTime={run.startedAt}>
            {new Date(run.startedAt).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            })}
          </time>
        </div>

        <p className="text-sm text-foreground">{describeProposal(run)}</p>

        {run.rationale && <p className="text-xs text-muted-foreground">{run.rationale}</p>}

        {decide.isError && (
          <p role="alert" className="text-sm text-danger">
            {decide.error.message}
          </p>
        )}

        {decidable ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor={`approval-note-${run.id}`}>
              Optional note explaining this decision
            </label>
            <input
              id={`approval-note-${run.id}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note…"
              className="flex h-9 flex-1 rounded-md border border-border bg-surface px-3 py-1 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => submit("approved")} disabled={decide.isPending}>
                {decide.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                )}
                Approve
              </Button>
              <Button size="sm" variant="ghost" onClick={() => submit("rejected")} disabled={decide.isPending}>
                <XCircle className="h-3.5 w-3.5" aria-hidden />
                Reject
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            This agent has no approval action wired yet — review it from the record it belongs to.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
