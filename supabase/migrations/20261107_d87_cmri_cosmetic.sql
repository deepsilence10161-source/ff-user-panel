-- D87 cosmetic: claim_match_refund_inner se dead GD branches/comments
CREATE OR REPLACE FUNCTION public.claim_match_refund_inner(p_join_id uuid, p_uid text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  /* ✅ BUG FIX (2026-10-06, A11): ऐप का Supabase client सिर्फ़ ANON key से बनता
     है (login Firebase ka hai), इसलिए auth.jwt()->>'sub' NULL aata hai aur ye
     function hamesha 'Not authorized' lautata tha — yani match cancel hone par
     user kabhi refund claim hi nahi kar sakta tha (aur isliye transaction
     history me refund dikhta hi nahi tha).
     Ab: identity pehle auth se, warna p_uid se — par refund SIRF usi join
     request par ho sakta hai jiska user_id = caller ho, isliye koi doosre ka
     paisa nahi khinch sakta. Baki saari shartein (match cancelled hona,
     pehle refund na hua ho, entry_fee_paid > 0) waisi hi hain. */
  v_caller TEXT := COALESCE(auth.jwt() ->> 'sub', NULLIF(btrim(p_uid), ''));
  v_jr RECORD;
  v_match RECORD;
  v_col TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_jr FROM join_requests WHERE id = p_join_id FOR UPDATE;
  IF v_jr IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Join request not found');
  END IF;

  IF v_jr.user_id <> v_caller THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your entry');
  END IF;

  IF v_jr.status = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already refunded');
  END IF;

  SELECT status INTO v_match FROM matches WHERE id = v_jr.match_id;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status NOT IN ('cancelled', 'canceled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not cancelled');
  END IF;

  /* ✅ D87: GD entry abolished — GD-entry joins par fee kabhi charged
     hi nahi hoti, isliye refund bhi nahi. */
  IF COALESCE(v_jr.entry_type,'') IN ('green_diamond','greendiamond','green') THEN
    RETURN jsonb_build_object('success', false, 'error', 'GD entry abolished - no fee charged', 'refunded', 0);
  END IF;

  IF COALESCE(v_jr.entry_fee_paid, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nothing to refund', 'refunded', 0);
  END IF;

  /* ✅ D87: GD-entry refund impossible (fee kabhi charged hi nahi hoti). */
  v_col := CASE WHEN v_jr.entry_type IN ('coin','coins') THEN 'coins'
                ELSE 'sky_diamonds' END;

  EXECUTE format('UPDATE users SET %I = COALESCE(%I, 0) + $1 WHERE id = $2', v_col, v_col)
    USING v_jr.entry_fee_paid, v_caller;

  UPDATE join_requests SET status = 'refunded' WHERE id = p_join_id;

  UPDATE matches SET filled_slots = GREATEST(filled_slots - CASE
    WHEN v_jr.mode IN ('duo','squad') AND COALESCE(v_jr.captain_uid, v_jr.user_id) <> v_jr.user_id THEN 0
    WHEN v_jr.mode = 'duo' THEN 2
    WHEN v_jr.mode = 'squad' THEN 4
    ELSE 1 END, 0)
  WHERE id = v_jr.match_id;

  /* txn_type 'credit' hi rakha gaya hai (baaki app isi par credit samajhta
     hai); 'match_refund' reason se UI ise refund ke roop me dikhata hai */
  INSERT INTO wallet_transactions (user_id, currency, txn_type, amount, reason, ref_id)
  VALUES (v_caller, v_col, 'credit', v_jr.entry_fee_paid, 'match_refund', v_jr.match_id);

  /* ✅ A11: user ko notification bhi — pehle refund ka koi sandesh nahi aata
     tha, isliye paisa wapas aane ka pata hi nahi chalta tha */
  INSERT INTO public.notifications (user_id, type, title, body, ref_id)
  VALUES (v_caller, 'refund', '💰 Refund mil gaya',
          'Aapka entry ' || v_jr.entry_fee_paid || ' ' ||
          CASE WHEN v_col = 'coins' THEN 'coins' ELSE 'sky diamonds' END ||
          ' wapas aa gaya (match refund).',
          v_jr.match_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'refunded', v_jr.entry_fee_paid, 'currency', v_col);
END;
$function$;
