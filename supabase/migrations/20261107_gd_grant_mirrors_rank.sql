-- ✅ D86 (07 Nov 2026, owner: "tune Tariq ko sky/green diamond diye the fir bhi
-- vo rank 1 par nahi — green diamond ka use kya hai?"):
-- Green Diamonds ka use: (1) GD-prize matches ka top3 prize, (2) GD-entry
-- matches ki entry fee, (3) wallet status chip. Rank se connection NAHI tha —
-- isliye admin ke GD grant se rank nahi badhta tha aur owner ka test fail
-- dikhta tha. Ab admin ka green-diamond grant rank_points me bhi mirror
-- hota hai (GD dena = points dena), match-placement points pehle se
-- rank_points me judte hain (publish_match_results), aur leaderboard ka
-- Points tab server ka rank_points column dikhata hai (screens/rank.js D86).
CREATE OR REPLACE FUNCTION public.admin_adjust_wallet(p_uid text, p_col text, p_amount numeric, p_reason text DEFAULT 'Admin adjustment'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller     TEXT := auth.jwt() ->> 'sub';
  v_is_service BOOLEAN := (current_setting('role', true) = 'service_role');
  v_is_admin   BOOLEAN;
  v_current    NUMERIC;
  v_new        NUMERIC;
  v_txn_type   TEXT;
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

  IF p_col NOT IN ('coins','sky_diamonds','green_diamonds') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid column');
  END IF;
  IF p_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be non-zero');
  END IF;
  IF ABS(p_amount) > 999999 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount too large');
  END IF;

  EXECUTE format('SELECT COALESCE(%I, 0) FROM public.users WHERE id = $1 FOR UPDATE', p_col)
    USING p_uid INTO v_current;
  IF v_current IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_new := v_current + p_amount;
  IF v_new < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance',
                              'balance', v_current, 'requested', ABS(p_amount));
  END IF;

  EXECUTE format('UPDATE public.users SET %I = $1 WHERE id = $2', p_col)
    USING v_new, p_uid;

  /* ✅ D86: green-diamond grant = rank points bhi (owner workflow:
     "GD diya to rank badhe"). Sirf CREDIT mirror hota hai — debit/deduct
     (entry fee wagera) rank nahi ghataate. */
  IF p_col = 'green_diamonds' AND p_amount > 0 THEN
    UPDATE public.users
       SET rank_points = COALESCE(rank_points, 0) + p_amount
     WHERE id = p_uid;
  END IF;

  v_txn_type := CASE WHEN p_amount < 0 THEN 'admin_debit' ELSE 'admin_credit' END;
  INSERT INTO wallet_transactions(user_id, currency, txn_type, amount, reason, status, created_at)
  VALUES (p_uid, p_col, v_txn_type, ABS(p_amount), p_reason, 'approved', NOW());

  RETURN jsonb_build_object('success', true, 'old_balance', v_current,
                            'new_balance', v_new, 'direction', v_txn_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_wallet(text, text, numeric, text) TO authenticated, service_role;

-- Data repair: TARIQ ke 2500 GD grant rank_points me nahi jude the (purana RPC)
UPDATE public.users
   SET rank_points = GREATEST(COALESCE(rank_points, 0), COALESCE(green_diamonds, 0))
 WHERE id = 'kdH67upXNFeQ8N05BfuFrkbOCNm1';
