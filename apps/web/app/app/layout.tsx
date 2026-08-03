import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { CommandPalette } from "@/components/command/command-palette";
import { getCurrentUser } from "@/lib/auth/get-current-user";

/**
 * SAD §6.2: root `/app` layout — persistent left sidebar + top bar + main
 * content slot. Session guard already ran in middleware.ts; this layout is
 * purely presentational composition.
 *
 * Design System §10 accessibility: skip-to-content link is the first
 * focusable element so keyboard users can bypass the sidebar/topbar nav.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar user={user} />
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <ChatPanel />
      <CommandPalette />
    </div>
  );
}
