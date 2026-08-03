-- AI Operations Manager — RLS for Task & Project Core + governance tables
-- (Phase 2 Backend Foundation). Same pattern as 001_rls_policies.sql:
-- org_id = auth.org_id() is the tenant-isolation backstop enforced at the
-- DB layer; role-based action authorization (e.g. "DELETE /tasks/:id
-- requires admin+") is enforced in the API layer per SAD §5's documented
-- per-endpoint auth column — RLS here guarantees no cross-tenant access is
-- possible even if an API-layer check were ever missed.

alter table projects enable row level security;
alter table boards enable row level security;
alter table tasks enable row level security;
alter table task_dependencies enable row level security;
alter table task_activity enable row level security;
alter table audit_log enable row level security;

-- Helper: current user's role, for policies that need role (not just org)
-- scoping — e.g. audit_log is owner/admin-only per SAD §5.
create or replace function auth.user_role() returns text as $$
  select role::text from public.users where id = auth.uid();
$$ language sql stable security definer;

-- projects: readable/writable by any member of the org.
create policy "projects_select_same_org" on projects
  for select using (org_id = auth.org_id());
create policy "projects_insert_same_org" on projects
  for insert with check (org_id = auth.org_id());
create policy "projects_update_same_org" on projects
  for update using (org_id = auth.org_id());

-- boards: same tenant-scoping shape as projects.
create policy "boards_select_same_org" on boards
  for select using (org_id = auth.org_id());
create policy "boards_insert_same_org" on boards
  for insert with check (org_id = auth.org_id());
create policy "boards_update_same_org" on boards
  for update using (org_id = auth.org_id());

-- tasks: tenant-scoped; soft-delete (setting deleted_at) is still an UPDATE,
-- role-gated at the API layer (API Contract Pattern A: "DELETE /tasks/:id
-- admin+"), not by a separate RLS policy, matching the API Contract's own
-- stated pattern of explicit 403s at the API layer over bare DB errors.
create policy "tasks_select_same_org" on tasks
  for select using (org_id = auth.org_id());
create policy "tasks_insert_same_org" on tasks
  for insert with check (org_id = auth.org_id());
create policy "tasks_update_same_org" on tasks
  for update using (org_id = auth.org_id());

-- task_dependencies: no org_id column of its own — scope via the parent task.
create policy "task_deps_select_same_org" on task_dependencies
  for select using (
    exists (select 1 from tasks t where t.id = task_id and t.org_id = auth.org_id())
  );
create policy "task_deps_insert_same_org" on task_dependencies
  for insert with check (
    exists (select 1 from tasks t where t.id = task_id and t.org_id = auth.org_id())
  );

-- task_activity: scope via the parent task; product-facing history, readable
-- by any org member (SAD §4 design rationale distinguishes this from audit_log).
create policy "task_activity_select_same_org" on task_activity
  for select using (
    exists (select 1 from tasks t where t.id = task_id and t.org_id = auth.org_id())
  );
create policy "task_activity_insert_same_org" on task_activity
  for insert with check (
    exists (select 1 from tasks t where t.id = task_id and t.org_id = auth.org_id())
  );

-- audit_log: immutable, append-only, owner/admin read access only (SAD §5:
-- "GET /audit-log ... owner/admin"). No update/delete policy exists at all —
-- there is deliberately no way to mutate a row once written, from any role.
create policy "audit_log_select_owner_admin" on audit_log
  for select using (org_id = auth.org_id() and auth.user_role() in ('owner', 'admin'));
create policy "audit_log_insert_same_org" on audit_log
  for insert with check (org_id = auth.org_id());
