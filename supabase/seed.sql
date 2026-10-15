-- Synthetic records only. Local identities are not Supabase Auth users.
insert into public.organizations values('00000000-0000-4000-8000-000000000001','Lushoto Demo Team');
insert into public.facilities values
 ('20000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Highland Demo Hospital'),
 ('20000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Valley Demo Hospital');
insert into public.memberships values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Maria','supervisor',null),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','Grace M.','chw',null),
 ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001','Neema K.','chw',null),
 ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','Highland receiving team','facility','20000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000001','Valley receiving team','facility','20000000-0000-4000-8000-000000000002');
insert into public.referrals(id,org_id,code,alias,village,facility_id,chw_id,note,status,created_at,arrival_at,seen_at,outcome_at,outcome,follow_up_due,follow_up_owner,follow_up_note)
select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'00000000-0000-4000-8000-000000000001','R-'||lpad(i::text,3,'0'),
 case when i=1 then 'Amina' else 'Patient '||chr(64+i) end,
 (array['Mlalo','Mtae','Soni','Bumbuli'])[(i-1)%4+1],
 case when i%2=1 then '20000000-0000-4000-8000-000000000001' else '20000000-0000-4000-8000-000000000002' end::uuid,
 case when i%2=1 then '10000000-0000-4000-8000-000000000002' else '10000000-0000-4000-8000-000000000003' end::uuid,
 'Facility assessment requested · synthetic demo',
 case when i>8 then 'closed' when i=7 then 'arrived' when i=8 then 'seen' else 'referred' end,
 now()-interval '1 day'-i*interval '1 hour',
 case when i>=7 then now()-interval '12 hours' end,
 case when i>=8 then now()-interval '11 hours' end,
 case when i>8 then now()-interval '10 hours' end,
 case when i>8 then 'assessment_completed' end,
 case when i<=3 then now()-interval '1 hour' end,
 case when i<=3 then 'Maria' end,
 case when i<=3 then 'Transport remains unconfirmed. Contact the assigned CHW.' end
from generate_series(1,12) i;
insert into public.referral_events(referral_id,actor_id,kind,note,occurred_at)
select id,chw_id,'created',note,created_at from public.referrals;
insert into public.referral_events(referral_id,actor_id,kind,note,occurred_at)
select id,case when facility_id='20000000-0000-4000-8000-000000000001' then '10000000-0000-4000-8000-000000000004' else '10000000-0000-4000-8000-000000000005' end::uuid,'arrival','Synthetic facility event',arrival_at from public.referrals where arrival_at is not null;
insert into public.referral_events(referral_id,actor_id,kind,note,occurred_at)
select id,case when facility_id='20000000-0000-4000-8000-000000000001' then '10000000-0000-4000-8000-000000000004' else '10000000-0000-4000-8000-000000000005' end::uuid,'seen','Synthetic facility event',seen_at from public.referrals where seen_at is not null;
insert into public.referral_events(referral_id,actor_id,kind,note,occurred_at)
select id,case when facility_id='20000000-0000-4000-8000-000000000001' then '10000000-0000-4000-8000-000000000004' else '10000000-0000-4000-8000-000000000005' end::uuid,'outcome','Assessment completed · synthetic demo',outcome_at from public.referrals where outcome_at is not null;
insert into public.notifications(referral_id,recipient_id) select id,chw_id from public.referrals where status='closed';
