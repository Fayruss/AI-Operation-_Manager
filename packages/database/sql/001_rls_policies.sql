-- AI Operations Manager — Row-Level Security policies
-- SAD §4: "All tables are tenant-scoped via org_id with RLS policies
-- org_id = auth.jwt() -> 'org_id'". SAD §3.2: RLS is the mechanism enforcing
-- tenant isolation at the DB layer, not just app-layer checks — required
-- because AI agents (from Phase 2 onward) have write access.

-- Enable RLS on every tenant-scoped table.
alter table organizations enable row level security;
alter table users enable row level security;
alter table notifications enable row level security;

-- Helper: org_id claim lives in the Supabase JWT's app_metadata, set on
-- signup by the handle_new_user trigger below.
create or replace function auth.org_id() returns uuid as $$
  select nullif(current_setting('request.jwt.claims', true)::json->>'org_id', '')::uuid;
$$ language sql stable;

-- organizations: a user may only read their own org row.
create policy "org_select_own" on organizations
  for select using (id = auth.org_id());

-- users: readable/writable only within the caller's org.
create policy "users_select_same_org" on users
  for select using (org_id = auth.org_id());

create policy "users_update_self" on users
  for update using (id = auth.uid() and org_id = auth.org_id());

-- notifications: strictly scoped to org AND the owning user.
create policy "notifications_select_own" on notifications
  for select using (org_id = auth.org_id() and user_id = auth.uid());

create policy "notifications_update_own" on notifications
  for update using (org_id = auth.org_id() and user_id = auth.uid());

-- Cross-tenant isolation test fixtures live in the Test Plan §2/§7 —
-- this migration is the artifact those integration tests assert against.
