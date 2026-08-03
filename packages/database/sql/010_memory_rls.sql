-- AI Operations Manager — RLS for the Memory Module (Phase 7).
-- Same tenant-isolation pattern as every prior migration (SAD §3.2: RLS is
-- the mechanism enforcing tenant isolation at the DB layer, which matters
-- especially here since agents write memory_entries with write access and
-- the similarity-search retrieval path (MemoryEntryRepository.search is
-- read by every agent) — Test Plan §7's "memory retrieval isolation" case
-- ("assert memory_entries similarity search never returns another org's
-- entries even when embeddings are semantically similar") is enforced here,
-- not just by the app-layer `org_id = $1` filter already present in every
-- repository query.

alter table memory_entries enable row level security;

create policy "memory_entries_select_same_org" on memory_entries
  for select using (org_id = auth.org_id());
create policy "memory_entries_insert_same_org" on memory_entries
  for insert with check (org_id = auth.org_id());
create policy "memory_entries_update_same_org" on memory_entries
  for update using (org_id = auth.org_id());
create policy "memory_entries_delete_same_org" on memory_entries
  for delete using (org_id = auth.org_id());
