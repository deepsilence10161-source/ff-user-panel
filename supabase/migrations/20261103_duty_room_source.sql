-- =====================================================================
-- 2026-11-03 DUTY ROOM-SOURCE FIX (deep live-testing me pakda ASLI bug):
--   creator_set_room matches row me room_id NAHI likhta (security design —
--   MF22 proof: room_id null, room_status='saved'). Creds alag secure
--   storage me hain. Meri teen duty functions room_id is null / not null
--   dekhti thin → (1) ops_checkin_watch creator matches ko kabhi watch
--   hi nahi karti thi (run 41551427907 MF41/MF44 isi se fail),
--   (2) ops_exception_watch creator matches par JHOOTHI 'room-missing'
--   alerts bhejta tha (probe me ops-room-missing-cm_bdda8...),
--   (3) ops_room_reminder bhi creator-set room par false reminder deta.
--   Sahi signal: room_status ('saved' = creator ne room set kiya,
--   'released' = admin path) YA room_id not null (admin legacy).
-- =====================================================================

-- ── 1) checkin watch: room-set = status saved/released OR room_id ──
create or replace function public.ops_checkin_watch() returns int
language plpgsql security definer as $$
declare r record; u record; n int := 0; noshow int;
begin
  for r in
    select m.id, m.title, m.scheduled_at,
           (select count(*) from public.join_requests jr
             where jr.match_id = m.id and jr.status not in ('refunded','cancelled','rejected')) as joined,
           (select count(*) from public.join_requests jr
             where jr.match_id = m.id and jr.in_room = true) as chk
      from public.matches m
     where m.status in ('upcoming','live')
       and ( m.room_status in ('saved','released') or m.room_id is not null )
       and ( m.room_status = 'released' or m.room_id is not null
             or now() >= m.scheduled_at - (coalesce(m.room_release_minutes, 5) * interval '1 minute') )
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
    end if;

    if now() > r.scheduled_at + interval '8 minutes' then
      select count(*) into noshow from public.join_requests jr
        where jr.match_id = r.id and jr.status = 'approved'
          and coalesce(jr.in_room, false) = false;

      if noshow > 0 then
        update public.join_requests set status = 'cancelled'
          where match_id = r.id and status = 'approved'
            and coalesce(in_room, false) = false;

        for u in select jr.user_id from public.join_requests jr
                  where jr.match_id = r.id and jr.status = 'cancelled'
                    and coalesce(jr.in_room, false) = false
        loop
          insert into public.notifications (user_id, type, title, body, ref_id)
          select u.user_id, 'match', '❌ Aap match me nahi aaye — entry forfeit',
                 coalesce(r.title,'Match') || ' start ho chuka tha aur aap in-room verify nahi hue. Rule: late/absent hone par entry fee forfeit hoti hai (galti player ki taraf).',
                 'ops-noshow-' || r.id || '-' || u.user_id
          where not exists (select 1 from public.notifications n2
                             where n2.ref_id = 'ops-noshow-' || r.id || '-' || u.user_id);
        end loop;

        perform public.ops_notify(public.ops_owner_uid(),
          '⏰ No-show forfeit laga diya',
          coalesce(r.title,'Match') || ': ' || noshow || ' player(s) nahi aaye — entries forfeit (koi refund nahi). Jo aaye unka match aage.',
          'ops-noshow-report-' || r.id);
        n := n + 1;
      end if;

      if r.joined > 0 and r.chk = 0 and now() > r.scheduled_at + interval '8 minutes' then
        update public.matches set status = 'cancelled' where id = r.id and status <> 'cancelled';
        update public.join_requests set status = 'cancelled'
          where match_id = r.id and status not in ('refunded','cancelled','rejected');
        insert into public.notifications (user_id, type, title, body, ref_id)
        select jr.user_id, 'match', '❌ Match remove — koi player nahi aaya',
               coalesce(r.title,'Match') || ' me koi bhi player room me nahi aaya, isliye match remove kar diya gaya. Rule ke mutabik absent players ki entry forfeit hai.',
               'ops-empty-user-' || r.id || '-' || jr.user_id
          from public.join_requests jr
         where jr.match_id = r.id
           and not exists (select 1 from public.notifications n2
                            where n2.ref_id = 'ops-empty-user-' || r.id || '-' || jr.user_id);
        perform public.ops_notify(public.ops_owner_uid(),
          '❌ Koi nahi aaya — match hata diya (forfeit)',
          coalesce(r.title,'Match') || ': 0/' || r.joined || ' players aaye → match auto-remove. Sab entries forfeit (user-side rule, koi refund nahi).',
          'ops-empty-' || r.id);
        n := n + 1;
      end if;
    end if;
  end loop;
  return n;
end $$;

-- ── 2) exception watch: room-missing sirf jab room SET hi nahi hua ──
create or replace function public.ops_exception_watch() returns int
language plpgsql security definer as $$
declare r record; n int := 0;
begin
  for r in select m.id, m.title, m.scheduled_at from public.matches m
    where m.status = 'upcoming' and m.room_id is null
      and coalesce(m.room_status, 'pending') not in ('saved','released')
      and m.scheduled_at between now() and now() + interval '2 hours'
  loop
    perform public.ops_notify(public.ops_owner_uid(),
      '⏰ Room ID baaki hai',
      coalesce(r.title,'Match') || ' ' || to_char(r.scheduled_at at time zone 'Asia/Kolkata', 'HH24:MI') || ' IST ko hai — room ID/pass abhi tak nahi bhara!',
      'ops-room-missing-' || r.id);
    n := n + 1;
  end loop;
  for r in select m.id, m.title from public.matches m
    where m.status = 'live' and m.scheduled_at < now() - interval '3 hours'
  loop
    perform public.ops_notify(public.ops_owner_uid(),
      '📸 Result pending',
      coalesce(r.title,'Match') || ' ka result abhi tak process nahi hua — screenshots upload karo ya creator result check karo.',
      'ops-result-pending-' || r.id);
    n := n + 1;
  end loop;
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

-- ── 3) reminder: sirf jab room SET hi nahi (creator-set par false push nahi) ──
create or replace function public.ops_room_reminder() returns int
language plpgsql security definer as $$
declare r record; n int := 0;
begin
  for r in select m.id, m.title, m.scheduled_at from public.matches m
    where m.status = 'upcoming' and m.room_id is null
      and coalesce(m.room_status, 'pending') not in ('saved','released')
      and m.scheduled_at between now() + interval '12 minutes' and now() + interval '26 minutes'
  loop
    perform public.ops_notify(public.ops_owner_uid(),
      '⏰ Room time ho gaya',
      coalesce(r.title,'Match') || ' ' || to_char(r.scheduled_at at time zone 'Asia/Kolkata', 'HH24:MI') || ' IST ko start hai — T-15 window: Free Fire me room banao, ID/pass bharo.',
      'ops-room-reminder-' || r.id);
    n := n + 1;
  end loop;
  for r in select m.id, m.title, m.scheduled_at from public.matches m
    where m.status = 'upcoming' and m.room_id is null
      and coalesce(m.room_status, 'pending') not in ('saved','released')
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

select json_build_object(
  'fns', (select count(*) from pg_proc where proname in ('ops_checkin_watch','ops_exception_watch','ops_room_reminder')),
  'room_signal', 'room_status saved/released OR room_id not null'
) as room_source_fix_state;
