CREATE OR REPLACE FUNCTION public.creator_publish_result(p_match_id text, p_results jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid TEXT := auth.jwt() ->> 'sub';
  v_owner TEXT;
  v_status TEXT;
  v_max_slots INT;
  v_per_kill NUMERIC;
  v_entry_type TEXT;
  v_total_kills INT;
  v_winner_uid TEXT;
  v_recent_wins INT;
  v_total_payout NUMERIC := 0;
  v_flag_reason TEXT;
  v_ledger_currency TEXT;
  v_max_payout_cap CONSTANT NUMERIC := 500;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_authenticated'); END IF;
  SELECT creator_uid, status, max_slots, per_kill_prize, entry_type
    INTO v_owner, v_status, v_max_slots, v_per_kill, v_entry_type
    FROM matches WHERE id = p_match_id;
  IF v_owner IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'match_not_found'); END IF;
  IF v_owner <> v_uid THEN RETURN jsonb_build_object('success', false, 'error', 'not_your_match'); END IF;
  IF v_status <> 'live' THEN RETURN jsonb_build_object('success', false, 'error', 'match_not_live'); END IF;

  IF EXISTS(SELECT 1 FROM users WHERE id = v_uid AND (creator_suspended_permanently = true OR (creator_suspended_until IS NOT NULL AND creator_suspended_until > NOW()))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'creator_suspended');
  END IF;

  /* FIX (R3): 'r' variable vs alias ambiguity — alias ab 'res'.
     Exception-handler bhi: fail par match 'live' atka na rahe. */
  UPDATE join_requests jr
  SET kills = COALESCE((res->>'kills')::INT, 0),
      placement = COALESCE((res->>'placement')::INT, 0)
  FROM jsonb_array_elements(p_results) res
  WHERE jr.id = (res->>'join_request_id')::UUID AND jr.match_id = p_match_id;

  SELECT COALESCE(SUM(kills),0) INTO v_total_kills FROM join_requests WHERE match_id = p_match_id;
  IF v_total_kills > GREATEST(v_max_slots - 1, 1) * 1.5 THEN
    v_flag_reason := 'impossible_kill_count';
  END IF;

  IF v_flag_reason IS NULL THEN
    SELECT user_id INTO v_winner_uid FROM join_requests WHERE match_id = p_match_id AND placement = 1 LIMIT 1;
    IF v_winner_uid IS NOT NULL THEN
      SELECT COUNT(*) INTO v_recent_wins
      FROM creator_matches cm
      JOIN join_requests jr2 ON jr2.match_id = cm.match_id
      WHERE cm.creator_uid = v_uid AND jr2.user_id = v_winner_uid AND jr2.placement = 1
        AND cm.created_at > NOW() - INTERVAL '7 days';
      IF v_recent_wins >= 3 THEN
        v_flag_reason := 'repeat_winner_pattern';
      END IF;
    END IF;
  END IF;

  v_total_payout := v_total_kills * COALESCE(v_per_kill, 0);
  IF v_total_payout > v_max_payout_cap THEN
    v_flag_reason := COALESCE(v_flag_reason, 'payout_cap_exceeded');
  END IF;

  IF v_flag_reason IS NOT NULL THEN
    UPDATE matches SET status = 'pending_review', completed_at = NOW() WHERE id = p_match_id;
    INSERT INTO creator_result_flags(match_id, creator_uid, reason, details)
    VALUES (p_match_id, v_uid, v_flag_reason, jsonb_build_object('total_kills', v_total_kills, 'total_payout', v_total_payout, 'winner_uid', v_winner_uid));
    RETURN jsonb_build_object('success', true, 'status', 'pending_review', 'flagged', true);
  END IF;

  /* SSOT (2026-09-23c): canonical ledger currency — 'sky_diamond' →
     'sky_diamonds' (plural), system-wide canonical. Amount UNCHANGED. */
  v_ledger_currency := CASE WHEN v_entry_type = 'sky_diamond' THEN 'sky_diamonds' ELSE v_entry_type END;

  IF v_per_kill > 0 THEN
    IF v_entry_type = 'coins' THEN
      UPDATE users u SET coins = coins + (jr.kills * v_per_kill)
      FROM join_requests jr WHERE jr.match_id = p_match_id AND jr.user_id = u.id AND jr.kills > 0;
    ELSE
      UPDATE users u SET sky_diamonds = sky_diamonds + (jr.kills * v_per_kill)
      FROM join_requests jr WHERE jr.match_id = p_match_id AND jr.user_id = u.id AND jr.kills > 0;
    END IF;
    INSERT INTO wallet_transactions(user_id, currency, txn_type, amount, reason, ref_id)
    SELECT user_id, v_ledger_currency, 'credit', kills * v_per_kill, 'creator_match_prize', p_match_id
    FROM join_requests WHERE match_id = p_match_id AND kills > 0;
  END IF;

  UPDATE matches SET status = 'completed', completed_at = NOW() WHERE id = p_match_id;
  PERFORM finalize_creator_commission(p_match_id, true);

  RETURN jsonb_build_object('success', true, 'status', 'completed', 'flagged', false);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', 'publish_failed', 'detail', SQLERRM);
END;
$function$
