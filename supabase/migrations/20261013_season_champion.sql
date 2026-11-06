/* ══════════════════════════════════════════════════════════════════════════
   3.8/11 SEASON CHAMPION KA BADA AILAAN (2026-10-13)
   Plan: "सीज़न आख़िर में Season Champion special कला का बड़ा ऐलान
          + होम बैनर 3 दिन"

   Season = monthly (js/rank-system.js: monthKey 'YYYY_MM', Season 1 = Apr 2026).
   Champion = us season ka #1 leaderboard par — aur leaderboard ka apna default
   metric KILLS hai (features/seasonal-league.js ka strip bhi isi par chalta hai),
   isliye champion bhi total_kills se — home, rank screen aur ye ailaan teeno
   ek hi baat bolte hain. (IZAT ka niyam: aisa metric nahi jo kahin dikhta na ho.)

   Kaise chalta hai (poora automatic, app band ho tab bhi):
     pg_cron 'season-champion-declare' (har mahine ki 1 tareekh 00:10)
       → declare_season_champion()
         → pichhle mahine ka month_key (p_now - 1 din)
         → leaderboard ka #1 → season_champions me EK row (idempotent)
         → champion ko personal push notification (wahi notifications trigger)
   Ailaan 3 din: season_champions.banner_until = declare ke 3 din baad —
   home banner utni hi der dikhta hai (uske baad apne aap gayab, jhootha
   purana "champion" chipka nahi rehta).

   p_dry_run / p_now: rehearsal + testable (cron default hi pass karta hai).
   ══════════════════════════════════════════════════════════════════════════ */

CREATE TABLE IF NOT EXISTS public.season_champions (
  month_key   text PRIMARY KEY,
  user_id     text NOT NULL,
  ign         text,
  kills       integer,
  wins        integer,
  rank_points integer,
  declared_at timestamptz NOT NULL DEFAULT now(),
  banner_until timestamptz NOT NULL
);

ALTER TABLE public.season_champions ENABLE ROW LEVEL SECURITY;

/* Sabko dikhna chahiye (bada ailaan) — likhna sirf SECURITY DEFINER function
   se (koi bhi user khud ko champion nahi bana sakta). */
DROP POLICY IF EXISTS season_champions_read ON public.season_champions;
CREATE POLICY season_champions_read ON public.season_champions FOR SELECT USING (true);

/* Admin panel se manual correction/announcement (asli admin hi) — warna
   declare sirf SECURITY DEFINER function se hota hai. */
DROP POLICY IF EXISTS season_champions_admin_write ON public.season_champions;
CREATE POLICY season_champions_admin_write ON public.season_champions
  FOR ALL USING (public.is_caller_admin()) WITH CHECK (public.is_caller_admin());

CREATE OR REPLACE FUNCTION public.declare_season_champion(
  p_dry_run boolean DEFAULT false,
  p_now     timestamptz DEFAULT now()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_key   text;
  v_num   integer;
  v_label text;
  c       record;
BEGIN
  /* jo season abhi khatam hua (aaj se 1 din pehle wala month) */
  v_key := to_char(p_now - interval '1 day', 'YYYY_MM');
  v_num := EXTRACT(MONTH FROM (p_now - interval '1 day'))::int
           + (EXTRACT(YEAR FROM (p_now - interval '1 day'))::int - 2026) * 12 + 4;
  IF v_num < 1 THEN v_num := 1; END IF;
  v_label := 'Season ' || v_num || ' ''' || to_char(p_now - interval '1 day', 'YY');

  SELECT l.id, COALESCE(l.ign, 'Player') AS ign,
         COALESCE(l.total_kills, 0)::int AS kills,
         COALESCE(l.total_wins, 0)::int AS wins,
         COALESCE(l.rank_points, 0)::int AS rp
    INTO c
    FROM public.leaderboard l
    LEFT JOIN public.users u ON u.id = l.id
   WHERE l.id IS NOT NULL
     AND COALESCE(u.is_banned, false) = false
     /* QA/residue accounts kabhi champion nahi (jhoothi kahani nahi) */
     AND COALESCE(l.ign, '') !~* '^(t?riqa[-_ ]|qa[-_ ]|zz[-_ ])'
   ORDER BY COALESCE(l.total_kills, 0) DESC, COALESCE(l.total_wins, 0) DESC
   LIMIT 1;

  IF c.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_leaderboard_rows');
  END IF;

  IF EXISTS (SELECT 1 FROM public.season_champions WHERE month_key = v_key) THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'month_key', v_key);
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object('ok', true, 'dry', true, 'month_key', v_key,
                              'label', v_label, 'uid', c.id, 'ign', c.ign, 'kills', c.kills);
  END IF;

  INSERT INTO public.season_champions (month_key, user_id, ign, kills, wins, rank_points, banner_until)
  /* banner hamesha DECLARE ke 3 din (asli ab se) — p_now sirf "kis season ka"
     tay karta hai, banner ki lambai nahi (test/backfill me bhi jhootha lamba
     ailaan nahi chalta) */
  VALUES (v_key, c.id, c.ign, c.kills, c.wins, c.rp, now() + interval '3 days')
  ON CONFLICT (month_key) DO NOTHING;

  /* champion ko bada ailaan — push wahi purana raasta (notifications trigger) */
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.notifications n
                    WHERE n.user_id = c.id AND n.type = 'season_champion' AND n.ref_id = v_key) THEN
      INSERT INTO public.notifications (user_id, type, title, body, ref_id)
      VALUES (c.id, 'season_champion',
              '🏆 ' || v_label || ' ke CHAMPION — tum ho!',
              'Sabse zyada kills (' || c.kills || ') — special Season Champion kala tumhari collection me lag gayi. Home par bada ailaan 3 din chalega!',
              v_key);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'season_champion notify fail (uid=%): %', c.id, SQLERRM;
  END;

  RETURN jsonb_build_object('ok', true, 'month_key', v_key, 'label', v_label,
                            'uid', c.id, 'ign', c.ign, 'kills', c.kills);
END $function$;

-- ── cron: har mahine ki 1 tareekh (declared once, idempotent guard andar) ──
DO $$
BEGIN
  PERFORM cron.unschedule('season-champion-declare') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'season-champion-declare');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('season-champion-declare', '10 0 1 * *',
                     $cron$select public.declare_season_champion();$cron$);
