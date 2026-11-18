-- ✅ D83 (06 Nov 2026, owner: "search karne par bhi wahi profile-card replica dikhe")
-- Public profile view me banner_url + premium_level + premium_expires add kiye,
-- taaki searched user ka PCARD2 replica uska ASLI banner aur premium chip bhi
-- dikha sake (photo/tier/pts/vip pehle se public the). banner_url avatar_url ki
-- tarah public profile art hai; premium status card-par badge ke roop me dikhta
-- hai. Admin rows (is_admin=true) pehle ki tarah view se excluded rahenge.
BEGIN;

DROP VIEW IF EXISTS public.user_public_profiles;
DROP FUNCTION IF EXISTS public.f_user_public_profiles();

CREATE FUNCTION public.f_user_public_profiles()
 RETURNS TABLE(id text, ign text, ff_uid text, avatar_url text, avatar_bg_color text, city text, bio text, rank_tier text, rank_points integer, total_wins integer, total_kills integer, total_matches integer, win_streak integer, has_clean_badge boolean, is_banned boolean, is_live boolean, stream_link text, stream_title text, clan_id text, profile_status text, level integer, exp integer, is_vip boolean, is_creator boolean, created_at timestamp with time zone, banner_url text, premium_level integer, premium_expires timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, ign, ff_uid, avatar_url, avatar_bg_color, city, bio, rank_tier,
         rank_points, total_wins, total_kills, total_matches, win_streak,
         has_clean_badge, is_banned, is_live, stream_link, stream_title,
         clan_id, profile_status, level, exp, is_vip, is_creator, created_at,
         banner_url, premium_level, premium_expires
  FROM users
  WHERE coalesce(is_admin, false) = false
$function$;

GRANT EXECUTE ON FUNCTION public.f_user_public_profiles() TO anon, authenticated, service_role;

CREATE VIEW public.user_public_profiles AS
 SELECT id, ign, ff_uid, avatar_url, avatar_bg_color, city, bio, rank_tier,
        rank_points, total_wins, total_kills, total_matches, win_streak,
        has_clean_badge, is_banned, is_live, stream_link, stream_title,
        clan_id, profile_status, level, exp, is_vip, is_creator, created_at,
        banner_url, premium_level, premium_expires
   FROM public.f_user_public_profiles();

GRANT SELECT ON public.user_public_profiles TO anon, authenticated;

COMMIT;
