-- AI Operations Manager — RLS for Email Intelligence + Agent Orchestration
-- (Phase 3). Same tenant-isolation pattern as 001/003: org_id = auth.org_id()
-- is the DB-layer backstop; role-based checks (e.g. connecting a mailbox)
-- are enforced in the API layer per SAD §5's documented per-endpoint auth.

alter table email_accounts enable row level security;
alter table email_messages enable row level security;
alter table agent_runs enable row level security;

-- email_accounts: readable by the org; OAuth tokens never leave the server
-- (API routes select specific columns, never oauth_token_encrypted, when
-- returning account info to the client) but RLS still scopes the whole row
-- to the tenant as defense in depth.
create policy "email_accounts_select_same_org" on email_accounts
  for select using (org_id = auth.org_id());
create policy "email_accounts_insert_same_org" on email_accounts
  for insert with check (org_id = auth.org_id());
create policy "email_accounts_update_same_org" on email_accounts
  for update using (org_id = auth.org_id());

-- email_messages: readable/writable by any org member (SAD §7.3 Email
-- Dashboard is member+); writes come from the server-side ingestion
-- pipeline (service-role) and from convert-to-task actions (member+).
create policy "email_messages_select_same_org" on email_messages
  for select using (org_id = auth.org_id());
create policy "email_messages_insert_same_org" on email_messages
  for insert with check (org_id = auth.org_id());
create policy "email_messages_update_same_org" on email_messages
  for update using (org_id = auth.org_id());

-- agent_runs: readable by the org (Settings → AI Control Center is
-- admin+-gated at the route layer per SAD §15, same "role checks at the API
-- layer, not RLS" pattern as audit_log's insert policy); writes come from
-- the server-side agent pipeline only.
create policy "agent_runs_select_same_org" on agent_runs
  for select using (org_id = auth.org_id());
create policy "agent_runs_insert_same_org" on agent_runs
  for insert with check (org_id = auth.org_id());
create policy "agent_runs_update_same_org" on agent_runs
  for update using (org_id = auth.org_id());
