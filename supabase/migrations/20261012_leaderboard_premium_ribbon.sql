-- ═══════════════════════════════════════════════════════════════════════════
--  2026-10-12 — Premium ribbon IGN ke aage (leaderboard par sabko dikhe)
-- ═══════════════════════════════════════════════════════════════════════════
--  KYUN:
--    "Premium ribbon IGN ke aage" — apne profile/player-card par ribbon pehle
--    se dikhta hai, par DOOSRE players ko nahi (users table ki RLS: ek user
--    sirf apni row padh sakta hai). Attraction ke liye zaroori hai ki doosre
--    log bhi dekhein ki premium kya dikhta hai — isliye leaderboard (jo
--    PUBLIC read hai: policy lb_select_all = true) me premium status sync
--    karte hain.
--
--  KYA BADALTA HAI:
--    1. leaderboard me do naye column: premium_level, premium_expires
--    2. sync_leaderboard() unhe bhi bharta/update karta hai
--    3. trg_sync_leaderboard ke column list me premium_level/premium_expires
--       add — WARNA premium badalne par trigger fire hi nahi hoga
--       (pehle sirf ign/avatar/city/ff_uid/rank_points/stats/is_banned/
--        leaderboard_hidden par tha)
--    4. ek baar ka backfill — maujooda rows
--
--  ⚠️ "jhoota dava nahi" (app ka rule): leaderboard row me premium_EXPIRES bhi
--     jata hai, aur app ribbon sirf tab dikhata hai jab
--     `level > 0 AND (expires IS NULL OR expires > now)` — yani expire hone ke
--     baad ribbon apne aap gayab, DB me cron ka intezaar nahi.
--
--  ROLLBACK:
--    drop trigger trg_sync_leaderboard on public.users;
--    create trigger trg_sync_leaderboard after insert or update of ign, avatar_url,
--      city, ff_uid, rank_points, total_wins, total_kills, total_matches, is_banned,
--      leaderboard_hidden on public.users for each row execute function sync_leaderboard();
--    -- (purana sync_leaderboard body wapas) ; phir:
--    alter table public.leaderboard drop column if exists premium_level;
--    alter table public.leaderboard drop column if exists premium_expires;
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.leaderboard
  ADD COLUMN IF NOT EXISTS premium_level   integer     NOT NULL DEFAULT 0;

ALTER TABLE public.leaderboard
  ADD COLUMN IF NOT EXISTS premium_expires timestamptz;

CREATE OR REPLACE FUNCTION public.sync_leaderboard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(NEW.leaderboard_hidden, false) = true OR COALESCE(NEW.is_banned, false) = true THEN
    DELETE FROM public.leaderboard WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  INSERT INTO public.leaderboard (
    id, ign, avatar_url, city, ff_uid,
    rank_points, total_wins, total_kills, total_matches,
    rank_tier, premium_level, premium_expires, updated_at
  ) VALUES (
    NEW.id,
    COALESCE(NEW.ign, ''),
    COALESCE(NEW.avatar_url, ''),
    COALESCE(NEW.city, ''),
    COALESCE(NEW.ff_uid, ''),
    COALESCE(NEW.rank_points, 0),
    COALESCE(NEW.total_wins, 0),
    COALESCE(NEW.total_kills, 0),
    COALESCE(NEW.total_matches, 0),
    COALESCE(NEW.rank_tier, 'Bronze'),
    COALESCE(NEW.premium_level, 0),
    NEW.premium_expires,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    ign             = EXCLUDED.ign,
    avatar_url      = EXCLUDED.avatar_url,
    city            = EXCLUDED.city,
    ff_uid          = EXCLUDED.ff_uid,
    rank_points     = EXCLUDED.rank_points,
    total_wins      = EXCLUDED.total_wins,
    total_kills     = EXCLUDED.total_kills,
    total_matches   = EXCLUDED.total_matches,
    rank_tier       = EXCLUDED.rank_tier,
    premium_level   = EXCLUDED.premium_level,
    premium_expires = EXCLUDED.premium_expires,
    updated_at      = now();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_leaderboard ON public.users;
CREATE TRIGGER trg_sync_leaderboard
  AFTER INSERT OR UPDATE OF
    ign, avatar_url, city, ff_uid, rank_points, total_wins, total_kills,
    total_matches, is_banned, leaderboard_hidden, premium_level, premium_expires
  ON public.users
  FOR EACH ROW EXECUTE FUNCTION sync_leaderboard();

-- ek baar ka backfill
UPDATE public.leaderboard l
   SET premium_level   = COALESCE(u.premium_level, 0),
       premium_expires = u.premium_expires
  FROM public.users u
 WHERE u.id = l.id;
