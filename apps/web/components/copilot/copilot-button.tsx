"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useChatStore } from "@/stores/chat-store";
import { useSendChatMessage } from "@/lib/query/use-chat";

/**
 * SAD §13.3 AI Copilot — "Not a new agent — a context injector in front of
 * the Chat Workspace endpoint. The floating button passes {page_type,
 * entity_id} to /api/v1/chat, which prepends the relevant record(s) to
 * context and offers page-specific quick-prompts." Embedded per detail
 * page (meeting/project/report) rather than a second global floating
 * button — the Chat Workspace's own trigger (chat-panel.tsx) already
 * covers the "always available" affordance; this one is what makes a
 * specific page's questions one click instead of typed out.
 */
export function CopilotButton({
  entityType,
  entityId,
  entityLabel,
  quickPrompts
}: {
  entityType: string;
  entityId: string;
  entityLabel: string;
  quickPrompts: string[];
}) {
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const { setOpen, setActiveSessionId, setPendingContextEntity } = useChatStore();
  const sendMutation = useSendChatMessage();

  function ask(prompt: string) {
    setPendingPrompt(prompt);
    setPendingContextEntity({ type: entityType, id: entityId, label: entityLabel });
    sendMutation.mutate(
      { sessionId: null, message: prompt, contextEntity: { type: entityType, id: entityId } },
      {
        onSuccess: (data) => {
          setActiveSessionId(data.session.id);
          setOpen(true);
          setPendingPrompt(null);
        },
        onError: () => setPendingPrompt(null)
      }
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" disabled={sendMutation.isPending}>
          <Sparkles className="h-3.5 w-3.5 text-info" />
          {sendMutation.isPending ? `Asking: ${pendingPrompt}…` : "Ask AI"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Quick questions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {quickPrompts.map((prompt) => (
          <DropdownMenuItem key={prompt} onSelect={() => ask(prompt)}>
            {prompt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
