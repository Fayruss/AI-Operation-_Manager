-- AI Operations Manager — RLS for Meeting Intelligence (Phase 4).
-- Same tenant-isolation pattern as 001/003/005: org_id = auth.org_id() at
-- the DB layer; role-based checks (if any) enforced at the API layer.

alter table meetings enable row level security;
alter table meeting_action_items enable row level security;

create policy "meetings_select_same_org" on meetings
  for select using (org_id = auth.org_id());
create policy "meetings_insert_same_org" on meetings
  for insert with check (org_id = auth.org_id());
create policy "meetings_update_same_org" on meetings
  for update using (org_id = auth.org_id());

-- meeting_action_items has no org_id of its own — scope via the parent meeting.
create policy "meeting_action_items_select_same_org" on meeting_action_items
  for select using (
    exists (select 1 from meetings m where m.id = meeting_id and m.org_id = auth.org_id())
  );
create policy "meeting_action_items_insert_same_org" on meeting_action_items
  for insert with check (
    exists (select 1 from meetings m where m.id = meeting_id and m.org_id = auth.org_id())
  );
create policy "meeting_action_items_update_same_org" on meeting_action_items
  for update using (
    exists (select 1 from meetings m where m.id = meeting_id and m.org_id = auth.org_id())
  );
