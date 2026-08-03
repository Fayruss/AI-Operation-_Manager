"use client";

import { Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { useUiStore } from "@/stores/ui-store";

/** Design System §7 mobile behavior: sidebar becomes a bottom/side sheet below `lg`. */
export function MobileNav() {
  const { mobileNavOpen, setMobileNavOpen } = useUiStore();

  return (
    <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-72 flex-col p-0">
        <SheetHeader className="flex-row items-center gap-2 border-b border-border px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-info text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <SheetTitle>AI Ops Manager</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-2">
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
