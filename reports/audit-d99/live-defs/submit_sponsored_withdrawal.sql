CREATE OR REPLACE FUNCTION public.submit_sponsored_withdrawal(p_amount numeric, p_upi text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller TEXT := auth.jwt() ->> 'sub';
  v_bal NUMERIC;
  v_pending NUMERIC;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_amount IS NULL OR p_amount < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;
  IF p_upi IS NULL OR p_upi !~ '^[^@\s]+@[^@\s]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_upi');
  END IF;

  SELECT COALESCE(sponsored_winnings, 0) INTO v_bal FROM users WHERE id = v_caller FOR UPDATE;
  IF v_bal IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'user_not_found');
  END IF;
  IF p_amount > v_bal THEN
    RETURN jsonb_build_object('success', false, 'error', 'amount_exceeds_balance', 'balance', v_bal);
  END IF;

  /* Duplicate-guard: ek pending withdrawal active hai to naya block. */
  SELECT COALESCE(SUM(amount), 0) INTO v_pending
  FROM wallet_transactions
  WHERE user_id = v_caller AND txn_type = 'pending_withdraw' AND status = 'pending';
  IF COALESCE(v_pending, 0) + p_amount > v_bal THEN
    RETURN jsonb_build_object('success', false, 'error', 'pending_requests_exceed_balance');
  END IF;

  INSERT INTO wallet_transactions (user_id, txn_type, amount, currency, reason, note, status)
  VALUES (v_caller, 'pending_withdraw', p_amount, 'sponsored', 'sponsored_withdrawal', 'UPI: ' || p_upi, 'pending');

  RETURN jsonb_build_object('success', true, 'amount', p_amount, 'status', 'pending');
END;
$function$
