import {
  BarChart3,
  Brain,
  Calendar,
  FileText,
  Inbox,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Trello
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import type { NavItemKey } from "@ai-ops/types";

/** SAD §6.1 Page Map — the seven dashboards + Settings, in nav order. */
export interface NavItem {
  key: NavItemKey;
  label: string;
  /** Typed against `experimental.typedRoutes` so nav targets are checked at build time. */
  href: Route;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Executive Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { key: "projects", label: "Projects", href: "/app/projects", icon: Trello },
  { key: "emails", label: "Email Intelligence", href: "/app/emails", icon: Inbox },
  { key: "meetings", label: "Meetings", href: "/app/meetings", icon: Calendar },
  { key: "operations", label: "Operations", href: "/app/operations", icon: ShieldAlert },
  { key: "reports", label: "Reports", href: "/app/reports", icon: FileText },
  { key: "memory", label: "Memory Explorer", href: "/app/memory", icon: Brain },
  { key: "analytics", label: "Analytics", href: "/app/analytics", icon: BarChart3 }
];

export const SETTINGS_ITEM: NavItem = {
  key: "settings",
  label: "Settings",
  href: "/app/settings",
  icon: Settings
};
