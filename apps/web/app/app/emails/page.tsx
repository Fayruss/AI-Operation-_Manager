import Link from "next/link";
import { AlertCircle, AlertTriangle, Inbox, Mail } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KpiCard } from "@/components/shared/kpi-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConvertToTaskDialog } from "@/components/emails/convert-to-task-dialog";
import { getAuthContext } from "@/lib/auth/session";
import { EmailAccountRepository } from "@/lib/repositories/email-account-repository";
import { EmailMessageRepository } from "@/lib/repositories/email-message-repository";
import type { EmailUrgency } from "@ai-ops/database";

const URGENCY_SECTIONS: { key: EmailUrgency; label: string; variant: "danger" | "warning" | "info" | "outline" }[] = [
  { key: "critical", label: "Critical", variant: "danger" },
  { key: "high", label: "High", variant: "warning" },
  { key: "medium", label: "Medium", variant: "info" },
  { key: "low", label: "Low", variant: "outline" }
];

/**
 * SAD §7.3 Email Dashboard — "Inbox-style list grouped by urgency." Server
 * Component reading straight from the repositories (Next.js 15 best
 * practice: Server Components call server-side data functions directly
 * rather than round-tripping through /api/v1) — the interactive
 * convert-to-task action is the one Client Component island on this page.
 */
export default async function EmailsPage() {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx) {
    return (
      <div className="space-y-6">
        <PageHeader title="Email Intelligence" description="Sign in to view classified email." />
      </div>
    );
  }

  const accounts = await EmailAccountRepository.listByOrg(ctx.orgId);

  if (accounts.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Email Intelligence"
          description="Urgency-grouped inbox, intent distribution, and convert-to-task actions."
        />
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={Inbox}
              title="No email account connected"
              description="Connect Gmail or Outlook in Settings → Integrations to start classifying inbound email automatically."
              action={
                <Button asChild>
                  <Link href="/app/settings?tab=integrations">Go to Integrations</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const { items: messages } = await EmailMessageRepository.list(ctx.orgId, {}, null, 100);
  const unprocessedCount = messages.filter((m) => m.status === "unprocessed").length;
  const criticalCount = messages.filter((m) => m.urgency === "critical").length;
  const highCount = messages.filter((m) => m.urgency === "high").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Intelligence"
        description={`${accounts.length} mailbox${accounts.length === 1 ? "" : "es"} connected · ${messages.length} messages ingested`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total messages" value={messages.length} icon={Mail} />
        <KpiCard label="Unprocessed" value={unprocessedCount} icon={Inbox} />
        <KpiCard label="Critical" value={criticalCount} icon={AlertCircle} />
        <KpiCard label="High urgency" value={highCount} icon={AlertTriangle} />
      </div>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={Inbox}
              title="No messages yet"
              description="New inbound email will appear here once your provider's webhook delivers the first message."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {URGENCY_SECTIONS.map((section) => {
            const sectionMessages = messages.filter((m) => m.urgency === section.key);
            if (sectionMessages.length === 0) return null;

            return (
              <div key={section.key} className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={section.variant}>{section.label}</Badge>
                  <span className="text-xs text-muted-foreground">{sectionMessages.length}</span>
                </div>
                <div className="space-y-2">
                  {sectionMessages.map((message) => (
                    <Card key={message.id}>
                      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium">{message.subject}</p>
                            {message.intent && (
                              <Badge variant="outline" className="shrink-0 capitalize">
                                {message.intent}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">
                            {message.sender} — {message.bodySnippet}
                          </p>
                        </div>
                        {message.intent === "task" && (
                          <div className="shrink-0">
                            <ConvertToTaskDialog emailId={message.id} emailSubject={message.subject} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}

          {messages.some((m) => !m.urgency) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Unclassified</Badge>
                <span className="text-xs text-muted-foreground">{messages.filter((m) => !m.urgency).length}</span>
              </div>
              <div className="space-y-2">
                {messages
                  .filter((m) => !m.urgency)
                  .map((message) => (
                    <Card key={message.id}>
                      <CardContent className="p-4">
                        <p className="truncate text-sm font-medium">{message.subject}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {message.sender} — awaiting classification
                        </p>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
