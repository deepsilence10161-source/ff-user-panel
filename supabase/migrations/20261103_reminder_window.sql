-- =====================================================================
-- 2026-11-03 REMINDER WINDOW FIX (live-testing me pakda):
--   ops_room_reminder ka window [now+14, now+21] tha — 5-min cron ticks
--   ke beech me diff is window se phisal jata tha (run 41545708197: M7
--   ko reminder NAHI mili, exception-watch ki T-2h alert gayi).
--   Fix: window [now+12, now+26] — har match ko kam se kam 2 ticks
--   milte hain; dedup (ops_notify ref) se push EK hi baar jaati hai,
--   aur wo start se ~15-20 min pehle (owner ka hukm) hi jaati hai.
-- =====================================================================
create or replace function public.ops_room_reminder() returns int
language plpgsql security definer as $$
declare r record; n int := 0;
begin
  for r in select m.id, m.title, m.scheduled_at from public.matches m
    where m.status = 'upcoming' and m.room_id is null
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
select json_build_object('reminder_fn', (select count(*) from pg_proc where proname='ops_room_reminder'), 'window', '12-26 min pre-start, dedup ek push') as reminder_window_state;
