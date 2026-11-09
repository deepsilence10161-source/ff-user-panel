CREATE OR REPLACE FUNCTION public.gift_match_entry(p_match_id text, p_to_uid text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_me TEXT := auth.jwt() ->> 'sub';
  v_m RECORD; v_friend RECORD; v_my_name TEXT; v_col TEXT; v_bal NUMERIC; v_gift_id UUID;
BEGIN
  IF v_me IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not authorized'); END IF;
  IF p_to_uid IS NULL OR p_to_uid = v_me THEN RETURN jsonb_build_object('ok', false, 'error', 'Apne aap ko gift nahi kar sakte'); END IF;
  /* R6: FOR UPDATE — concurrent gifts same match par capacity race नहीं करते */
  SELECT id, entry_fee, entry_type, name, status, max_slots, filled_slots
    INTO v_m FROM matches WHERE id::text = p_match_id FOR UPDATE;
  IF v_m.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Match not found'); END IF;
  IF COALESCE(v_m.entry_fee, 0) <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'Gift sirf paid matches par'); END IF;
  SELECT id, COALESCE(ff_uid, '') AS ff_uid INTO v_friend FROM users WHERE id = p_to_uid;
  IF v_friend.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Player not found'); END IF;
  SELECT COALESCE(ign, 'Player') INTO v_my_name FROM users WHERE id = v_me;
  v_col := CASE WHEN lower(COALESCE(v_m.entry_type, 'coin')) = 'coin' THEN 'coins' ELSE 'sky_diamonds' END;

  EXECUTE format('SELECT COALESCE(%I, 0) FROM users WHERE id = $1 FOR UPDATE', v_col) INTO v_bal USING v_me;
  IF v_bal IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'User not found'); END IF;
  IF v_bal < v_m.entry_fee THEN RETURN jsonb_build_object('ok', false, 'error', 'Insufficient balance'); END IF;
  EXECUTE format('UPDATE users SET %I = COALESCE(%I, 0) - $1 WHERE id = $2', v_col, v_col) USING v_m.entry_fee, v_me;

  INSERT INTO gift_tickets (from_uid, from_name, to_uid, to_ff_uid, match_id, match_name, fee, entry_type, status)
  VALUES (v_me, v_my_name, p_to_uid, v_friend.ff_uid, v_m.id, v_m.name, v_m.entry_fee, v_m.entry_type, 'pending')
  RETURNING id INTO v_gift_id;
  INSERT INTO wallet_transactions (user_id, currency, txn_type, amount, reason)
  VALUES (v_me, v_col, 'debit', v_m.entry_fee, 'gift_entry');

  IF v_m.status = 'upcoming' THEN
    IF NOT EXISTS (SELECT 1 FROM join_requests WHERE user_id = p_to_uid AND match_id = v_m.id AND status NOT IN ('cancelled','refunded','no_show')) THEN
      IF COALESCE(v_m.filled_slots, 0) < COALESCE(v_m.max_slots, 999) THEN
        INSERT INTO join_requests (match_id, user_id, status, entry_type, entry_fee_paid, user_ign, ign_at_join, user_ff_uid)
        VALUES (v_m.id, p_to_uid, 'pending', v_m.entry_type, 0,
                (SELECT COALESCE(ign,'Player') FROM users WHERE id = p_to_uid),
                (SELECT COALESCE(ign,'Player') FROM users WHERE id = p_to_uid),
                v_friend.ff_uid);
        UPDATE matches SET filled_slots = COALESCE(filled_slots,0) + 1 WHERE id = v_m.id;
      END IF;
    END IF;
  END IF;
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (p_to_uid, 'gift_ticket', '🎁 Match Ticket Gift!', v_my_name || ' ne tumhe "' || v_m.name || '" ka entry ticket gift kiya!')
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'gift_id', v_gift_id, 'fee', v_m.entry_fee);
END;
$function$
