"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SETTINGS_ITEM } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils/cn";

/**
 * Shared between the desktop Sidebar and the mobile Sheet nav so the two
 * never drift (SAD §6.2 sidebar, §7.11 mobile bottom-sheet nav).
 */
export function SidebarNav({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-micro",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
              collapsed && "justify-center px-0"
            )}
            title={collapsed ? item.label : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </Link>
        );
      })}

      <div className="mt-auto pt-2">
        <Link
          href={SETTINGS_ITEM.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-micro hover:bg-surface-raised hover:text-foreground",
            pathname.startsWith(SETTINGS_ITEM.href) && "bg-primary/15 text-primary",
            collapsed && "justify-center px-0"
          )}
          title={collapsed ? SETTINGS_ITEM.label : undefined}
        >
          <SETTINGS_ITEM.icon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{SETTINGS_ITEM.label}</span>}
        </Link>
      </div>
    </nav>
  );
}
