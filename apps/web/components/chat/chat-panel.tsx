"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { ChatMessageBubble } from "@/components/chat/chat-message-bubble";
import { useChatMessages, useSendChatMessage } from "@/lib/query/use-chat";
import { useChatStore } from "@/stores/chat-store";

/**
 * Component Spec: ChatPanel — "The AI Chat Workspace surface (SAD §13.1) —
 * persistent right-side conversational interface... on mobile, opens as a
 * full-screen sheet." Implemented as a slide-over `Sheet` on every
 * breakpoint rather than a permanently-mounted split-pane: this app's
 * dashboard layouts (SAD §7) are already dense 12-column grids, and a
 * true always-visible side rail would require reflowing every existing
 * page's grid math — a `Sheet` gets the "available from every
 * authenticated route, collapsible" requirement without that reflow, at
 * the cost of it being an overlay rather than a literal split-pane on
 * desktop. The floating trigger (SAD §13.3-adjacent affordance) keeps it
 * one click away everywhere, matching "ambient rather than a destination."
 */
export function ChatPanel() {
  const { open, setOpen, activeSessionId, setActiveSessionId, pendingContextEntity, setPendingContextEntity } =
    useChatStore();
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const messagesQuery = useChatMessages(activeSessionId);
  const sendMutation = useSendChatMessage();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messagesQuery.data, sendMutation.isPending]);

  function handleSend(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;

    sendMutation.mutate(
      {
        sessionId: activeSessionId,
        message,
        contextEntity: pendingContextEntity
          ? { type: pendingContextEntity.type, id: pendingContextEntity.id }
          : undefined
      },
      {
        onSuccess: (data) => {
          setActiveSessionId(data.session.id);
        }
      }
    );
    setDraft("");
    setPendingContextEntity(null);
  }

  const messages = messagesQuery.data ?? [];

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full p-0 shadow-lg"
        aria-label="Open AI Chat Workspace"
      >
        <Sparkles className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full max-w-md flex-col p-0 sm:max-w-md">
          <SheetHeader className="flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <MessageCircle className="h-4 w-4 text-info" />
              AI Chat Workspace
            </SheetTitle>
            <div className="flex items-center gap-1">
              {activeSessionId && (
                <Button variant="ghost" size="sm" onClick={() => setActiveSessionId(null)}>
                  New chat
                </Button>
              )}
            </div>
          </SheetHeader>

          {pendingContextEntity && (
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2 text-xs text-muted-foreground">
              <span>Asking about: {pendingContextEntity.label}</span>
              <button onClick={() => setPendingContextEntity(null)} aria-label="Clear context">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4" aria-live="polite">
            {!activeSessionId && messages.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Ask anything about your org"
                description={'Try "what tasks are overdue on the client redesign?" or "summarize this week\'s risks."'}
              />
            ) : (
              messages.map((message) => <ChatMessageBubble key={message.id} message={message} />)
            )}
            {sendMutation.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-info" />
                </span>
                Thinking…
              </div>
            )}
            {sendMutation.isError && (
              <p className="text-xs text-danger">Something went wrong. Try sending your message again.</p>
            )}
          </div>

          <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              placeholder="Ask a question…"
              className="min-h-[40px]"
              aria-label="Message"
            />
            <Button type="submit" size="icon" disabled={sendMutation.isPending || !draft.trim()} aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
