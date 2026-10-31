-- =====================================================================
-- 2026-10-31 OPS AUTONOMY (Directive 18, batch 1)
-- Owner sirf Free Fire sambhalta hai (room + ID/pass + FF on).
-- Baaki sab machine sambhalti hai — aur owner ko PHONE PE PUSH karti
-- rehti hai (notifications INSERT → trg_notifications_push → FCM,
-- Hunter7 device proven chain). Teen guards:
--   G2  ops-auto-cancel   : T+10 tak room release nahi → auto cancel
--                           + poora refund + joined users ko auto-push
--   G5a ops-exception-watch: room-ID nahi bhara (T-2h), result pending
--                           (T+3h), withdrawal 24h pending → owner push
--   G5b ops-daily-digest  : roz 09:00 IST ek summary push owner ko
-- Sab throttled: har alert ek match/request ke liye EK BAAR (ref_id).
-- =====================================================================

create table if not exists public.ops_config (
  key   text primary key,
  value jsonb not null default '{}'::jsonb
);
insert into public.ops_config (key, value)
select 'owner_uid', jsonb_build_object('uid', (select id from public.users where ign = 'Hunter7' order by created_at limit 1))
on conflict (key) do nothing;

create or replace function public.ops_owner_uid() returns text
language sql stable as $$
  select value->>'uid' from public.ops_config where key = 'owner_uid'
$$;

-- thottled owner/user notify: ref_id se dedupe
create or replace function public.ops_notify(p_uid text, p_title text, p_body text, p_ref text)
returns void language plpgsql security definer as $$
begin
  if exists (select 1 from public.notifications where ref_id = p_ref and user_id = p_uid) then return; end if;
  insert into public.notifications (user_id, type, title, body, ref_id)
  values (p_uid, 'ops', p_title, p_body, p_ref);
end $$;

-- ── G2: stale match auto-cancel + refunds + user pushes ─────────────
create or replace function public.ops_auto_cancel_stale() returns int
language plpgsql security definer as $$
declare r record; n int := 0;
begin
  for r in
    select m.id, m.title from public.matches m
     where m.status = 'upcoming'
       and m.scheduled_at < now() - interval '10 minutes'
       and coalesce(m.room_status, 'pending') <> 'released'
  loop
    perform public.cancel_match_with_refunds(r.id, public.ops_owner_uid());
    insert into public.notifications (user_id, type, title, body, ref_id)
    select jr.user_id, 'match', '❌ Match cancel — room release nahi hua',
           coalesce(r.title, 'Match') || ' time par start nahi ho paya. Entry fee POORI refund ho gayi hai — wallet me dekho.',
           'ops-cancel-' || r.id || '-' || jr.user_id
      from public.join_requests jr
     where jr.match_id = r.id
       and jr.status not in ('refunded', 'cancelled', 'rejected')
       and not exists (select 1 from public.notifications n2
                        where n2.ref_id = 'ops-cancel-' || r.id || '-' || jr.user_id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ── G5a: exception watch → owner push ────────────────────────────────
create or replace function public.ops_exception_watch() returns int
language plpgsql security definer as $$
declare r record; n int := 0;
begin
  -- (a) match 2h ke andar, room ID/pass abhi tak khali
  for r in select m.id, m.title, m.scheduled_at from public.matches m
    where m.status = 'upcoming' and m.room_id is null
      and m.scheduled_at between now() and now() + interval '2 hours'
  loop
    perform public.ops_notify(public.ops_owner_uid(),
      '⏰ Room ID baaki hai',
      coalesce(r.title,'Match') || ' ' || to_char(r.scheduled_at at time zone 'Asia/Kolkata', 'HH24:MI') || ' IST ko hai — room ID/pass abhi tak nahi bhara!',
      'ops-room-missing-' || r.id);
    n := n + 1;
  end loop;
  -- (b) match live tha par 3h baad bhi result nahi
  for r in select m.id, m.title from public.matches m
    where m.status = 'live' and m.scheduled_at < now() - interval '3 hours'
  loop
    perform public.ops_notify(public.ops_owner_uid(),
      '📸 Result pending',
      coalesce(r.title,'Match') || ' ka result abhi tak process nahi hua — screenshots upload karo ya creator result check karo.',
      'ops-result-pending-' || r.id);
    n := n + 1;
  end loop;
  -- (c) withdrawal 24h se pending
  for r in select id, ign, amount_inr from public.sd_requests
    where status = 'pending' and created_at < now() - interval '24 hours'
  loop
    perform public.ops_notify(public.ops_owner_uid(),
      '💸 Withdrawal 24h+ pending',
      coalesce(r.ign,'User') || ' ka ₹' || coalesce(r.amount_inr,0)::text || ' withdrawal 24 ghante se pending hai.',
      'ops-wd-pending-' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ── G5b: daily digest (09:00 IST) → owner push ───────────────────────
create or replace function public.ops_daily_digest() returns int
language plpgsql security definer as $$
declare
  v_matches int; v_joins int; v_cancel int; v_pend int; v_wd int;
begin
  select count(*) into v_matches from public.matches where scheduled_at::date = current_date;
  select count(*) into v_joins   from public.join_requests jr join public.matches m on m.id = jr.match_id
    where m.scheduled_at::date = current_date and jr.status not in ('refunded','cancelled','rejected');
  select count(*) into v_cancel  from public.matches where status = 'cancelled' and scheduled_at::date = current_date;
  select count(*) into v_pend   from public.matches where status = 'live' and scheduled_at < now() - interval '3 hours';
  select count(*) into v_wd     from public.sd_requests where status = 'pending';
  perform public.ops_notify(public.ops_owner_uid(),
    '📊 Aaj ka Mini eSports digest',
    'Aaj ' || v_matches || ' match · ' || v_joins || ' joins · ' || v_cancel || ' cancel · result pending: ' || v_pend || ' · withdrawals pending: ' || v_wd || '. Sab theek ho to koi kaam nahi 🙂',
    'ops-digest-' || current_date);
  return 1;
end $$;

-- ── cron jobs (permission-probed: deny ho to run fail NAHI hota) ─────
do $do$
begin
  perform cron.schedule('ops-auto-cancel',     '*/5 * * * *',  $$select public.ops_auto_cancel_stale()$$);
  perform cron.schedule('ops-exception-watch', '*/10 * * * *', $$select public.ops_exception_watch()$$);
  perform cron.schedule('ops-daily-digest',    '30 3 * * *',   $$select public.ops_daily_digest()$$);
exception when others then
  raise notice 'cron schedule skip: %', sqlerrm;
end $do$;

select json_build_object(
  'owner_uid',    public.ops_owner_uid(),
  'cron_jobs',    (select coalesce(json_agg(jobname), '[]'::json) from cron.job where jobname like 'ops-%'),
  'fns_ready',    (select count(*) from pg_proc where proname in ('ops_auto_cancel_stale','ops_exception_watch','ops_daily_digest','ops_notify','ops_owner_uid'))
) as ops_autonomy_state;
