"use client";

import { useState } from "react";
import { Check, Copy, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api/client";

interface WebhookSecretResponse {
  webhookUrl: string;
  secret: string;
}

/**
 * SAD §7.5/§5 `POST /meetings/ingest` provisioning UI — reveals the
 * webhook URL + signing secret an admin pastes into their transcript
 * provider (Zoom/Meet/Otter-style webhook config). Secret is fetched only
 * on demand (click-to-reveal), never eagerly loaded with the page.
 */
export function MeetingWebhookPanel() {
  const [details, setDetails] = useState<WebhookSecretResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<"url" | "secret" | null>(null);

  async function reveal() {
    setLoading(true);
    try {
      const result = await apiClient.get<WebhookSecretResponse>("/organizations/current/meeting-webhook-secret");
      setDetails(result);
    } finally {
      setLoading(false);
    }
  }

  async function copy(value: string, which: "url" | "secret") {
    await navigator.clipboard.writeText(value);
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-info/10 p-2 text-info">
          <Webhook className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">Meeting transcript webhook</p>
          <p className="text-xs text-muted-foreground">Configure this in your Zoom/Meet/Otter-style provider.</p>
        </div>
      </div>

      {!details ? (
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => void reveal()} disabled={loading}>
          {loading ? "Loading…" : "Reveal webhook details"}
        </Button>
      ) : (
        <div className="mt-3 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-surface-raised px-2 py-1 font-mono">{details.webhookUrl}</code>
            <Button variant="ghost" size="icon" onClick={() => void copy(details.webhookUrl, "url")} aria-label="Copy webhook URL">
              {copied === "url" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-surface-raised px-2 py-1 font-mono">{details.secret}</code>
            <Button variant="ghost" size="icon" onClick={() => void copy(details.secret, "secret")} aria-label="Copy signing secret">
              {copied === "secret" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
