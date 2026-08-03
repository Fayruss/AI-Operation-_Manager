-- AI Operations Manager — organization UPDATE policy (Phase 2 Backend
-- Foundation). 001_rls_policies.sql only granted SELECT on organizations;
-- `PATCH /api/v1/organizations/current` needs an UPDATE policy. Restricted
-- to owner at the DB layer too, matching the API route's `minRole: "owner"`
-- check (defense in depth, not "just app-layer checks" — SAD §3.2).

create policy "org_update_owner_only" on organizations
  for update using (id = auth.org_id() and auth.user_role() = 'owner');
