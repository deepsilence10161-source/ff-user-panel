CREATE OR REPLACE FUNCTION public.admin_confirm_creator_cheat(p_flag_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller TEXT := auth.jwt() ->> 'sub';
  v_match_id TEXT;
  v_owner TEXT;
  v_new_strikes INT;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM users WHERE id = v_caller AND is_admin = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  SELECT match_id, creator_uid INTO v_match_id, v_owner FROM creator_result_flags WHERE id = p_flag_id AND status = 'open';
  IF v_match_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'flag_not_found_or_resolved'); END IF;

  UPDATE users u SET sky_diamonds = sky_diamonds + jr.entry_fee_paid
  FROM join_requests jr, matches m
  WHERE jr.match_id = v_match_id AND jr.user_id = u.id AND m.id = v_match_id AND m.entry_type = 'sky_diamond' AND jr.entry_fee_paid > 0;
  UPDATE users u SET coins = coins + jr.entry_fee_paid
  FROM join_requests jr, matches m
  WHERE jr.match_id = v_match_id AND jr.user_id = u.id AND m.id = v_match_id AND m.entry_type = 'coins' AND jr.entry_fee_paid > 0;

  /* SSOT (2026-09-23c): canonical ledger currency (plural). Amount UNCHANGED. */
  INSERT INTO wallet_transactions(user_id, currency, txn_type, amount, reason, ref_id)
  SELECT jr.user_id, CASE WHEN m.entry_type = 'sky_diamond' THEN 'sky_diamonds' ELSE m.entry_type END, 'credit', jr.entry_fee_paid, 'creator_match_voided_refund', v_match_id
  FROM join_requests jr JOIN matches m ON m.id = jr.match_id WHERE jr.match_id = v_match_id AND jr.entry_fee_paid > 0;

  UPDATE matches SET status = 'cancelled' WHERE id = v_match_id;
  UPDATE creator_matches SET commission_status = 'voided' WHERE match_id = v_match_id;

  UPDATE users SET creator_strikes = creator_strikes + 1 WHERE id = v_owner RETURNING creator_strikes INTO v_new_strikes;

  IF v_new_strikes >= 6 THEN
    UPDATE users SET creator_suspended_permanently = true, is_creator = false WHERE id = v_owner;
  ELSIF v_new_strikes >= 3 THEN
    UPDATE users SET creator_suspended_until = NOW() + INTERVAL '30 days' WHERE id = v_owner;
    -- FIX: correct column names (premium_level/premium_expires, not
    -- premium_tier/premium_expires_at which don't exist on this table).
    UPDATE users SET premium_level = 0, premium_expires = NULL WHERE id = v_owner;
  END IF;

  UPDATE creator_result_flags SET status = 'confirmed_cheat', resolved_at = NOW(), resolved_by = v_caller WHERE id = p_flag_id;

  INSERT INTO notifications(user_id, type, title, body)
  VALUES (v_owner, 'creator_strike', '⚠️ Match Voided — Cheating Confirmed',
    'Tumhara match "' || v_match_id || '" cheating ke wajah se void kar diya gaya. Strikes: ' || v_new_strikes || '/6.' ||
    CASE WHEN v_new_strikes >= 6 THEN ' Creator Program se permanently ban kar diya gaya.'
         WHEN v_new_strikes >= 3 THEN ' 30 din ke liye hosting suspend kar di gayi hai, aur Premium bhi cancel kar diya gaya hai.'
         ELSE '' END);

  RETURN jsonb_build_object('success', true, 'strikes', v_new_strikes);
END;
$function$
