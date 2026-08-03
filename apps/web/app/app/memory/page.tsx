import { PageHeader } from "@/components/shared/page-header";
import { AddMemoryDialog, MemoryMaintenanceActions } from "@/components/memory/memory-actions";
import { MemoryExplorer } from "@/components/memory/memory-explorer";
import { getAuthContext } from "@/lib/auth/session";
import { MemoryEntryRepository } from "@/lib/repositories/memory-entry-repository";
import type { MemoryEntryDto } from "@/lib/api/dto";

/**
 * SAD §13.6 Memory Explorer — "Read-only UI over memory_entries... shows
 * derived preferences, linked project/meeting counts, top memory entries
 * by importance... includes a delete/forget action." Server Component
 * fetches the initial unfiltered page (no loading flash, same pattern as
 * ReportsPage/Operations Dashboard); `MemoryExplorer` is a Client
 * Component for live filtering/search/pagination.
 */
export default async function MemoryPage() {
  const ctx = await getAuthContext().catch(() => null);
  if (!ctx) {
    return (
      <div className="space-y-6">
        <PageHeader title="Memory Explorer" description="Sign in to view organizational memory." />
      </div>
    );
  }

  const entriesPage = await MemoryEntryRepository.list(ctx.orgId, {}, null, 50);

  // Server → Client boundary: DTO shape (ISO strings), matching what the
  // API route itself returns after NextResponse.json() serialization —
  // same reasoning as ReportsPage/Operations Dashboard.
  const initialData = {
    items: entriesPage.items.map(
      (entry): MemoryEntryDto => ({
        id: entry.id,
        orgId: entry.orgId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        content: entry.content,
        embeddingStatus: entry.embeddingStatus,
        embeddingModel: entry.embeddingModel,
        embeddingVersion: entry.embeddingVersion,
        importance: entry.importance,
        sourceType: entry.sourceType,
        sourceRefId: entry.sourceRefId,
        metadata: entry.metadata as unknown as Record<string, unknown> | null,
        accessCount: entry.accessCount,
        lastAccessedAt: entry.lastAccessedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString()
      })
    ),
    nextCursor: entriesPage.nextCursor
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Memory Explorer"
        description="Transparency into what the system remembers — the same organizational memory every AI agent reads from."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MemoryMaintenanceActions />
            <AddMemoryDialog />
          </div>
        }
      />
      <MemoryExplorer initialData={initialData} />
    </div>
  );
}
