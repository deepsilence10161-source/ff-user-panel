-- =====================================================================
-- 2026-11-01 NO-SHOW FORFEIT POLICY (owner rule):
--   "Jo user match me nahi aayega usko refund nahi milega — galti
--    uski hai late hone ki, hamari nahi."
--   FAIRNESS LINE (barkarar): HAMARI galti (room release nahi hua →
--   ops-auto-cancel-stale) = poora refund. Ye function sirf user-side
--   no-show handle karta hai:
--   1) start+8 min: jo joined user in_room verify nahi hua → jr.status
--      'cancelled' (no refund row, no claim, no prize) + forfeit push.
--      Jo aaye (approved) unka paisa safe — agar match baad me admin
--      cancel kare to sirf PRESENT users ko refund milta hai.
--   2) Zero-attendance: match directly 'cancelled' (bina refunds) +
--      sabko forfeit push + owner ko report.
-- =====================================================================

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
     where m.room_status = 'released' and m.status in ('upcoming','live')
       and m.scheduled_at between now() - interval '12 minutes' and now() + interval '30 minutes'
  loop
    -- ✅ FULL attendance → owner ko khushkhabri
    if r.joined > 0 and r.chk >= r.joined then
      perform public.ops_notify(public.ops_owner_uid(),
        '✅ Match FULL ho gaya',
        coalesce(r.title,'Match') || ': ' || r.chk || '/' || r.joined || ' players in-room verified — sab aa gaye, start kar sakte ho!',
        'ops-full-' || r.id);
      n := n + 1;

    -- ⚠️ Partial (T-3 se start+8 tak) → owner ko info
    elsif now() > r.scheduled_at - interval '3 minutes' and now() < r.scheduled_at + interval '8 minutes'
          and r.chk > 0 and r.chk < r.joined then
      perform public.ops_notify(public.ops_owner_uid(),
        '⚠️ Partial attendance',
        coalesce(r.title,'Match') || ': ' || r.chk || '/' || r.joined || ' in-room verify hue — baaki abhi nahi aaye.',
        'ops-partial-' || r.id);
      n := n + 1;
    end if;

    -- ❌ start+8 min: NO-SHOW FORFEIT (late/absent = user ki galti = refund nahi)
    if now() > r.scheduled_at + interval '8 minutes' then
      select count(*) into noshow from public.join_requests jr
        where jr.match_id = r.id and jr.status = 'approved'
          and coalesce(jr.in_room, false) = false;

      if noshow > 0 then
        -- absent users ko 'cancelled' mark karo (no refund row banta, claim bhi nahi)
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

      -- Zero-attendance: match khud hata do (BINA refunds — sab absent the)
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

select json_build_object(
  'fn_updated', (select count(*) from pg_proc where proname = 'ops_checkin_watch'),
  'policy_line', 'our-fault=refund (ops-auto-cancel-stale untouched), user-no-show=forfeit'
) as noshow_policy_state;
