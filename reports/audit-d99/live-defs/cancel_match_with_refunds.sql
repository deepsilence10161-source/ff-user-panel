CREATE OR REPLACE FUNCTION public.cancel_match_with_refunds(p_match_id text, p_admin_uid text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match RECORD; v_jr RECORD; v_refund_count INT := 0; v_currency TEXT;
  v_caller TEXT := auth.jwt() ->> 'sub';
BEGIN
  IF v_caller IS NULL OR NOT COALESCE((SELECT is_admin FROM users WHERE id = v_caller), false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHORIZED');
  END IF;
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MATCH_NOT_FOUND');
  END IF;
  IF v_match.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', true, 'refund_count', 0, 'already_cancelled', true);
  END IF;
  FOR v_jr IN
    SELECT * FROM join_requests
    WHERE match_id = p_match_id
      AND status NOT IN ('cancelled','refunded','rejected')
      AND COALESCE(entry_fee_paid, 0) > 0
    FOR UPDATE
  LOOP
    /* ✅ MATCH-FLOW-E2E FIX (2026-10-30): green_diamond entry ka refund SKY
       wallet me ja raha tha (entry_type='coin' sirf singular match karta tha,
       baaki sab ELSE→sky). Live proof: run 40986675005 MF30 tx currency. */
    /* ✅ D87: GD-entry join rows par fee charged hi nahi hoti — refund skip */
    IF COALESCE(v_jr.entry_type,'') IN ('green_diamond','greendiamond','green') THEN
      UPDATE join_requests SET status = 'refunded' WHERE id = v_jr.id;
      CONTINUE;
    END IF;
    v_currency := CASE WHEN COALESCE(v_jr.entry_type,'') IN ('coin','coins') THEN 'coins'
                       ELSE 'sky_diamonds' END;
    IF v_currency = 'coins' THEN
      UPDATE users SET coins = COALESCE(coins,0) + v_jr.entry_fee_paid WHERE id = v_jr.user_id;
    ELSE
      UPDATE users SET sky_diamonds = COALESCE(sky_diamonds,0) + v_jr.entry_fee_paid WHERE id = v_jr.user_id;
    END IF;
    INSERT INTO wallet_transactions(user_id, currency, txn_type, amount, reason, ref_id, status)
    VALUES (v_jr.user_id, v_currency, 'credit', v_jr.entry_fee_paid, 'match_cancelled_refund', p_match_id, 'approved');
    UPDATE join_requests SET status = 'refunded' WHERE id = v_jr.id;
    INSERT INTO notifications(user_id, type, title, body, is_read, created_at, ref_id)
    VALUES (v_jr.user_id, 'refund', '💰 Match Cancelled — Refund',
            CHR(34)||COALESCE(v_match.name, v_match.title, p_match_id)||CHR(34)||' cancel ho gaya. Aapka entry fee wapas kar diya gaya hai.',
            false, NOW(), p_match_id)
    ON CONFLICT DO NOTHING;
    v_refund_count := v_refund_count + 1;
  END LOOP;
  UPDATE join_requests SET status = 'cancelled'
  WHERE match_id = p_match_id AND status NOT IN ('cancelled','refunded','rejected');
  UPDATE creator_commissions SET status = 'cancelled', updated_at = NOW()
  WHERE match_id = p_match_id AND status = 'hold';
  UPDATE matches SET filled_slots = GREATEST(
    filled_slots - COALESCE((SELECT SUM(CASE
      WHEN mode IN ('duo','squad') AND COALESCE(captain_uid, user_id) <> user_id THEN 0
      WHEN mode = 'duo' THEN 2
      WHEN mode = 'squad' THEN 4
      ELSE 1 END)
    FROM join_requests
    WHERE match_id = p_match_id AND status IN ('cancelled','refunded')), 0), 0)
  WHERE id = p_match_id;
  UPDATE matches SET status = 'cancelled', cancelled_at = NOW(), cancelled_by = v_caller
  WHERE id = p_match_id;
  RETURN jsonb_build_object('ok', true, 'refund_count', v_refund_count);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$
