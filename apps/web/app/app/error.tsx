"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/** SAD §6.6: error.tsx boundary per route segment with retry action. */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-danger/40 bg-danger/5 px-6 py-16 text-center">
      <div className="mb-4 rounded-full bg-danger/10 p-3">
        <AlertTriangle className="h-6 w-6 text-danger" />
      </div>
      <h3 className="text-[17px] font-semibold">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        This section failed to load. You can retry — the rest of the app is unaffected.
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
