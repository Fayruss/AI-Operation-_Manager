-- AI Operations Manager — RLS for the Reporting Module (Phase 6).
-- Same tenant-isolation pattern as every prior migration.

alter table reports enable row level security;

create policy "reports_select_same_org" on reports
  for select using (org_id = auth.org_id());
create policy "reports_insert_same_org" on reports
  for insert with check (org_id = auth.org_id());
create policy "reports_update_same_org" on reports
  for update using (org_id = auth.org_id());
