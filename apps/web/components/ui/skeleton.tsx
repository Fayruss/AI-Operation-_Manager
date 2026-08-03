import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/** Design System §1: "every state is designed" — skeletons match final layout shape. */
function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-surface-raised", className)} {...props} />;
}

export { Skeleton };
