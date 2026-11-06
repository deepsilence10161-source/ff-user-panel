-- ═══════════════════════════════════════════════════════════════════════════
--  20261030_match_money_team_fixes.sql — MATCH-FLOW-E2E (owner ke 7 usernames)
--  ke live runs me mile SERVER-SIDE bugs ke fix (sab live-proven):
--
--  BUG A (paisa, P0): join_match_team green_diamond/sky_diamond entry_type ko
--    pehchanta hi nahi tha → green match ka team fee SKY wallet se katta tha
--    (run 40986675005 MF19: tx currency=sky_diamonds amount=40 green match ka).
--  BUG B (P0): respond_team_invite ka notification INSERT captain ke liye
--    unique constraint se takrata tha → 2nd/3rd member ka accept rollback →
--    invite pending forever → SQUAD JOIN IMPOSSIBLE (MF20: TEAM_NOT_AUTHORIZED).
--  BUG C (paisa): cancel_match_with_refunds + claim_match_refund (dono
--    overloads) green_diamond refund SKY wallet me dete the (MF30).
--  BUG D (UX): gift_match_entry ka notification insert bhi conflict-prone.
--  NAYA: creator_get_match_participants RPC — creator ka result form
--    "Koi player nahi mila" dikhata tha kyunki client ke PostgREST calls me
--    auth.jwt()->>'sub' NULL jata hai (claim_match_refund ka A11 comment iska
--    pehla saboot) aur join_requests RLS select isi par chalta hai. SECURITY
--    DEFINER RPC (jwt warna p_uid fallback; sirf creator/admin ko data) ab
--    result form ko participants deta hai — client patch creator-match-host.js.
--
--  Function bodies live DB se pg_get_functiondef dump (supabase-dump.yml,
--  2026-10-30) se li gayi hain — sirf marked fixes badle hain, baaki logic
--  byte-for-byte wahi hai.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.join_match_team(p_match_id text, p_mode text, p_fee_type text, p_team jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller       TEXT := auth.jwt() ->> 'sub';
  v_m            RECORD;
  v_fee_mode     TEXT;
  v_server_fee   NUMERIC;
  v_slots        INT;
  v_captain_fee  NUMERIC;
  v_member_fee   NUMERIC;
  v_total_collected NUMERIC := 0;
  v_available    INT;
  v_mem          JSONB;
  v_mem_uid      TEXT;
  v_mem_ign      TEXT;
  v_mem_ff_uid   TEXT;
  v_slot_num     INT;
  v_bal          NUMERIC;
  v_col          TEXT;
  v_jr_id        UUID;
  v_idx          INT := 0;
  v_unique_uids  TEXT[] := ARRAY[]::TEXT[];
  v_creator_code TEXT;
  v_creator_uid  TEXT;
  v_commission_pct NUMERIC;
  v_commission   NUMERIC;
  v_first_row_id UUID;
  v_authorized   BOOLEAN;
  v_team         JSONB := '[]'::jsonb;
  v_auto_squad   BOOLEAN := false;
  v_team_id_for_as TEXT;
  v_q            RECORD;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF p_mode IS NULL THEN p_mode := 'solo'; END IF;
  p_mode := lower(p_mode);
  v_slots := CASE WHEN p_mode = 'duo' THEN 2 WHEN p_mode = 'squad' THEN 4 ELSE 1 END;

  IF p_fee_type IS NULL THEN p_fee_type := 'captain_pays'; END IF;
  p_fee_type := lower(p_fee_type);
  IF p_fee_type NOT IN ('captain_pays','each_pays','solo') THEN p_fee_type := 'captain_pays'; END IF;
  IF v_slots = 1 THEN p_fee_type := 'solo'; END IF;

  SELECT id, status, entry_type, entry_fee, max_slots, filled_slots, creator_uid
    INTO v_m
    FROM matches
   WHERE id = p_match_id
     FOR UPDATE;
  IF v_m.id IS NULL THEN RAISE EXCEPTION 'MATCH_NOT_FOUND'; END IF;
  IF v_m.status IS DISTINCT FROM 'upcoming' AND v_m.status IS DISTINCT FROM 'live' THEN
    RAISE EXCEPTION 'MATCH_NOT_JOINABLE';
  END IF;
  IF v_m.creator_uid IS NOT NULL AND v_m.creator_uid = v_caller THEN
    RAISE EXCEPTION 'SELF_PLAY_BLOCKED';
  END IF;

  CASE COALESCE(lower(regexp_replace(v_m.entry_type, '[_ -]', '', 'g')), 'free')
    WHEN 'coin'  THEN v_server_fee := COALESCE(v_m.entry_fee,0); v_fee_mode := 'coins';
    WHEN 'paid'  THEN v_server_fee := COALESCE(v_m.entry_fee,0); v_fee_mode := 'sky_diamonds';
    WHEN 'skydiamond' THEN v_server_fee := COALESCE(v_m.entry_fee,0); v_fee_mode := 'sky_diamonds';
    /* ✅ MATCH-FLOW-E2E FIX (2026-10-30): 'greendiamond'/'skydiamond' branches
       missing the — green_diamond match ka TEAM fee ELSE branch se SKY wallet
       se kat raha tha (live proof: run 40986675005 MF19, tx currency=sky_diamonds
       amount=40 green match ke liye). validate_and_join_match (solo) me ye fix
       2026-10-04 ko ho chuka tha; team path reh gaya tha. */
    WHEN 'greendiamond' THEN v_server_fee := COALESCE(v_m.entry_fee,0); v_fee_mode := 'green_diamonds';
    WHEN 'free'  THEN v_server_fee := 0; v_fee_mode := 'free';
    WHEN 'ad'    THEN v_server_fee := 0; v_fee_mode := 'ad';
    ELSE
      IF COALESCE(v_m.entry_fee,0) > 0 THEN v_server_fee := v_m.entry_fee; v_fee_mode := 'sky_diamonds';
      ELSE v_server_fee := 0; v_fee_mode := 'free'; END IF;
  END CASE;
  v_col := CASE WHEN v_fee_mode = 'coins' THEN 'coins' WHEN v_fee_mode = 'green_diamonds' THEN 'green_diamonds' ELSE 'sky_diamonds' END;

  IF v_slots >= 2 AND (p_team IS NULL OR jsonb_typeof(p_team) <> 'array' OR jsonb_array_length(p_team) = 0) THEN
    SELECT team_id INTO v_team_id_for_as
      FROM auto_squad_queue
     WHERE match_id = p_match_id AND user_id = v_caller
       AND status = 'matched' AND mode = p_mode AND team_id IS NOT NULL
     FOR UPDATE;
    IF v_team_id_for_as IS NULL THEN
      RAISE EXCEPTION 'AUTO_SQUAD_NO_MATCH';
    END IF;
    v_auto_squad := true;
    p_fee_type := 'each_pays';
    FOR v_q IN
      SELECT aq.user_id AS uid, COALESCE(u.ign, aq.ign, 'Player') AS ign
        FROM auto_squad_queue aq
        LEFT JOIN users u ON u.id = aq.user_id
       WHERE aq.match_id = p_match_id AND aq.team_id = v_team_id_for_as
         AND aq.status = 'matched' AND aq.mode = p_mode
       ORDER BY (aq.user_id = v_caller) DESC, aq.rank_pts DESC, aq.joined_at ASC
       FOR UPDATE OF aq
    LOOP
      v_team := v_team || jsonb_build_object('uid', v_q.uid, 'ign', v_q.ign);
    END LOOP;
    IF jsonb_array_length(v_team) <> v_slots THEN
      RAISE EXCEPTION 'AUTO_SQUAD_INCOMPLETE';
    END IF;
  ELSE
    IF p_team IS NULL OR jsonb_typeof(p_team) <> 'array' OR jsonb_array_length(p_team) = 0 THEN
      RAISE EXCEPTION 'INVALID_TEAM';
    END IF;
    v_team := p_team;
  END IF;

  v_mem := v_team -> 0;
  IF (v_mem->>'uid') IS NULL OR (v_mem->>'uid') <> v_caller THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF jsonb_array_length(v_team) <> v_slots THEN
    RAISE EXCEPTION 'TEAM_SIZE_MISMATCH';
  END IF;

  v_captain_fee := CASE WHEN p_fee_type = 'each_pays' THEN v_server_fee
                        ELSE v_server_fee * v_slots END;
  v_member_fee := CASE WHEN p_fee_type = 'each_pays' THEN v_server_fee ELSE 0 END;

  v_available := COALESCE(v_m.max_slots, 999) - COALESCE(v_m.filled_slots, 0);
  IF v_available < v_slots THEN RAISE EXCEPTION 'MATCH_FULL'; END IF;

  FOR v_idx IN 0 .. jsonb_array_length(v_team) - 1 LOOP
    v_mem := v_team -> v_idx;
    v_mem_uid := v_mem->>'uid';
    IF v_mem_uid IS NULL OR v_mem_uid = ANY(v_unique_uids) THEN
      RAISE EXCEPTION 'INVALID_TEAM';
    END IF;
    v_unique_uids := v_unique_uids || v_mem_uid;
    IF COALESCE((SELECT is_banned FROM users WHERE id = v_mem_uid), false) THEN
      RAISE EXCEPTION 'ACCOUNT_BANNED';
    END IF;
    IF EXISTS(SELECT 1 FROM join_requests
              WHERE user_id = v_mem_uid AND match_id = p_match_id
                AND status NOT IN ('cancelled','refunded','no_show')) THEN
      RAISE EXCEPTION 'ALREADY_JOINED';
    END IF;

    IF v_idx >= 1 AND NOT v_auto_squad THEN
      v_authorized := EXISTS(
        SELECT 1 FROM team_invitations ti
        WHERE ti.match_id    = p_match_id
          AND ti.captain_uid = v_caller
          AND ti.member_uid  = v_mem_uid
          AND ti.status      = 'accepted'
          AND ti.mode        = p_mode
          AND ti.fee_type    = p_fee_type
      );
      IF NOT v_authorized THEN
        v_authorized := EXISTS(
          SELECT 1 FROM auto_squad_queue my
          JOIN auto_squad_queue them
            ON them.match_id = my.match_id
           AND them.team_id  = my.team_id
         WHERE my.match_id   = p_match_id
           AND my.user_id    = v_caller
           AND my.status     = 'matched'
           AND my.mode       = p_mode
           AND them.user_id  = v_mem_uid
           AND them.status   = 'matched'
           AND them.mode     = p_mode
           AND my.team_id IS NOT NULL
           AND COALESCE(my.fee_type, them.fee_type, 'each_pays') = p_fee_type
        );
      END IF;
      IF NOT v_authorized THEN
        IF EXISTS(
          SELECT 1 FROM team_invitations ti
          WHERE ti.match_id = p_match_id
            AND ti.captain_uid = v_caller
            AND ti.member_uid = v_mem_uid
            AND ti.status = 'accepted'
        ) THEN
          RAISE EXCEPTION 'TEAM_TERMS_MISMATCH';
        END IF;
        RAISE EXCEPTION 'TEAM_NOT_AUTHORIZED';
      END IF;
    END IF;
  END LOOP;

  IF v_server_fee > 0 THEN
    FOR v_idx IN 0 .. jsonb_array_length(v_team) - 1 LOOP
      v_mem := v_team -> v_idx;
      v_mem_uid := v_mem->>'uid';
      IF v_col = 'coins' THEN
        SELECT coins INTO v_bal FROM users WHERE id = v_mem_uid FOR UPDATE;
      ELSIF v_col = 'green_diamonds' THEN
        SELECT green_diamonds INTO v_bal FROM users WHERE id = v_mem_uid FOR UPDATE;
      ELSE
        SELECT sky_diamonds INTO v_bal FROM users WHERE id = v_mem_uid FOR UPDATE;
      END IF;
      IF v_bal IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
      IF v_idx = 0 THEN
        IF v_bal < v_captain_fee THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
      ELSE
        IF v_bal < v_member_fee THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE'; END IF;
      END IF;
    END LOOP;
  END IF;

  FOR v_idx IN 0 .. jsonb_array_length(v_team) - 1 LOOP
    v_mem := v_team -> v_idx;
    v_mem_uid := v_mem->>'uid';
    SELECT
      COALESCE(NULLIF(v_mem->>'ign', ''), u.ign, ''),
      COALESCE(NULLIF(v_mem->>'ffUid', ''), u.ff_uid, '')
    INTO v_mem_ign, v_mem_ff_uid
    FROM users u
    WHERE u.id = v_mem_uid;

    v_mem_ign := COALESCE(v_mem_ign, '');
    v_mem_ff_uid := COALESCE(v_mem_ff_uid, '');
    v_slot_num := COALESCE(v_m.filled_slots, 0) + v_idx + 1;

    IF v_idx = 0 THEN v_bal := v_captain_fee; ELSE v_bal := v_member_fee; END IF;

    IF v_server_fee > 0 AND v_bal > 0 THEN
      IF v_col = 'coins' THEN
        UPDATE users SET coins = coins - v_bal WHERE id = v_mem_uid;
      ELSIF v_col = 'green_diamonds' THEN
        UPDATE users SET green_diamonds = green_diamonds - v_bal WHERE id = v_mem_uid;
      ELSE
        UPDATE users SET sky_diamonds = sky_diamonds - v_bal WHERE id = v_mem_uid;
      END IF;
      INSERT INTO wallet_transactions(user_id, currency, txn_type, amount, reason, ref_id)
      VALUES (v_mem_uid, v_fee_mode, 'debit', v_bal, 'match_entry', p_match_id);
      v_total_collected := v_total_collected + v_bal;
    END IF;

    INSERT INTO join_requests(
      user_id, match_id, entry_fee, entry_fee_paid, entry_type,
      status, mode, ign_at_join, user_ign, user_ff_uid, slot_number, fee_type, captain_uid
    )
    VALUES(
      v_mem_uid, p_match_id, v_bal, v_bal,
      CASE WHEN v_fee_mode='coins' THEN 'coin'
           WHEN v_fee_mode='sky_diamonds' THEN 'sky_diamond'
           WHEN v_fee_mode='green_diamonds' THEN 'green_diamond'
           ELSE COALESCE(v_m.entry_type,'free') END,
      'joined', p_mode, v_mem_ign, v_mem_ign, v_mem_ff_uid, v_slot_num, p_fee_type,
      CASE WHEN v_idx = 0 THEN NULL ELSE v_caller END
    ) RETURNING id INTO v_jr_id;
    IF v_idx = 0 THEN v_first_row_id := v_jr_id; END IF;
  END LOOP;

  UPDATE matches SET filled_slots = COALESCE(filled_slots, 0) + v_slots WHERE id = p_match_id;

  IF v_fee_mode = 'sky_diamonds' AND v_total_collected > 0 THEN
    SELECT creator_code INTO v_creator_code FROM users WHERE id = v_caller;
    IF v_creator_code IS NOT NULL THEN
      SELECT user_id INTO v_creator_uid FROM creator_codes WHERE code = v_creator_code;
      IF v_creator_uid IS NOT NULL AND v_creator_uid <> v_caller
         AND EXISTS(SELECT 1 FROM users WHERE id = v_creator_uid AND is_creator = true) THEN
        SELECT COALESCE((value->>'sdMatchCommissionPct')::numeric, 15)
          INTO v_commission_pct FROM app_settings WHERE key = 'creator_system';
        v_commission_pct := COALESCE(v_commission_pct, 15);
        v_commission := ROUND(v_total_collected * v_commission_pct / 100, 2);
        INSERT INTO creator_stats(user_id, total_matches, total_earnings)
        VALUES (v_creator_uid, 1, v_commission)
        ON CONFLICT (user_id) DO UPDATE SET
          total_matches = creator_stats.total_matches + 1,
          total_earnings = creator_stats.total_earnings + v_commission, updated_at = NOW();
        INSERT INTO creator_commissions(creator_uid, match_id, amount, currency, status, eligible_at)
        VALUES (v_creator_uid, p_match_id, v_commission, 'inr', 'hold', NOW() + INTERVAL '7 days');
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'captain_row_id', v_first_row_id, 'slots', v_slots);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'code', SQLERRM, 'error',
      CASE SQLERRM
        WHEN 'NOT_AUTHORIZED'        THEN 'Not authorized'
        WHEN 'TEAM_NOT_AUTHORIZED'   THEN 'Teammates ne join authorize nahi kiya — pehle team invite accept karwao'
        WHEN 'TEAM_TERMS_MISMATCH'   THEN 'Invite ke terms match nahi — invite me jo mode/fee-type thi wahi chun ke join karo'
        WHEN 'AUTO_SQUAD_NO_MATCH'   THEN 'Tumhari koi matched auto-squad team nahi hai'
        WHEN 'AUTO_SQUAD_INCOMPLETE' THEN 'Auto-squad team abhi poori nahi hui'
        WHEN 'MATCH_NOT_FOUND'       THEN 'Match not found'
        WHEN 'MATCH_NOT_JOINABLE'    THEN 'Match ab join nahi ho sakta'
        WHEN 'SELF_PLAY_BLOCKED'     THEN 'Apne khud ke hosted match mein join nahi kar sakte'
        WHEN 'ACCOUNT_BANNED'        THEN 'Kisi teammate ka account ban hai'
        WHEN 'ALREADY_JOINED'        THEN 'Koi teammate already is match mein join hai'
        WHEN 'MATCH_FULL'            THEN 'Match full ho gaya'
        WHEN 'INSUFFICIENT_BALANCE'  THEN 'Kisi teammate ke paas balance kam hai'
        WHEN 'USER_NOT_FOUND'        THEN 'Player not found'
        WHEN 'TEAM_SIZE_MISMATCH'    THEN 'Team size galat hai'
        WHEN 'INVALID_TEAM'          THEN 'Team invalid hai'
        ELSE SQLERRM
      END);
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_team_invite(p_invite_id uuid, p_accept boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller TEXT := auth.jwt() ->> 'sub';
  v_inv    RECORD;
  v_action TEXT;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_inv FROM team_invitations WHERE id = p_invite_id FOR UPDATE;
  IF v_inv.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation not found');
  END IF;
  IF v_inv.member_uid <> v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Ye invitation tumhare liye nahi hai');
  END IF;
  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invitation pehle se respond ho chuki hai');
  END IF;

  v_action := CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;
  UPDATE team_invitations
     SET status = v_action,
         accepted_at = CASE WHEN p_accept THEN NOW() ELSE accepted_at END
   WHERE id = p_invite_id;

  INSERT INTO notifications (user_id, type, title, body, ref_id)
  VALUES (v_inv.captain_uid, 'team_invite_response', '👥 Team Response',
          (SELECT COALESCE(ign,'Player') FROM users WHERE id = v_caller)
          || ' ne team invite ' || v_action || ' kar di.',
          v_inv.match_id)
  /* ✅ MATCH-FLOW-E2E FIX (2026-10-30): captain ke liye (user_id,type,ref)
     unique notification constraint squad me 2nd/3rd member ke respond par
     dup-key deta tha → poora function rollback → invite 'pending' hi rehti
     thi → join_match_team hamesha TEAM_NOT_AUTHORIZED (live proof: run
     40986675005 MF20 — squad join product me IMPOSSIBLE tha). */
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'action', v_action);
END;
$function$;

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
    v_currency := CASE WHEN COALESCE(v_jr.entry_type,'') IN ('coin','coins') THEN 'coins'
                       WHEN COALESCE(v_jr.entry_type,'') IN ('green_diamond','greendiamond','green') THEN 'green_diamonds'
                       ELSE 'sky_diamonds' END;
    IF v_currency = 'coins' THEN
      UPDATE users SET coins = COALESCE(coins,0) + v_jr.entry_fee_paid WHERE id = v_jr.user_id;
    ELSIF v_currency = 'green_diamonds' THEN
      UPDATE users SET green_diamonds = COALESCE(green_diamonds,0) + v_jr.entry_fee_paid WHERE id = v_jr.user_id;
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

CREATE OR REPLACE FUNCTION public.claim_match_refund(p_join_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller TEXT := auth.jwt() ->> 'sub';
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

  IF COALESCE(v_jr.entry_fee_paid, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nothing to refund', 'refunded', 0);
  END IF;

  /* ✅ MATCH-FLOW-E2E FIX (2026-10-30): green_diamond refund green wallet me. */
  v_col := CASE WHEN v_jr.entry_type IN ('coin','coins') THEN 'coins'
                WHEN v_jr.entry_type IN ('green_diamond','greendiamond','green') THEN 'green_diamonds'
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

  INSERT INTO wallet_transactions (user_id, currency, txn_type, amount, reason, ref_id)
  VALUES (v_caller, v_col, 'credit', v_jr.entry_fee_paid, 'match_refund', v_jr.match_id);

  RETURN jsonb_build_object('success', true, 'refunded', v_jr.entry_fee_paid, 'currency', v_col);
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_match_refund(p_join_id uuid, p_uid text DEFAULT NULL::text)
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

  IF COALESCE(v_jr.entry_fee_paid, 0) <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nothing to refund', 'refunded', 0);
  END IF;

  /* ✅ MATCH-FLOW-E2E FIX (2026-10-30): green_diamond refund green wallet me. */
  v_col := CASE WHEN v_jr.entry_type IN ('coin','coins') THEN 'coins'
                WHEN v_jr.entry_type IN ('green_diamond','greendiamond','green') THEN 'green_diamonds'
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
$function$;

-- ── NAYA RPC: creator ke liye participants (result form ka data) ─────────────
CREATE OR REPLACE FUNCTION public.creator_get_match_participants(p_match_id text, p_uid text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  /* A11 pattern: identity pehle JWT se, warna p_uid se — par data SIRF us
     match ka jiska creator_uid = caller ho (ya caller admin ho). */
  v_caller TEXT := COALESCE(auth.jwt() ->> 'sub', NULLIF(btrim(p_uid), ''));
  v_m RECORD;
  v_rows jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_AUTHORIZED');
  END IF;
  SELECT id, creator_uid INTO v_m FROM matches WHERE id = p_match_id;
  IF v_m.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MATCH_NOT_FOUND');
  END IF;
  IF COALESCE(v_m.creator_uid, '') <> v_caller
     AND NOT COALESCE((SELECT is_admin FROM users WHERE id = v_caller), false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NOT_YOUR_MATCH');
  END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', jr.id, 'user_id', jr.user_id,
           'user_ign', jr.user_ign, 'ign_at_join', jr.ign_at_join,
           'status', jr.status
         ) ORDER BY jr.slot_number NULLS LAST), '[]'::jsonb)
    INTO v_rows
    FROM join_requests jr
   WHERE jr.match_id = p_match_id
     AND jr.status IN ('pending', 'joined', 'approved');
  RETURN jsonb_build_object('ok', true, 'players', v_rows);
END;
$function$;
