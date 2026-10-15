-- Shared by hosted Supabase and the synthetic local PGlite server.
create table public.organizations (id uuid primary key, name text not null);
create table public.facilities (
 id uuid primary key, org_id uuid not null references public.organizations, name text not null
);
create table public.memberships (
 user_id uuid primary key, org_id uuid not null references public.organizations,
 name text not null, role text not null check(role in ('supervisor','chw','facility')),
 facility_id uuid references public.facilities,
 check ((role = 'facility') = (facility_id is not null))
);
create sequence public.referral_number start 13;
create table public.referrals (
 id uuid primary key default gen_random_uuid(), org_id uuid not null references public.organizations,
 code text not null unique default ('R-' || lpad(nextval('public.referral_number')::text,3,'0')),
 alias text not null check(length(alias) between 1 and 80),
 village text not null check(length(village) between 1 and 80),
 facility_id uuid not null references public.facilities, chw_id uuid not null references public.memberships(user_id),
 note text not null check(length(note) between 1 and 500),
 status text not null default 'referred' check(status in ('referred','arrived','seen','closed')),
 outcome text check(outcome in ('assessment_completed','adverse_outcome','other')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 arrival_at timestamptz, seen_at timestamptz, outcome_at timestamptz,
 follow_up_due timestamptz, follow_up_owner text, follow_up_note text,
 version integer not null default 1,
 check(arrival_at is null or arrival_at >= created_at),
 check(seen_at is null or seen_at >= arrival_at),
 check(outcome_at is null or outcome_at >= seen_at)
);
create table public.referral_events (
 id uuid primary key default gen_random_uuid(), referral_id uuid not null references public.referrals,
 actor_id uuid not null references public.memberships(user_id), kind text not null,
 note text not null default '', occurred_at timestamptz not null, recorded_at timestamptz not null default now()
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), referral_id uuid not null unique references public.referrals,
 recipient_id uuid not null references public.memberships(user_id), created_at timestamptz not null default now(), acknowledged_at timestamptz
);
create table public.command_receipts (
 user_id uuid not null, request_id uuid not null, action text not null, payload jsonb not null, result jsonb not null,
 primary key(user_id,request_id)
);
create index referrals_org_idx on public.referrals(org_id);
create index events_referral_idx on public.referral_events(referral_id);
create index notifications_recipient_idx on public.notifications(recipient_id);

create function public.member_org() returns uuid language sql stable security definer set search_path=public,pg_temp
 as $$ select org_id from public.memberships where user_id=auth.uid() $$;
create function public.can_read_referral(p_id uuid) returns boolean language sql stable security definer set search_path=public,pg_temp
 as $$ select exists(select 1 from public.referrals r join public.memberships m on m.org_id=r.org_id
 where r.id=p_id and m.user_id=auth.uid() and (m.role='supervisor' or (m.role='chw' and r.chw_id=m.user_id) or (m.role='facility' and r.facility_id=m.facility_id))) $$;

alter table public.organizations enable row level security;
alter table public.facilities enable row level security;
alter table public.memberships enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_events enable row level security;
alter table public.notifications enable row level security;
alter table public.command_receipts enable row level security;
create policy org_read on public.organizations for select to authenticated using(id=public.member_org());
create policy facility_read on public.facilities for select to authenticated using(org_id=public.member_org());
create policy staff_read on public.memberships for select to authenticated using(org_id=public.member_org());
create policy referral_read on public.referrals for select to authenticated using(public.can_read_referral(id));
create policy event_read on public.referral_events for select to authenticated using(public.can_read_referral(referral_id));
create policy notification_read on public.notifications for select to authenticated using(recipient_id=auth.uid());
-- No direct write policies or grants. All mutations go through the validated RPC.
revoke all on public.organizations,public.facilities,public.memberships,public.referrals,public.referral_events,public.notifications,public.command_receipts from anon,authenticated;
grant select on public.organizations,public.facilities,public.memberships,public.referrals,public.referral_events,public.notifications to authenticated;

create function public.get_workspace() returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare profile jsonb;
begin
 select to_jsonb(m) into profile from public.memberships m where m.user_id=auth.uid();
 if profile is null then raise exception 'No TAFU membership. Ask the project administrator to provision this account.' using errcode='42501'; end if;
 return jsonb_build_object('profile',profile,
 'facilities',(select coalesce(jsonb_agg(to_jsonb(f) order by f.name),'[]') from public.facilities f),
 'workers',(select coalesce(jsonb_agg(to_jsonb(m) order by m.name),'[]') from public.memberships m where m.role='chw'),
 'referrals',(select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]') from public.referrals r),
 'events',(select coalesce(jsonb_agg(to_jsonb(e) order by e.occurred_at,e.recorded_at),'[]') from public.referral_events e),
 'notifications',(select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc),'[]') from public.notifications n));
end $$;

create function public.apply_command(p_request_id uuid,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare m public.memberships; r public.referrals; receipt public.command_receipts;
 result jsonb; event_time timestamptz; note_text text; target uuid;
begin
 select * into m from public.memberships where user_id=auth.uid();
 if m.user_id is null then raise exception 'Not authorized' using errcode='42501'; end if;
 if p_request_id is null or p_payload is null then raise exception 'Request ID and payload are required'; end if;
 perform pg_advisory_xact_lock(hashtextextended(m.user_id::text||p_request_id::text,0));
 select * into receipt from public.command_receipts where user_id=m.user_id and request_id=p_request_id;
 if found then
  if receipt.action<>p_action or receipt.payload<>p_payload then raise exception 'Request ID already used with different input'; end if;
  return receipt.result;
 end if;
 note_text=trim(coalesce(p_payload->>'note',''));
 if length(note_text)>500 then raise exception 'Note must be 500 characters or fewer'; end if;
 if p_action='create' then
  if m.role not in ('chw','supervisor') then raise exception 'Only CHWs and supervisors can create referrals' using errcode='42501'; end if;
  if length(trim(coalesce(p_payload->>'alias',''))) not between 1 and 80 or length(trim(coalesce(p_payload->>'village',''))) not between 1 and 80 or length(note_text)=0 then raise exception 'Alias, village and referral note are required'; end if;
  if not exists(select 1 from public.facilities where id=(p_payload->>'facility_id')::uuid and org_id=m.org_id) then raise exception 'Invalid facility'; end if;
  target=case when m.role='chw' then m.user_id else (p_payload->>'chw_id')::uuid end;
  if not exists(select 1 from public.memberships where user_id=target and role='chw' and org_id=m.org_id) then raise exception 'Select a valid community health worker'; end if;
  insert into public.referrals(org_id,alias,village,facility_id,chw_id,note)
   values(m.org_id,trim(p_payload->>'alias'),trim(p_payload->>'village'),(p_payload->>'facility_id')::uuid,target,note_text) returning * into r;
  insert into public.referral_events(referral_id,actor_id,kind,note,occurred_at) values(r.id,m.user_id,'created',note_text,r.created_at);
 elsif p_action='acknowledge' then
  update public.notifications set acknowledged_at=coalesce(acknowledged_at,now()) where id=(p_payload->>'notification_id')::uuid and recipient_id=m.user_id returning referral_id into target;
  if target is null then raise exception 'Notification not available' using errcode='42501'; end if;
  select * into r from public.referrals where id=target;
 else
  select * into r from public.referrals where id=(p_payload->>'referral_id')::uuid for update;
  if r.id is null or not public.can_read_referral(r.id) then raise exception 'Referral not available' using errcode='42501'; end if;
  if (p_payload->>'expected_version')::integer is distinct from r.version then raise exception 'This referral changed. Refresh before trying again.' using errcode='40001'; end if;
  if r.status='closed' then raise exception 'This referral is already closed'; end if;
  if p_action='follow_up' then
   if m.role not in ('supervisor','chw') then raise exception 'Not authorized for follow-up' using errcode='42501'; end if;
   if length(note_text)=0 then raise exception 'A follow-up note is required'; end if;
   event_time=(p_payload->>'due_at')::timestamptz;
   if event_time is null or event_time<=now() then raise exception 'Choose a future follow-up time'; end if;
   update public.referrals set follow_up_due=event_time,follow_up_owner=m.name,follow_up_note=note_text where id=r.id;
   event_time=now();
  else
   if m.role<>'facility' then raise exception 'Only receiving facility staff can record facility events' using errcode='42501'; end if;
   event_time=(p_payload->>'occurred_at')::timestamptz;
   if event_time is null or event_time>now()+interval '5 minutes' or event_time<r.created_at then raise exception 'Event time must be after referral creation and not in the future'; end if;
   if p_action='arrival' and r.status='referred' then
    update public.referrals set status='arrived',arrival_at=event_time where id=r.id;
   elsif p_action='seen' and r.status='arrived' and event_time>=r.arrival_at then
    update public.referrals set status='seen',seen_at=event_time where id=r.id;
   elsif p_action='outcome' and r.status='seen' and event_time>=r.seen_at then
    if length(note_text)=0 or coalesce(p_payload->>'outcome','') not in ('assessment_completed','adverse_outcome','other') then raise exception 'An outcome category and note are required'; end if;
    update public.referrals set status='closed',outcome=p_payload->>'outcome',outcome_at=event_time,follow_up_due=null where id=r.id;
    insert into public.notifications(referral_id,recipient_id) values(r.id,r.chw_id);
   else raise exception 'Invalid event order. Record arrival, clinician contact, then outcome.'; end if;
  end if;
  insert into public.referral_events(referral_id,actor_id,kind,note,occurred_at) values(r.id,m.user_id,p_action,note_text,event_time);
  update public.referrals set version=version+1,updated_at=now() where id=r.id returning * into r;
 end if;
 result=jsonb_build_object('referral_id',r.id,'code',r.code);
 insert into public.command_receipts(user_id,request_id,action,payload,result) values(m.user_id,p_request_id,p_action,p_payload,result);
 return result;
end $$;
revoke all on function public.member_org(), public.can_read_referral(uuid), public.get_workspace(), public.apply_command(uuid,text,jsonb) from public,anon;
grant execute on function public.member_org(), public.can_read_referral(uuid), public.get_workspace(), public.apply_command(uuid,text,jsonb) to authenticated;
