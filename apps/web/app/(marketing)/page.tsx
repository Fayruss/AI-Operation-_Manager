import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** SAD §6.1: `/` → marketing/landing (public). Minimal placeholder for Phase 1. */
export default function MarketingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-info text-white">
        <Sparkles className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-[28px] font-semibold leading-9">AI Operations Manager</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          The AI-native operations layer that reads your email and meetings, creates and tracks
          tasks, flags risk early, and reports up — with a human approving every high-stakes action.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/signup">
            Get started <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </main>
  );
}
