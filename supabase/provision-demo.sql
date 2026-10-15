-- Run after migration + seed, using SQL Editor as project administrator.
-- First create these five synthetic team accounts in Authentication > Users.
-- Replace the example emails below with the exact account emails you created.
-- Passwords belong only in Supabase Auth, never in this file or in Git.
begin;
do $$
declare mapping record; actual_id uuid; stub public.memberships;
begin
 for mapping in select * from (values
  ('10000000-0000-4000-8000-000000000001'::uuid,'supervisor@example.invalid'),
  ('10000000-0000-4000-8000-000000000002'::uuid,'grace@example.invalid'),
  ('10000000-0000-4000-8000-000000000003'::uuid,'neema@example.invalid'),
  ('10000000-0000-4000-8000-000000000004'::uuid,'highland@example.invalid'),
  ('10000000-0000-4000-8000-000000000005'::uuid,'valley@example.invalid')
 ) as entries(stub_id,email)
 loop
  select id into actual_id from auth.users where email=mapping.email;
  if actual_id is null then raise exception 'Create the configured Auth user before provisioning: %',mapping.email; end if;
  select * into stub from public.memberships where user_id=mapping.stub_id;
  if stub.user_id is null then raise exception 'Demo stub missing; provision only once after seed'; end if;
  insert into public.memberships(user_id,org_id,name,role,facility_id) values(actual_id,stub.org_id,stub.name,stub.role,stub.facility_id);
  update public.referrals set chw_id=actual_id where chw_id=stub.user_id;
  update public.referral_events set actor_id=actual_id where actor_id=stub.user_id;
  update public.notifications set recipient_id=actual_id where recipient_id=stub.user_id;
  delete from public.memberships where user_id=stub.user_id;
 end loop;
end $$;
commit;
