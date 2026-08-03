"use client";

import Link from "next/link";
import { ChevronsLeft, ChevronsRight, Sparkles } from "lucide-react";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils/cn";

/**
 * SAD §6.2: persistent left sidebar, collapses to icon-rail below `lg`
 * (Design System §7: 240px expanded / 64px icon-rail collapsed).
 * Hidden below `lg` in favor of the mobile Sheet nav (mobile-nav.tsx).
 */
export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();

  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-panel lg:flex",
        sidebarCollapsed ? "w-16" : "w-60"
      )}
    >
      <div className={cn("flex h-16 items-center gap-2 px-4", sidebarCollapsed && "justify-center px-0")}>
        <Link href="/app/dashboard" className="flex items-center gap-2 overflow-hidden">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-info text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          {!sidebarCollapsed && <span className="truncate text-sm font-semibold">AI Ops Manager</span>}
        </Link>
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto scrollbar-thin py-2">
        <SidebarNav collapsed={sidebarCollapsed} />
      </div>

      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          size="icon"
          className="w-full"
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleSidebar}
        >
          {sidebarCollapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
