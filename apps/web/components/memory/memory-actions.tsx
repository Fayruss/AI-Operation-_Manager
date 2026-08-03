"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Plus, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useCreateMemoryEntry, useRebuildEmbeddings, useRunConsolidation } from "@/lib/query/use-memory";

/**
 * Manual entry affordance (Phase 7 requirement §7: "CRUD where
 * appropriate") — same Sheet-form pattern as GenerateReportDialog
 * (Phase 6). admin+ at the API layer; not client-side role-gated, matching
 * every other action button in this codebase (the server enforces it, the
 * button simply surfaces a 403 via the mutation's error state if the
 * caller isn't permitted).
 */
export function AddMemoryDialog() {
  const [open, setOpen] = useState(false);
  const [entityType, setEntityType] = useState("general");
  const [content, setContent] = useState("");
  const createMutation = useCreateMemoryEntry();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate(
      { entityType, entityId: null, content },
      {
        onSuccess: () => {
          setContent("");
          setOpen(false);
        }
      }
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="h-3.5 w-3.5" />
          Add memory
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add a memory</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="entityType">Entity type</Label>
            <Input id="entityType" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="project, person, client…" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="content">Content</Label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={5}
              className="flex w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none"
              placeholder="A fact, preference, or note worth remembering organization-wide…"
            />
          </div>
          {createMutation.isError && (
            <p className="text-sm text-danger" role="alert">
              {createMutation.error.message}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <SheetClose asChild>
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </SheetClose>
            <Button type="submit" disabled={createMutation.isPending || !content.trim()}>
              {createMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Admin+ maintenance actions — "Rebuild embeddings" (Phase 7 requirement
 * §7 API, e.g. after an embedding model upgrade or to retry failed
 * entries) and a manual consolidation trigger (SAD §8.6's nightly cycle,
 * run on demand rather than waiting for the schedule).
 */
export function MemoryMaintenanceActions() {
  const rebuild = useRebuildEmbeddings();
  const consolidate = useRunConsolidation();

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={() => rebuild.mutate(undefined)} disabled={rebuild.isPending}>
        {rebuild.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Rebuild embeddings
      </Button>
      <Button variant="secondary" size="sm" onClick={() => consolidate.mutate()} disabled={consolidate.isPending}>
        {consolidate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        Run consolidation
      </Button>
    </div>
  );
}
