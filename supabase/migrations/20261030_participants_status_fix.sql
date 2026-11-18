-- ═══════════════════════════════════════════════════════════════════════════
--  20261030_participants_status_fix.sql — MATCH-FLOW-E2E run 40990312589 (37/37)
--  ke MF32 diagnostic se mila BUG E: match live hone ke baad join_requests ke
--  status badal jaate hain (sirf gift-wala 'pending' row dikha; 7 'joined' rows
--  kisi aur status me flip ho chuki thin — participants RPC n=1 lauta).
--  Result form ka filter IN ('pending','joined','approved') match-start ke baad
--  creator ko participants hi nahi dikhata → result submit via UI impossible.
--  Fix: exclusion-list approach — cancelled/refunded/rejected ke ALAWA sab
--  statuses participants me count hote hain (joined/pending/approved/no_show/
--  in_room/confirmed/completed...). Baaki function body 20261030_match_money_
--  team_fixes.sql wali hi hai.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.creator_get_match_participants(p_match_id text, p_uid text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller TEXT := COALESCE(auth.jwt() ->> 'sub', NULLIF(btrim(p_uid), ''));
  v_m RECORD;
  v_rows jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHORIZED');
  END IF;
  SELECT id, creator_uid INTO v_m FROM matches WHERE id = p_match_id;
  IF v_m.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MATCH_NOT_FOUND');
  END IF;
  IF COALESCE(v_m.creator_uid, '') <> v_caller
     AND NOT COALESCE((SELECT is_admin FROM users WHERE id = v_caller), false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_YOUR_MATCH');
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', jr.id, 'user_id', jr.user_id,
           'user_ign', jr.user_ign, 'ign_at_join', jr.ign_at_join,
           'status', jr.status
         ) ORDER BY jr.slot_number NULLS LAST), '[]'::jsonb)
    INTO v_rows
    FROM join_requests jr
   WHERE jr.match_id = p_match_id
     AND COALESCE(jr.status, 'joined') NOT IN ('cancelled', 'refunded', 'rejected');
  RETURN jsonb_build_object('ok', true, 'players', v_rows);
END;
$function$;
