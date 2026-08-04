"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import {
  Calendar,
  FileBarChart,
  Gauge,
  LayoutDashboard,
  Mail,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Trello
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { useGenerateReport } from "@/lib/query/use-reports";
import { useProjects } from "@/lib/query/use-projects";
import { useSendChatMessage } from "@/lib/query/use-chat";
import { useChatStore } from "@/stores/chat-store";

/**
 * SAD §13.2 Command Center — "Zero-navigation control surface... Every
 * command maps to an existing API route from Section 5 — this is
 * intentionally a thin client feature, not new backend surface." Commands
 * below are only ones that map to real, already-wired endpoints
 * (`POST /projects`, `POST /reports/generate`, existing nav routes, and
 * the Chat Workspace's intent-parser fallthrough) — "Notify everyone" and
 * "Summarize emails" from the SAD's illustrative table aren't included
 * because their backing routes (`POST /notifications` broadcast; a
 * standalone email-summary view) don't exist yet in this codebase, and a
 * command that doesn't actually do anything would violate CLAUDE.md's
 * "no placeholder implementations."
 */
const NAV_COMMANDS: ReadonlyArray<{ label: string; href: Route; icon: LucideIcon }> = [
  { label: "Executive Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Email Intelligence", href: "/app/emails", icon: Mail },
  { label: "Projects", href: "/app/projects", icon: Trello },
  { label: "Meetings", href: "/app/meetings", icon: Calendar },
  { label: "Operations", href: "/app/operations", icon: Gauge },
  { label: "Reports", href: "/app/reports", icon: FileBarChart },
  { label: "Analytics", href: "/app/analytics", icon: Sparkles },
  { label: "Settings", href: "/app/settings", icon: Settings }
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const router = useRouter();

  const projectsQuery = useProjects();
  const generateReportMutation = useGenerateReport();
  const sendChatMutation = useSendChatMessage();
  const { setOpen: setChatOpen, setActiveSessionId } = useChatStore();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function runAndClose(action: () => void) {
    setOpen(false);
    setSearch("");
    action();
  }

  function askChat() {
    const question = search.trim();
    if (!question) return;
    runAndClose(() => {
      sendChatMutation.mutate(
        { sessionId: null, message: question },
        { onSuccess: (data) => { setActiveSessionId(data.session.id); setChatOpen(true); } }
      );
    });
  }

  const projects = projectsQuery.data?.items ?? [];

  return (
    <>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search or ask anything… (⌘K)" value={search} onValueChange={setSearch} />
        <CommandList>
          <CommandEmpty>
            {search.trim() ? (
              <button
                onClick={askChat}
                className="flex w-full items-center justify-center gap-2 py-2 text-sm text-info hover:underline"
              >
                <Send className="h-3.5 w-3.5" />
                Ask the AI: &ldquo;{search.trim()}&rdquo;
              </button>
            ) : (
              "No results found."
            )}
          </CommandEmpty>

          <CommandGroup heading="Quick actions">
            <CommandItem onSelect={() => runAndClose(() => setCreateProjectOpen(true))}>
              <Plus className="h-4 w-4" />
              Create project
            </CommandItem>
            <CommandItem
              onSelect={() =>
                runAndClose(() => {
                  const periodEnd = new Date();
                  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
                  generateReportMutation.mutate(
                    {
                      type: "weekly_exec",
                      periodStart: periodStart.toISOString().slice(0, 10),
                      periodEnd: periodEnd.toISOString().slice(0, 10)
                    },
                    { onSuccess: (data) => router.push(`/app/reports/${data.reportId}`) }
                  );
                })
              }
            >
              <FileBarChart className="h-4 w-4" />
              Generate weekly report
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Navigate">
            {NAV_COMMANDS.map((cmd) => (
              <CommandItem key={cmd.href} onSelect={() => runAndClose(() => router.push(cmd.href))}>
                <cmd.icon className="h-4 w-4" />
                {cmd.label}
              </CommandItem>
            ))}
          </CommandGroup>

          {projects.length > 0 && (
            <CommandGroup heading="Open project">
              {projects.slice(0, 8).map((project) => (
                <CommandItem
                  key={project.id}
                  value={`project ${project.name}`}
                  onSelect={() => runAndClose(() => router.push(`/app/projects/${project.id}`))}
                >
                  <Trello className="h-4 w-4" />
                  {project.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          <CommandGroup heading="Ask AI">
            <CommandItem onSelect={askChat}>
              <Search className="h-4 w-4" />
              {search.trim() ? `Ask: "${search.trim()}"` : "Type a question, then select this"}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      <CreateProjectDialog open={createProjectOpen} onOpenChange={setCreateProjectOpen} />
    </>
  );
}
