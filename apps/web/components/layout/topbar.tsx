import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationCenter } from "@/components/layout/notification-center";
import { OrgSwitcher } from "@/components/layout/org-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { Separator } from "@/components/ui/separator";
import type { AppUser } from "@ai-ops/types";

/** SAD §6.2: top bar (org switcher, search, notification bell). */
export function Topbar({ user }: { user: AppUser }) {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6">
      <MobileNav />
      <OrgSwitcher />
      <div className="flex-1" />
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <NotificationCenter />
        <Separator orientation="vertical" className="mx-1 h-6" />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
