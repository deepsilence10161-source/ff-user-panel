CREATE OR REPLACE FUNCTION public.resolve_sponsored_withdrawal(p_txn_id uuid, p_action text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller   TEXT := auth.jwt() ->> 'sub';
  v_is_admin BOOLEAN;
  v_is_service BOOLEAN := (current_setting('role', true) = 'service_role');
  v_txn      RECORD;
  v_balance  NUMERIC;
  v_after    NUMERIC;
  v_ref      TEXT := trim(COALESCE(p_note, ''));
BEGIN
  IF NOT v_is_service THEN
    IF v_caller IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admin only');
    END IF;
    SELECT is_admin INTO v_is_admin FROM users WHERE id = v_caller;
    IF NOT COALESCE(v_is_admin, false) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Admin only');
    END IF;
  END IF;
  IF p_action NOT IN ('approve','reject') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;

  SELECT * INTO v_txn FROM wallet_transactions WHERE id = p_txn_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;
  IF v_txn.txn_type <> 'pending_withdraw' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a pending withdrawal');
  END IF;
  IF COALESCE(v_txn.status, 'pending') <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already resolved (status: ' || v_txn.status || ')');
  END IF;
  /* ✅ C1-HARDENING (2026-10-07): degenerate amount par ruk jao — approve par
     `balance - amount` hi hota hai, isliye 0/negative row ka koi matlab nahi;
     ab ledger me sirf asli request (amount > 0) hi process hoti hai. */
  IF v_txn.amount IS NULL OR v_txn.amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  IF p_action = 'approve' THEN
    /* ✅ B11 FIX (asli paisa bahar jaane wala rasta): APPROVE ke liye payment
       reference (UPI/UTR/transaction id) DENA LAZMI hai. Pehle bina kisi
       proof ke approve ho jaata tha — "paisa bheja ya nahi" ka koi server-
       side record hi nahi bachta tha. 6 se chhota text = mana. */
    IF length(v_ref) < 6 THEN
      RETURN jsonb_build_object('success', false, 'error', 'payout_ref_required',
                                'message', 'Payout reference (UTR / UPI transaction id) daalna zaroori hai');
    END IF;

    SELECT sponsored_winnings INTO v_balance FROM users WHERE id = v_txn.user_id FOR UPDATE;
    IF v_balance IS NULL OR v_balance < v_txn.amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient sponsored_winnings remaining — balance may have changed since request was submitted');
    END IF;
    v_after := v_balance - v_txn.amount;
    UPDATE users SET sponsored_winnings = sponsored_winnings - v_txn.amount WHERE id = v_txn.user_id;

    INSERT INTO public.wallet_audit_log(user_id, action, amount, currency, before_balance, after_balance, performed_by, note)
    VALUES (v_txn.user_id, 'sponsored_withdrawal_paid', v_txn.amount, 'sponsored_winnings',
            v_balance, v_after, COALESCE(v_caller, 'service_role'),
            'Payout ref: ' || v_ref || ' | txn: ' || p_txn_id::text
            || ' | ' || COALESCE(NULLIF(v_txn.note, ''), ''));
  END IF;

  UPDATE wallet_transactions SET
    status = CASE p_action WHEN 'approve' THEN 'approved' ELSE 'rejected' END,
    /* approve: purani UPI-info ke saath payout reference hamesha ke liye
       note me jud jaata hai (audit ke liye). reject: reason. */
    note = CASE p_action
             WHEN 'approve' THEN COALESCE(NULLIF(v_txn.note, ''), '') || ' | Payout ref: ' || v_ref
             ELSE COALESCE(p_note, v_txn.note)
           END,
    reviewed_at = now(),
    reviewed_by = COALESCE(v_caller, 'service_role')
  WHERE id = p_txn_id;

  RETURN jsonb_build_object('success', true, 'action', p_action, 'user_id', v_txn.user_id,
                            'amount', v_txn.amount, 'balance_after', (CASE WHEN p_action='approve' THEN v_after ELSE v_balance END));
END;
$function$
