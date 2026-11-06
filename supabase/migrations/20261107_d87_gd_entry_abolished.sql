-- ✅ D87 (07-Nov-2026, owner): ENTRY FEE sirf Ads / Sky Diamond / Coins —
-- Green Diamond entry poori tarah abolished (client + server + creator form).
-- GD ab sirf: match-win prize, status chip, aur rank-points mirror (D86).

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
$function$;

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

  /* ✅ MATCH-FLOW-E2E FIX (2026-10-30): green_diamond refund green wallet me. */
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
          CASE WHEN v_col = 'coins' THEN 'coins' WHEN v_col = 'green_diamonds' THEN 'green diamonds' ELSE 'sky diamonds' END ||
          ' wapas aa gaya (match refund).',
          v_jr.match_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('success', true, 'refunded', v_jr.entry_fee_paid, 'currency', v_col);
END;
$function$;

CREATE OR REPLACE FUNCTION public.creator_create_match(p_title text, p_mode text, p_entry_type text, p_entry_fee numeric, p_max_slots integer, p_per_kill_prize numeric, p_scheduled_at timestamp with time zone, p_first_prize numeric DEFAULT 0, p_second_prize numeric DEFAULT 0, p_third_prize numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid TEXT := auth.jwt() ->> 'sub';
  v_is_creator BOOLEAN;
  v_prem_level INT;
  v_prem_expires TIMESTAMPTZ;
  v_open_count INT;
  v_match_id TEXT;
  v_max_fee CONSTANT NUMERIC := 50;
  v_max_slots CONSTANT INT := 100;
  v_max_open CONSTANT INT := 3;
  v_creator_ign TEXT;
  v_follower_count INT;
  v_comm_pct NUMERIC;
  v_prize_pool NUMERIC;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'not_authenticated'); END IF;

  SELECT is_creator, ign, premium_level, premium_expires INTO v_is_creator, v_creator_ign, v_prem_level, v_prem_expires FROM users WHERE id = v_uid;
  IF NOT COALESCE(v_is_creator, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_a_creator');
  END IF;
  IF COALESCE(v_prem_level, 0) <= 0 OR v_prem_expires IS NULL OR v_prem_expires < NOW() THEN
    RETURN jsonb_build_object('success', false, 'error', 'premium_required');
  END IF;

  IF EXISTS(SELECT 1 FROM users WHERE id = v_uid AND (creator_suspended_permanently = true OR (creator_suspended_until IS NOT NULL AND creator_suspended_until > NOW()))) THEN
    RETURN jsonb_build_object('success', false, 'error', 'creator_suspended');
  END IF;

  /* ✅ BUG FIX (2026-10-04): green_diamond entry bhi allow (price type selection) */
  IF p_entry_type NOT IN ('coins', 'sky_diamond') THEN  /* D87: GD entry abolished */
    RETURN jsonb_build_object('success', false, 'error', 'invalid_entry_type');
  END IF;
  IF p_entry_fee IS NULL OR p_entry_fee < 1 OR p_entry_fee > v_max_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'entry_fee_out_of_range', 'max', v_max_fee);
  END IF;
  IF p_max_slots IS NULL OR p_max_slots < 2 OR p_max_slots > v_max_slots THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_slot_count', 'max', v_max_slots);
  END IF;
  IF p_scheduled_at IS NULL OR p_scheduled_at < NOW() + INTERVAL '20 minutes' THEN
    RETURN jsonb_build_object('success', false, 'error', 'schedule_too_soon');
  END IF;
  IF p_title IS NULL OR LENGTH(TRIM(p_title)) < 3 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_title');
  END IF;

  -- ✅ Creator prize pool is capped at what the match's own entry fees can
  -- plausibly cover (max_slots * entry_fee) so a creator can never promise
  -- payouts beyond what their own small-stakes match actually collects.
  v_prize_pool := COALESCE(p_first_prize,0) + COALESCE(p_second_prize,0) + COALESCE(p_third_prize,0);
  IF v_prize_pool > (p_max_slots * p_entry_fee) THEN
    RETURN jsonb_build_object('success', false, 'error', 'prize_exceeds_pool', 'max', p_max_slots * p_entry_fee);
  END IF;
  IF p_first_prize < 0 OR p_second_prize < 0 OR p_third_prize < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_prize');
  END IF;

  SELECT COUNT(*) INTO v_open_count
  FROM matches WHERE creator_uid = v_uid AND status IN ('upcoming', 'live');
  IF v_open_count >= v_max_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_many_open_matches', 'max', v_max_open);
  END IF;

  v_match_id := 'cm_' || gen_random_uuid()::TEXT;

  -- ✅ BUG FIX (2026-08-24): "Match create nahi ho paya" for EVERY
  -- creator match attempt, no matter the input. Root cause: matches.name
  -- is a GENERATED ALWAYS column (derived from title) — Postgres hard-
  -- rejects any INSERT that explicitly supplies a value for it
  -- ("cannot insert a non-DEFAULT value into column \"name\"", error
  -- 428C9). The old INSERT explicitly listed `name` with `TRIM(p_title)`
  -- as its value — guaranteed to fail on every single call, for every
  -- creator, regardless of any of the validation above. Confirmed live
  -- via a direct simulated call. Just don't list `name` at all — it
  -- fills itself in from `title` automatically.
  -- ✅ Also added: first_prize/second_prize/third_prize, prize_pool,
  -- and prize_type — the same fields admin's own match-creation form
  -- has, now available to creators too (validated above against the
  -- match's own max possible collected entry fees).
  INSERT INTO matches (
    id, title, mode, entry_type, entry_fee, max_slots, filled_slots,
    per_kill_prize, status, scheduled_at, creator_uid, match_sub_type, created_at,
    first_prize, second_prize, third_prize, prize_pool, prize_type
  ) VALUES (
    v_match_id, TRIM(p_title), p_mode, p_entry_type, p_entry_fee, p_max_slots, 0,
    COALESCE(p_per_kill_prize, 0), 'upcoming', p_scheduled_at, v_uid, 'creator_hosted', NOW(),
    COALESCE(p_first_prize,0), COALESCE(p_second_prize,0), COALESCE(p_third_prize,0), v_prize_pool,
    /* ⛔ B2 (2026-10-06): 'sky_diamond' ENTRY wale match ka prize bhi pehle
         prize_type='sky_diamond' ban jata tha — aur publish ke waqt wo
         users ko Sky Diamond credit kar deta (jo allowed nahi: SD real
         money se juda hai, uska hisaab admin approval + ledger se chalta
         hai). Ab SD-entry match ka prize_type 'green_diamond' hota hai —
         bilkul jaise admin ke paid match ka (SD entry -> GD prize). */
         CASE WHEN p_entry_type = 'coins' THEN 'coins'
              ELSE 'green_diamond' END  /* D87: GD-entry branch removed; prize GD reh sakta hai */
  );

  /* ✅ BUG FIX (2026-10-04): commission SIRF creator-hosted SKY DIAMOND match
     par — jahan koi user sky diamond kharch kare (user ki exact requirement).
     Coin / green_diamond entry matches par KOI commission nahi. Percentage
     admin-set (creator_system.sdMatchCommissionPct) — single source of truth.
     commission_type: 'inr' = payout ledger path, 'none' = no commission. */
  IF p_entry_type = 'sky_diamond' THEN
    v_comm_pct := COALESCE((SELECT (value->>'sdMatchCommissionPct')::numeric FROM app_settings WHERE key='creator_system' LIMIT 1), 15);
    INSERT INTO creator_matches (match_id, creator_uid, commission_pct, commission_type, commission_status, created_at)
    VALUES (v_match_id, v_uid, v_comm_pct, 'inr', 'pending', NOW());
  ELSE
    INSERT INTO creator_matches (match_id, creator_uid, commission_pct, commission_type, commission_status, created_at)
    VALUES (v_match_id, v_uid, 0, 'none', 'pending', NOW());
  END IF;

  INSERT INTO notifications(user_id, type, title, body)
  SELECT follower_uid, 'creator_new_match',
    '🎮 ' || COALESCE(v_creator_ign, 'Creator') || ' ne naya match banaya!',
    TRIM(p_title) || ' — Entry: ' || p_entry_fee || (CASE WHEN p_entry_type='coins' THEN ' coins' ELSE ' 💎' END)
  FROM creator_follows WHERE creator_uid = v_uid;

  GET DIAGNOSTICS v_follower_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'match_id', v_match_id, 'notified_followers', v_follower_count);
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_and_join_match(p_uid text, p_match_id text, p_entry_fee numeric, p_currency text, p_join_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_m              RECORD;
  v_balance        NUMERIC;
  v_joined         BOOLEAN := false;
  v_jr_id          UUID;
  v_fee_mode       TEXT;
  v_server_fee     NUMERIC;
  v_slots          INT;
  v_charge_fee     NUMERIC;
  v_available      INT;
  v_caller         TEXT := auth.jwt() ->> 'sub';
  v_host_uid       TEXT;
  v_commission     NUMERIC;
  v_commission_pct NUMERIC;
  v_hold_days      NUMERIC;
  v_ign            TEXT;
  v_ff_uid         TEXT;
  v_slot_num       INT;
BEGIN
  IF v_caller IS NULL OR v_caller <> p_uid THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  SELECT id, title, status, entry_type, entry_fee, max_slots, filled_slots, creator_uid
    INTO v_m
    FROM matches
   WHERE id = p_match_id
     FOR UPDATE;
  IF v_m.id IS NULL THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;

  IF v_m.status IS DISTINCT FROM 'upcoming' AND v_m.status IS DISTINCT FROM 'live' THEN
    RAISE EXCEPTION 'MATCH_NOT_JOINABLE';
  END IF;

  IF v_m.creator_uid IS NOT NULL AND v_m.creator_uid = p_uid THEN
    RAISE EXCEPTION 'SELF_PLAY_BLOCKED';
  END IF;

  IF COALESCE((SELECT is_banned FROM users WHERE id = p_uid), false) THEN
    RAISE EXCEPTION 'ACCOUNT_BANNED';
  END IF;

  /* ✅ BUG FIX (2026-10-04): "coin entry fee wale creator match mein bhi
     user se sky_diamond katta tha". Root cause: CASE sirf 'coin' match
     karta tha, lekin DB mein entry_type 'coins' (plural) save hota hai
     (creator_create_match 'coins' deta hai) — plural ELSE branch mein
     gir kar sky_diamonds charge kar deta tha. Ab dono forms handle. */
  CASE COALESCE(lower(regexp_replace(v_m.entry_type, '[_ -]', '', 'g')), 'free')
    WHEN 'coin' THEN
      v_server_fee := COALESCE(v_m.entry_fee, 0);
      v_fee_mode   := 'coins';
    WHEN 'coins' THEN
      v_server_fee := COALESCE(v_m.entry_fee, 0);
      v_fee_mode   := 'coins';
    WHEN 'paid' THEN
      v_server_fee := COALESCE(v_m.entry_fee, 0);
      v_fee_mode   := 'sky_diamonds';
    WHEN 'skydiamond' THEN
      v_server_fee := COALESCE(v_m.entry_fee, 0);
      v_fee_mode   := 'sky_diamonds';
    /* ✅ BUG FIX (2026-10-04): green_diamond entry support (creator price type) */
    WHEN 'greendiamond' THEN
      /* ✅ D87 (owner): Green Diamond ENTRY abolished — legacy GD-entry
         match free join hota hai (GD se fee kabhi nahi kat-ti). */
      v_server_fee := 0; v_fee_mode := 'free';
    WHEN 'free' THEN
      v_server_fee := 0; v_fee_mode := 'free';
    WHEN 'ad' THEN
      v_server_fee := 0; v_fee_mode := 'ad';
    ELSE
      IF COALESCE(v_m.entry_fee, 0) > 0 THEN
        v_server_fee := v_m.entry_fee; v_fee_mode := 'sky_diamonds';
      ELSE
        v_server_fee := 0; v_fee_mode := 'free';
      END IF;
  END CASE;

  v_slots := 1;
  IF p_join_data IS NOT NULL AND p_join_data ? 'mode' THEN
    IF p_join_data->>'mode' = 'duo'  THEN v_slots := 2; END IF;
    IF p_join_data->>'mode' = 'squad' THEN v_slots := 4; END IF;
  END IF;

  v_charge_fee :=
    CASE
      WHEN v_slots = 1 THEN v_server_fee
      WHEN (p_join_data->>'feeType') = 'each_pays' THEN v_server_fee
      ELSE v_server_fee * v_slots
    END;

  IF v_server_fee > 0 THEN
    IF v_fee_mode = 'coins' THEN
      SELECT coins INTO v_balance FROM users WHERE id = p_uid FOR UPDATE;
    ELSE
      SELECT sky_diamonds INTO v_balance FROM users WHERE id = p_uid FOR UPDATE;
    END IF;
    IF v_balance IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
    IF v_balance < v_charge_fee THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM join_requests
    WHERE user_id = p_uid AND match_id = p_match_id
      AND status NOT IN ('cancelled','refunded','no_show')
  ) INTO v_joined;
  IF v_joined THEN RAISE EXCEPTION 'ALREADY_JOINED'; END IF;

  v_available := COALESCE(v_m.max_slots, 999) - COALESCE(v_m.filled_slots, 0);
  IF v_available < v_slots THEN RAISE EXCEPTION 'MATCH_FULL'; END IF;

  IF v_server_fee > 0 THEN
    IF v_fee_mode = 'coins' THEN
      UPDATE users SET coins = coins - v_charge_fee WHERE id = p_uid;
    ELSE
      UPDATE users SET sky_diamonds = sky_diamonds - v_charge_fee WHERE id = p_uid;
    END IF;
    INSERT INTO wallet_transactions(user_id, currency, txn_type, amount, reason, ref_id)
    VALUES(p_uid, v_fee_mode, 'debit', v_charge_fee, 'match_entry', p_match_id);
  END IF;

  SELECT
    COALESCE(NULLIF(p_join_data->>'ign', ''), NULLIF(p_join_data->>'userName', ''), u.ign, ''),
    COALESCE(NULLIF(p_join_data->>'userFFUID', ''), NULLIF(p_join_data->>'ffUid', ''), u.ff_uid, '')
  INTO v_ign, v_ff_uid
  FROM users u
  WHERE u.id = p_uid;

  v_ign := COALESCE(v_ign, '');
  v_ff_uid := COALESCE(v_ff_uid, '');
  v_slot_num := COALESCE(v_m.filled_slots, 0) + 1;

  INSERT INTO join_requests(
    user_id, match_id, entry_fee, entry_fee_paid, entry_type,
    status, mode, ign_at_join, user_ign, user_ff_uid, slot_number, fee_type
  )
  VALUES(
    p_uid, p_match_id, v_charge_fee, v_charge_fee,
    CASE WHEN v_fee_mode='coins' THEN 'coin'
         WHEN v_fee_mode='sky_diamonds' THEN 'sky_diamond'
         ELSE COALESCE(v_m.entry_type, 'free') END,
    'joined',
    COALESCE(p_join_data->>'mode', 'solo'),
    v_ign,
    v_ign,
    v_ff_uid,
    v_slot_num,
    COALESCE(p_join_data->>'feeType', 'solo')
  ) RETURNING id INTO v_jr_id;

  UPDATE matches SET filled_slots = COALESCE(filled_slots, 0) + v_slots WHERE id = p_match_id;

  /* ✅ BUG FIX (2026-10-04): DOUBLE-COMMISSION FIX. Pehle yahan (join-time)
     bhi creator_commissions row insert hoti thi, AUR finalize_creator_commission
     (match end) par bhi total se ek aur row — creator ko ek hi match ki
     commission DO BAAR milti thi. Ab commission ka SINGLE source of truth
     sirf finalize_creator_commission hai (match end par, actual paid entries
     ka sum × admin-set pct). Yahan koi commission insert NAHI hota. */

  RETURN jsonb_build_object('ok', true, 'jr_id', v_jr_id::TEXT);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error',
      CASE SQLERRM
        WHEN 'NOT_AUTHORIZED'       THEN 'Not authorized'
        WHEN 'MATCH_NOT_FOUND'      THEN 'Match not found'
        WHEN 'MATCH_NOT_JOINABLE'   THEN 'Match ab join nahi ho sakta'
        WHEN 'USER_NOT_FOUND'       THEN 'User not found'
        WHEN 'INSUFFICIENT_BALANCE' THEN 'Balance kam hai'
        WHEN 'ALREADY_JOINED'       THEN 'Aap already join ho chuke ho'
        WHEN 'MATCH_FULL'           THEN 'Match full ho gaya'
        WHEN 'SELF_PLAY_BLOCKED'    THEN 'Apne khud ke hosted match mein join nahi kar sakte'
        WHEN 'ACCOUNT_BANNED'       THEN 'Aapka account ban hai'
        ELSE SQLERRM
      END
    );
END;
$function$;
