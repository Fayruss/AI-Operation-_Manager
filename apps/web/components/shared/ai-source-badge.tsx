import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Design System §6: `AiSourceBadge` — "classified, suggested, auto-created.
 * `--info` blue, `Sparkles` icon, hover shows confidence (§8)." Distinct
 * from `ConfidenceChip` (which shows the number): this badge marks *that*
 * something is AI-sourced at all, per §2.3's "`--info` is reserved
 * exclusively for AI-generated/AI-sourced content markers... so users
 * learn to recognize 'this came from AI' at a glance."
 */
export type AiSourceKind = "classified" | "suggested" | "auto-created";

const LABEL: Record<AiSourceKind, string> = {
  classified: "AI-classified",
  suggested: "AI-suggested",
  "auto-created": "AI-created"
};

export function AiSourceBadge({ kind, confidence }: { kind: AiSourceKind; confidence?: number | null }) {
  const badge = (
    <Badge variant="info" aria-label={LABEL[kind]}>
      <Sparkles className="h-3 w-3" aria-hidden />
      {LABEL[kind]}
    </Badge>
  );

  if (confidence === null || confidence === undefined) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>{Math.round(confidence * 100)}% confidence</TooltipContent>
    </Tooltip>
  );
}
