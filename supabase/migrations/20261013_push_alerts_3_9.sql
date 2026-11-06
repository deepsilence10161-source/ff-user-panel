/* ══════════════════════════════════════════════════════════════════════════
   3.9 PUSH NOTIFICATIONS (4 kism) — server-side wale 2 (baaki 2 badge-engine
   me client-side, kyunki wo stats wahi compute hote hain):
     1. badge unlock        → js/features/badge-engine.js : notifyNewBadges()
     2. badge near-unlock   → js/features/badge-engine.js : notifyNewBadges()
     3. season 24 ghante    → send_season_ending_alerts()  [cron: hourly]
     4. trial/premium 24 ghante → send_trial_expiry_alerts() [cron: hourly]

   Push ka raasta pehle se LIVE hai aur yahan duplicate NAHI kiya:
     notifications INSERT → trg_notifications_push → notifications_push_hook()
     → pg_net → push-send edge fn → OneSignal.
   Isliye ye functions sirf ASLI notification rows daalte hain (jhooth nahi:
   row sirf tab banti hai jab condition sach ho, aur ek hi baar — ref_id dup
   guard ke saath).

   Dono functions me:
     • p_dry_run  → sirf count return, koi row nahi (safe rehearsal)
     • p_now      → window kis waqt ke hisaab se (default now()) — testable,
                    production me cron default hi pass karta hai
     • per-row try/except — ek kharab row poore batch ko na roke
       (wahi pattern jo send_due_match_reminders me hai)
   ══════════════════════════════════════════════════════════════════════════ */

-- ── 3) SEASON KHATAM HONE ME 24 GHANTE ────────────────────────────────────
-- Season = monthly (features/seasonal-league.js + js/rank-system.js:
-- monthKey 'YYYY_MM'). Mahine ki aakhri second se 24 ghante ya kam bache →
-- us month_key wale ASLI participants (season_stats me row hai) ko ek baar.
CREATE OR REPLACE FUNCTION public.send_season_ending_alerts(
  p_dry_run boolean DEFAULT false,
  p_now     timestamptz DEFAULT now()
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r        record;
  v_end    timestamptz;
  v_key    text;
  v_label  text;
  v_n      integer := 0;
  v_c      integer := 0;
  v_num    integer;
BEGIN
  v_end := date_trunc('month', p_now) + interval '1 month' - interval '1 second';
  IF v_end - p_now > interval '24 hours' OR v_end - p_now < interval '0' THEN
    RETURN 0;                       -- 24 ghante se zyada bacha hai ya season nikal gaya
  END IF;

  v_key := to_char(p_now, 'YYYY_MM');
  v_num := EXTRACT(MONTH FROM p_now)::int + (EXTRACT(YEAR FROM p_now)::int - 2026) * 12 + 4;
  IF v_num < 1 THEN v_num := 1; END IF;
  v_label := 'Season ' || v_num || ' ''' || to_char(p_now, 'YY');

  IF p_dry_run THEN
    SELECT count(*) INTO v_c
      FROM public.season_stats ss
     WHERE ss.month_key = v_key
       AND NOT EXISTS (SELECT 1 FROM public.notifications n
                        WHERE n.user_id = ss.user_id AND n.type = 'season_ending'
                          AND n.ref_id = v_key);
    RETURN COALESCE(v_c, 0);
  END IF;

  FOR r IN
    SELECT ss.user_id
      FROM public.season_stats ss
     WHERE ss.month_key = v_key
       AND NOT EXISTS (SELECT 1 FROM public.notifications n
                        WHERE n.user_id = ss.user_id AND n.type = 'season_ending'
                          AND n.ref_id = v_key)
  LOOP
    BEGIN
      INSERT INTO public.notifications (user_id, type, title, body, ref_id)
      VALUES (r.user_id, 'season_ending',
              '🏆 ' || v_label || ' khatam hone me sirf 24 ghante!',
              'Aakhri mauka — abhi matches khelo, apni rank bachao aur season rewards pakdo.',
              v_key);
      v_n := v_n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'season_ending alert fail (user=%): %', r.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_n;
END $function$;

-- ── 4) TRIAL / PREMIUM KHATAM HONE ME 24 GHANTE ────────────────────────────
CREATE OR REPLACE FUNCTION public.send_trial_expiry_alerts(
  p_dry_run boolean DEFAULT false,
  p_now     timestamptz DEFAULT now()
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_n   integer := 0;
  v_ref text;
  r     record;
BEGIN
  IF p_dry_run THEN
    RETURN COALESCE((SELECT count(*) FROM public.users u
                      WHERE u.premium_expires IS NOT NULL
                        AND u.premium_expires > p_now
                        AND u.premium_expires - p_now <= interval '24 hours'
                        AND NOT EXISTS (SELECT 1 FROM public.notifications n
                                         WHERE n.user_id = u.id AND n.type = 'trial_expiry'
                                           AND n.ref_id = to_char(timezone('UTC', u.premium_expires), 'YYYY-MM-DD"T"HH24:MI'))), 0);
  END IF;

  FOR r IN
    SELECT u.id, u.premium_expires
      FROM public.users u
     WHERE u.premium_expires IS NOT NULL
       AND u.premium_expires > p_now
       AND u.premium_expires - p_now <= interval '24 hours'
  LOOP
    v_ref := to_char(timezone('UTC', r.premium_expires), 'YYYY-MM-DD"T"HH24:MI');
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM public.notifications n
                      WHERE n.user_id = r.id AND n.type = 'trial_expiry' AND n.ref_id = v_ref) THEN
        INSERT INTO public.notifications (user_id, type, title, body, ref_id)
        VALUES (r.id, 'trial_expiry',
                '⏳ Tumhara premium kal khatam ho raha hai',
                'Premium ' || to_char(timezone('Asia/Kolkata', r.premium_expires), 'DD Mon, HH24:MI')
                  || ' IST tak chalega — renew karo aur premium features banaye rakho.',
                v_ref);
        v_n := v_n + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'trial_expiry alert fail (user=%): %', r.id, SQLERRM;
    END;
  END LOOP;

  RETURN v_n;
END $function$;

-- ── Cron: dono hourly (server par, app band hone par bhi push jaye) ────────
DO $$
BEGIN
  PERFORM cron.unschedule('season-24h-alerts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'season-24h-alerts');
  PERFORM cron.unschedule('trial-expiry-alerts') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trial-expiry-alerts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('season-24h-alerts', '5 * * * *',
                     $cron$select public.send_season_ending_alerts();$cron$);
SELECT cron.schedule('trial-expiry-alerts', '35 * * * *',
                     $cron$select public.send_trial_expiry_alerts();$cron$);
