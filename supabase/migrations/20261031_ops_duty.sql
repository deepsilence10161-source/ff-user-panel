-- =====================================================================
-- 2026-10-31 OPS DUTY (Directive 19): owner ki duty-list, machine ke kandhon par
--   D1 ops-room-reminder  : T-20→T-14 window me room ID khali → owner push
--                           (T-10→0 khali → 🚨 urgent push)   [har 5 min]
--   D2 ops-checkin-watch  : in-room verification par LIVE najar (har 2 min):
--                           sab joined users in_room ✅ → "MATCH FULL" push
--                           T-3 par partial → "n/m verify" push
--                           start+8 tak KOI nahi aaya → auto cancel+refund+remove
--   D3 ops-chat-watch     : live match chat me distress keywords → owner push
--                           [har 3 min] (baaki messages mini-me session me padhta hai)
-- In-room data source: join_requests.in_room (confirm_in_room RPC, server-
-- authoritative since 2026-09-26) — koi naya client flow nahi, users ka
-- "I'm In Room ✅" button pehle se hai.
-- =====================================================================

-- ── D1: room reminder ────────────────────────────────────────────────
create or replace function public.ops_room_reminder() returns int
language plpgsql security definer as $$
declare r record; n int := 0;
begin
  for r in select m.id, m.title, m.scheduled_at from public.matches m
    where m.status = 'upcoming' and m.room_id is null
      and m.scheduled_at between now() + interval '14 minutes' and now() + interval '21 minutes'
  loop
    perform public.ops_notify(public.ops_owner_uid(),
      '⏰ Room time ho gaya',
      coalesce(r.title,'Match') || ' ' || to_char(r.scheduled_at at time zone 'Asia/Kolkata', 'HH24:MI') || ' IST ko start hai — T-15 window: Free Fire me room banao, ID/pass bharo.',
      'ops-room-reminder-' || r.id);
    n := n + 1;
  end loop;
  for r in select m.id, m.title, m.scheduled_at from public.matches m
    where m.status = 'upcoming' and m.room_id is null
      and m.scheduled_at between now() and now() + interval '10 minutes'
  loop
    perform public.ops_notify(public.ops_owner_uid(),
      '🚨 URGENT: room ID abhi tak nahi',
      coalesce(r.title,'Match') || ' ABHI start hone wala hai aur room ID/pass khali hai! Users ko T-5 pe creds chahiye.',
      'ops-room-urgent-' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ── D2: in-room verification live watch ─────────────────────────────
create or replace function public.ops_checkin_watch() returns int
language plpgsql security definer as $$
declare r record; n int := 0;
begin
  for r in
    select m.id, m.title, m.scheduled_at,
           (select count(*) from public.join_requests jr
             where jr.match_id = m.id and jr.status not in ('refunded','cancelled','rejected')) as joined,
           (select count(*) from public.join_requests jr
             where jr.match_id = m.id and jr.in_room = true) as chk
      from public.matches m
     where m.room_status = 'released' and m.status in ('upcoming','live')
       and m.scheduled_at between now() - interval '12 minutes' and now() + interval '30 minutes'
  loop
    if r.joined > 0 and r.chk >= r.joined then
      perform public.ops_notify(public.ops_owner_uid(),
        '✅ Match FULL ho gaya',
        coalesce(r.title,'Match') || ': ' || r.chk || '/' || r.joined || ' players in-room verified — sab aa gaye, start kar sakte ho!',
        'ops-full-' || r.id);
      n := n + 1;
    elsif now() > r.scheduled_at - interval '3 minutes' and now() < r.scheduled_at + interval '8 minutes'
          and r.chk > 0 and r.chk < r.joined then
      perform public.ops_notify(public.ops_owner_uid(),
        '⚠️ Partial attendance',
        coalesce(r.title,'Match') || ': ' || r.chk || '/' || r.joined || ' in-room verify hue — baaki abhi nahi aaye.',
        'ops-partial-' || r.id);
      n := n + 1;
    elsif now() > r.scheduled_at + interval '8 minutes' and r.chk = 0 then
      perform public.cancel_match_with_refunds(r.id, public.ops_owner_uid());
      perform public.ops_notify(public.ops_owner_uid(),
        '❌ Koi nahi aaya — match hata diya',
        coalesce(r.title,'Match') || ' me 0 players in-room verify hue, isliye match auto-remove + refunds ho gaye.',
        'ops-empty-' || r.id);
      insert into public.notifications (user_id, type, title, body, ref_id)
      select jr.user_id, 'match', '❌ Match remove hua',
             coalesce(r.title,'Match') || ' me koi player room me nahi aaya, isliye match cancel — entry fee refund ho gayi.',
             'ops-empty-user-' || r.id || '-' || jr.user_id
        from public.join_requests jr
       where jr.match_id = r.id
         and jr.status not in ('refunded','cancelled','rejected')
         and not exists (select 1 from public.notifications n2
                          where n2.ref_id = 'ops-empty-user-' || r.id || '-' || jr.user_id);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ── D3: live match chat watch ────────────────────────────────────────
create or replace function public.ops_chat_watch() returns int
language plpgsql security definer as $$
declare
  last_ts timestamptz;
  r record; n int := 0;
begin
  select (value->>'chat_scan')::timestamptz into last_ts from public.ops_config where key = 'owner_uid';
  if last_ts is null then last_ts := now() - interval '10 minutes'; end if;
  for r in select mc.id, mc.name, mc.text, mc.match_id from public.match_chat mc
    where mc.created_at > last_ts and mc.created_at <= now()
      and mc.text ~* 'problem|issue|madad|help|refund|fraud|galat|nahi mila|error|hack|cheat|urgent|phasa|atka|password.*nahi|room.*nahi|slot.*nahi'
  loop
    perform public.ops_notify(public.ops_owner_uid(),
      '💬 Match chat me problem',
      coalesce(r.name,'User') || ': "' || left(r.text, 140) || '"',
      'ops-chat-' || r.id);
    n := n + 1;
  end loop;
  update public.ops_config set value = value || jsonb_build_object('chat_scan', now()) where key = 'owner_uid';
  return n;
end $$;

-- ── crons (permission-probed) ─────────────────────────────────────────
do $do$
begin
  perform cron.schedule('ops-room-reminder', '*/5 * * * *', $$select public.ops_room_reminder()$$);
  perform cron.schedule('ops-checkin-watch', '*/2 * * * *', $$select public.ops_checkin_watch()$$);
  perform cron.schedule('ops-chat-watch',    '*/3 * * * *', $$select public.ops_chat_watch()$$);
exception when others then
  raise notice 'cron schedule skip: %', sqlerrm;
end $do$;

select json_build_object(
  'in_room_col',  (select count(*) from information_schema.columns
                    where table_schema='public' and table_name='join_requests' and column_name='in_room'),
  'duty_fns',     (select count(*) from pg_proc where proname in ('ops_room_reminder','ops_checkin_watch','ops_chat_watch')),
  'duty_crons',   (select coalesce(json_agg(jobname), '[]'::json) from cron.job where jobname in ('ops-room-reminder','ops-checkin-watch','ops-chat-watch'))
) as ops_duty_state;
