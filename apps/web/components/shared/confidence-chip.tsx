import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";

/**
 * Component Spec: ConfidenceChip — "Surfaces AI decision confidence inline
 * wherever agent output is shown (SAD §13.8)." Renders nothing if
 * `confidence` is null (non-AI-sourced content) per the spec's stated
 * Loading/Error behavior — this is intentionally not conditionally
 * rendered by callers so every call site gets that behavior for free.
 */
export interface ConfidenceChipProps {
  confidence: number | null | undefined;
  rationale?: string | null;
  /** Org-configured, default 0.7 (SAD §13.8/§9.1's classifierThreshold). */
  threshold?: number;
}

export function ConfidenceChip({ confidence, rationale, threshold = 0.7 }: ConfidenceChipProps) {
  if (confidence === null || confidence === undefined) return null;

  const percent = Math.round(confidence * 100);
  const tier = confidence >= 0.9 ? "high" : confidence >= threshold ? "medium" : "low";
  const ariaLabel = rationale ? `AI confidence: ${percent} percent. ${rationale}` : `AI confidence: ${percent} percent`;

  const chip = (
    <Badge
      variant={tier === "low" ? "warning" : "info"}
      className={cn(tier === "medium" && "opacity-80", tier === "low" && "border-warning/40")}
      aria-label={ariaLabel}
    >
      {percent}%
    </Badge>
  );

  if (!rationale) return chip;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent>{rationale}</TooltipContent>
    </Tooltip>
  );
}
