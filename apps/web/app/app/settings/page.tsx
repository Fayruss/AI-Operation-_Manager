import { Building2, Check, Mail, Plug, Shield, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { MeetingWebhookPanel } from "@/components/meetings/meeting-webhook-panel";
import { mockCurrentUser, mockOrganization } from "@/lib/mock/mock-data";
import { getAuthContext } from "@/lib/auth/session";
import { EmailAccountRepository } from "@/lib/repositories/email-account-repository";
import { cn } from "@/lib/utils/cn";

const PROVIDER_LABEL = { gmail: "Gmail", outlook: "Outlook" } as const;

/** SAD §7.8 Settings — org profile, users & roles, integrations, audit log, billing. */
export default async function SettingsPage() {
  const ctx = await getAuthContext().catch(() => null);
  const accounts = ctx ? await EmailAccountRepository.listByOrg(ctx.orgId) : [];
  const connectedProviders = new Set(accounts.map((a) => a.provider));

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Organization profile, users, integrations, and governance." />

      <Tabs defaultValue="organization">
        <TabsList className="flex w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="organization">Organization</TabsTrigger>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="organization">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-md bg-primary/10 p-3 text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">{mockOrganization.name}</p>
                <p className="text-sm text-muted-foreground">
                  Plan: <span className="capitalize">{mockOrganization.plan}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>PS</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{mockCurrentUser.name}</p>
                    <p className="text-xs text-muted-foreground">{mockCurrentUser.email}</p>
                  </div>
                </div>
                <Badge variant="outline" className="capitalize">
                  {mockCurrentUser.role}
                </Badge>
              </div>
              <div className="mt-4">
                <EmptyState
                  icon={Users}
                  title="Invite your team"
                  description="Invitation flows connect once org member management ships alongside Phase 1's auth work."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardContent className="space-y-4 p-6">
              {accounts.length > 0 && (
                <div className="space-y-2">
                  {accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-md border border-border px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-success/10 p-2 text-success">
                          <Mail className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">{PROVIDER_LABEL[account.provider]}</span>
                      </div>
                      <Badge variant="success">
                        <Check className="h-3 w-3" />
                        Connected
                      </Badge>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <a
                  href="/api/v1/integrations/gmail/connect"
                  className={cn(buttonVariants({ variant: connectedProviders.has("gmail") ? "outline" : "default" }))}
                >
                  <Mail className="h-4 w-4" />
                  {connectedProviders.has("gmail") ? "Reconnect Gmail" : "Connect Gmail"}
                </a>
                <a
                  href="/api/v1/integrations/outlook/connect"
                  className={cn(buttonVariants({ variant: connectedProviders.has("outlook") ? "outline" : "default" }))}
                >
                  <Mail className="h-4 w-4" />
                  {connectedProviders.has("outlook") ? "Reconnect Outlook" : "Connect Outlook"}
                </a>
              </div>

              {accounts.length === 0 && (
                <EmptyState
                  icon={Plug}
                  title="No mailbox connected yet"
                  description="Connect Gmail or Outlook to start classifying inbound email automatically (Slack/Zoom connect flows are a later phase)."
                />
              )}

              <MeetingWebhookPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardContent className="p-6">
              <EmptyState
                icon={Shield}
                title="No audit events yet"
                description="Every AI-mutating action will be logged here once agents are connected (SAD §2.8, §15)."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
