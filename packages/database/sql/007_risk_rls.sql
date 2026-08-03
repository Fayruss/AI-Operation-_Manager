-- AI Operations Manager — RLS for the Operations Health & Risk Module
-- (Phase 5). Same tenant-isolation pattern as every prior migration.

alter table risk_signals enable row level security;

create policy "risk_signals_select_same_org" on risk_signals
  for select using (org_id = auth.org_id());
create policy "risk_signals_insert_same_org" on risk_signals
  for insert with check (org_id = auth.org_id());
-- Resolving a signal is an UPDATE (setting resolved=true) — API-layer RBAC
-- (admin+, per SAD §5) is the authorization gate; RLS here is the tenant
-- isolation backstop, same division of responsibility as every other
-- role-gated mutation in this codebase.
create policy "risk_signals_update_same_org" on risk_signals
  for update using (org_id = auth.org_id());
