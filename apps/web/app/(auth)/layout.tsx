import type { ReactNode } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background px-4">
      <Link href="/" className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-info text-white">
          <Sparkles className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">AI Operations Manager</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
