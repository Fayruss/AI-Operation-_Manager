"use client";

import { Button } from "@/components/ui/button";
import { useResolveRiskSignal } from "@/lib/query/use-risk-signals";

/**
 * SAD §5 `POST /risk-signals/:id/resolve` — admin+ action from the
 * Operations Dashboard risk feed. Optimistic removal happens in
 * useResolveRiskSignal's onMutate (lib/query/use-risk-signals.ts) — this
 * component just triggers it; no local "resolved" state needed since the
 * signal disappears from the parent list's cache immediately.
 */
export function ResolveRiskButton({ signalId }: { signalId: string }) {
  const mutation = useResolveRiskSignal();

  return (
    <Button variant="secondary" size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate({ id: signalId })}>
      {mutation.isPending ? "Resolving…" : "Resolve"}
    </Button>
  );
}
