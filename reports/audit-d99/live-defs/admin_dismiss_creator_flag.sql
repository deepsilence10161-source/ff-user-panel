CREATE OR REPLACE FUNCTION public.admin_dismiss_creator_flag(p_flag_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller TEXT := auth.jwt() ->> 'sub';
  v_match_id TEXT;
  v_owner TEXT;
  v_per_kill NUMERIC;
  v_entry_type TEXT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM users WHERE id = v_caller AND is_admin = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  SELECT match_id, creator_uid INTO v_match_id, v_owner FROM creator_result_flags WHERE id = p_flag_id AND status = 'open';
  IF v_match_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'flag_not_found_or_resolved'); END IF;

  SELECT per_kill_prize, entry_type INTO v_per_kill, v_entry_type FROM matches WHERE id = v_match_id;

  -- Legit — pay out same as the normal auto-approve path would have.
  IF v_per_kill > 0 THEN
    IF v_entry_type = 'coins' THEN
      UPDATE users u SET coins = coins + (jr.kills * v_per_kill)
      FROM join_requests jr WHERE jr.match_id = v_match_id AND jr.user_id = u.id AND jr.kills > 0;
    ELSE
      UPDATE users u SET sky_diamonds = sky_diamonds + (jr.kills * v_per_kill)
      FROM join_requests jr WHERE jr.match_id = v_match_id AND jr.user_id = u.id AND jr.kills > 0;
    END IF;
    INSERT INTO wallet_transactions(user_id, currency, txn_type, amount, reason, ref_id)
    SELECT user_id, v_entry_type, 'credit', kills * v_per_kill, 'creator_match_prize', v_match_id
    FROM join_requests WHERE match_id = v_match_id AND kills > 0;
  END IF;

  UPDATE matches SET status = 'completed' WHERE id = v_match_id;
  PERFORM finalize_creator_commission(v_match_id);

  UPDATE creator_result_flags SET status = 'dismissed', resolved_at = NOW(), resolved_by = v_caller WHERE id = p_flag_id;

  RETURN jsonb_build_object('success', true);
END;
$function$
