-- Explicit reporting lines. Admin-managed, never writable by team members.
alter table public.memberships add column supervisor_id uuid references public.memberships(user_id);
alter table public.memberships add constraint different_supervisor check(supervisor_id is null or supervisor_id<>user_id);
create index memberships_supervisor_idx on public.memberships(supervisor_id);
create function public.validate_supervisor() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.supervisor_id is not null and not exists(select 1 from public.memberships s where s.user_id=new.supervisor_id and s.role='supervisor' and s.org_id=new.org_id) then
  raise exception 'Supervisor must belong to the same organization and have a supervisor role';
 end if;
 return new;
end $$;
revoke all on function public.validate_supervisor() from public,anon,authenticated;
create trigger validate_staff_supervisor before insert or update on public.memberships for each row execute function public.validate_supervisor();
-- Connect only the local synthetic identities. Hosted deployments can assign real Auth IDs.
update public.memberships set supervisor_id='10000000-0000-4000-8000-000000000001'
 where user_id in ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003')
 and exists(select 1 from public.memberships s where s.user_id='10000000-0000-4000-8000-000000000001' and s.org_id=memberships.org_id and s.role='supervisor');
create or replace function public.get_workspace() returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare profile jsonb;
begin
 select to_jsonb(m) into profile from public.memberships m where m.user_id=auth.uid();
 if profile is null then raise exception 'No TAFU membership. Ask the project administrator to provision this account.' using errcode='42501'; end if;
 return jsonb_build_object('profile',profile,
 'staff',(select coalesce(jsonb_agg(to_jsonb(m) order by m.name),'[]') from public.memberships m where m.supervisor_id=auth.uid() and profile->>'role'='supervisor'),
 'facilities',(select coalesce(jsonb_agg(to_jsonb(f) order by f.name),'[]') from public.facilities f),
 'workers',(select coalesce(jsonb_agg(to_jsonb(m) order by m.name),'[]') from public.memberships m where m.role='chw'),
 'referrals',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]') from public.referrals r),
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at,e.recorded_at),'[]') from public.referral_events e),
 'notifications',(select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]') from public.notifications n));
end $$;
