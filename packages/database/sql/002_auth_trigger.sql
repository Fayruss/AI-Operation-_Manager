-- On Supabase Auth signup, provision an organization (if the user is the
-- first member of a new org) and mirror the auth user into public.users,
-- stamping org_id into the JWT's app_metadata so RLS policies (001) can
-- read it via auth.org_id().
-- SAD §6.5: "org context resolved from JWT claim, injected into all queries."

create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_org_id uuid;
begin
  insert into public.organizations (id, name, plan)
  values (gen_random_uuid(), coalesce(new.raw_user_meta_data->>'org_name', 'My Organization'), 'free')
  returning id into new_org_id;

  insert into public.users (id, org_id, email, name, role)
  values (new.id, new_org_id, new.email, coalesce(new.raw_user_meta_data->>'name', new.email), 'owner');

  update auth.users
    set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('org_id', new_org_id)
    where id = new.id;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
