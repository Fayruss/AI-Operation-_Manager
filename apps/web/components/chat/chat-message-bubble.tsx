"use client";

import { Bot, CheckCircle2, Sparkles, Ticket, User as UserIcon, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApproveChatAction } from "@/lib/query/use-chat";
import { cn } from "@/lib/utils/cn";
import type { ChatMessageDto } from "@/lib/api/dto";

const ENTITY_ICON = { task: Ticket, risk_signal: Sparkles, user: UserIcon } as const;

/**
 * Component Spec ChatPanel — "action-pending (assistant message includes a
 * proposed agent_runs action, renders approval button)." Renders inline
 * entity chips for `referencedEntities` (SAD §13.1: "not just prose") and
 * the `[Yes]`/decline pair for `proposedActionRunId` (approval-gate
 * pattern, SAD §8.7/§9.5).
 */
export function ChatMessageBubble({ message }: { message: ChatMessageDto }) {
  const approveMutation = useApproveChatAction();
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/15 text-primary" : "bg-info/15 text-info"
        )}
        aria-hidden
      >
        {isUser ? <UserIcon className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={cn("max-w-[85%] space-y-2", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm leading-relaxed",
            isUser ? "bg-primary text-primary-foreground" : "bg-surface-raised text-foreground"
          )}
        >
          {message.content}
        </div>

        {message.referencedEntities && message.referencedEntities.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Referenced records">
            {message.referencedEntities.map((entity, i) => {
              const Icon = ENTITY_ICON[entity.type];
              return (
                <Badge key={`${entity.id}-${i}`} variant="outline">
                  <Icon className="h-3 w-3" aria-hidden />
                  {entity.label}
                </Badge>
              );
            })}
          </div>
        )}

        {message.proposedActionRunId && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-2">
            <span className="text-xs text-muted-foreground">Would you like me to do this?</span>
            <div className="ml-auto flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                disabled={approveMutation.isPending}
                onClick={() =>
                  approveMutation.mutate({ agentRunId: message.proposedActionRunId!, decision: "approved" })
                }
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Yes
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={approveMutation.isPending}
                onClick={() =>
                  approveMutation.mutate({ agentRunId: message.proposedActionRunId!, decision: "rejected" })
                }
              >
                <XCircle className="h-3.5 w-3.5" />
                No
              </Button>
            </div>
          </div>
        )}

        {approveMutation.isSuccess && approveMutation.variables?.agentRunId === message.proposedActionRunId && (
          <p className="text-xs text-muted-foreground">
            {approveMutation.variables.decision === "approved" ? "Done." : "Okay, skipped."}
          </p>
        )}
      </div>
    </div>
  );
}
