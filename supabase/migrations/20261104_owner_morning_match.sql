-- Owner ka match: kal 4 Nov 2026, 10:00 AM IST (= 04:30 UTC)
-- Hunter7 (TyHtzFOnggMxWbEdTnTdEl2j7oF3) ke JWT claim ke saath production
-- RPC creator_create_match hi call hota hai — koi shortcut nahi.
update public.users
   set is_creator = true,
       premium_level = greatest(coalesce(premium_level, 0), 1),
       premium_expires = greatest(coalesce(premium_expires, now()), now() + interval '120 days')
 where id = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3';

with cfg as (
  select set_config('request.jwt.claims', '{"sub":"TyHtzFOnggMxWbEdTnTdEl2j7oF3","role":"authenticated"}', true) as s
), res as (
  select public.creator_create_match(
    '🔥 Morning Battle — Mini eSports', 'solo', 'coins', 10, 48, 1,
    '2026-11-04 04:30:00+00'::timestamptz, 200, 100, 50) as r
  from cfg
)
select json_build_object(
  'rpc_result', (select r from res),
  'match_row', (select to_jsonb(x) from (
      select m.*, to_char(m.scheduled_at at time zone 'Asia/Kolkata','DD Mon YYYY HH12:MI AM') as time_ist
        from public.matches m
       where m.title like '🔥 Morning Battle%'
       order by m.created_at desc limit 1) x)
) as match_proof;
