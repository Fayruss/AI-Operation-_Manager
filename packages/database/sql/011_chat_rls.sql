-- AI Operations Manager — RLS for the AI Chat Workspace (Phase 9 / SAD §13.1, §13.11).
-- Same tenant-isolation pattern as every prior migration (SAD §3.2). Two
-- tables: `chat_sessions` carries `org_id` directly so it's a normal
-- tenant-scoped policy; `chat_messages` has no `org_id` column of its own
-- (SAD §13.11's documented schema doesn't include one — it's reached via
-- `session_id`), so its policies join back through `chat_sessions` the
-- same way `meeting_action_items` (Phase 4) scopes through `meetings`.

alter table chat_sessions enable row level security;

create policy "chat_sessions_select_same_org" on chat_sessions
  for select using (org_id = auth.org_id());
create policy "chat_sessions_insert_same_org" on chat_sessions
  for insert with check (org_id = auth.org_id());
create policy "chat_sessions_update_same_org" on chat_sessions
  for update using (org_id = auth.org_id());
create policy "chat_sessions_delete_same_org" on chat_sessions
  for delete using (org_id = auth.org_id());

alter table chat_messages enable row level security;

create policy "chat_messages_select_same_org" on chat_messages
  for select using (
    exists (
      select 1 from chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.org_id = auth.org_id()
    )
  );
create policy "chat_messages_insert_same_org" on chat_messages
  for insert with check (
    exists (
      select 1 from chat_sessions
      where chat_sessions.id = chat_messages.session_id
        and chat_sessions.org_id = auth.org_id()
    )
  );
-- No update/delete policy: chat_messages is append-only (matches audit_log's
-- immutability precedent) — the app never edits or deletes a sent message.
