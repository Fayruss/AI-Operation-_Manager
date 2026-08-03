import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <div className="rounded-full bg-surface-raised p-4">
        <Compass className="h-6 w-6 text-muted-foreground" />
      </div>
      <h1 className="text-[22px] font-semibold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Button asChild>
        <Link href="/app/dashboard">Back to dashboard</Link>
      </Button>
    </main>
  );
}
