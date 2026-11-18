-- ══════════════════════════════════════════════════════════════════════════
-- D99 AUDIT-FIX MIGRATION (2026-11-09) — third-party static audit ke P1 findings
-- Owner order: "Fix kar sab perfectly" (aur "kuch bhi galat nahi bachna chahiye")
-- ──────────────────────────────────────────────────────────────────────────────
-- Ye file LIVE DB ki pg_get_functiondef() output se bani hai (repo != live ka
-- gap khatam): har function ka base = jo aaj production me chal raha hai, usme
-- SIRF surgical fix. Naye function banane ka koi andaza nahi.
--
-- FIX LIST
--  (0) canonical entry-type → wallet helpers (coin/coins/sky/GD/free/ad)
--  (1) gift_match_entry  : 'coins' (plural) par SKY wallet se paisa kat raha tha
--                          (live matches ka entry_type 'coins' hi hai!) + match
--                          full/live/already-joined hone par bhi fee katkar ticket
--                          banta tha, entry nahi banti thi (paisa doobta tha)
--  (2) join_match_team   : D87 (GD entry abolished) TEAM path me लागू नहीं था —
--                          GD match ki team fee Green Diamonds se kat rahi thi
--  (3) cancel_match_with_refunds : gift se bani entry ka paisa GIVER ne diya hota
--                          hai; match cancel par giver ko refund nahi milta tha
--  (4) admin_confirm_creator_cheat : sirf exact 'sky_diamond'/'coins' par refund
--                          hota tha; baaki entry_type par balance credit NAHI
--                          hota tha phir bhi ledger me 'credit' row ban jati thi
--                          (jhootha ledger = audit trail jhooth)
--  (5) admin_dismiss_creator_flag / (6) creator_publish_result : ledger currency
--                          raw entry_type likhta tha ('sky_diamond'/'coin' jaise
--                          non-canonical labels) + singular 'coin' par galat wallet
--  (7) claim_ad_reward / (8) claim_watch_earn_reward : Origin check substring
--                          (`like '%…github.io%'`) tha → crafted Origin pass ho
--                          jata tha. Ab EXACT allowlist. watch-earn par origin
--                          check pehle tha hi nahi.
--  (9) ad_watch_start    : ek user 100 open ad-session stack karke daily-cap tak
--                          farming kar sakta tha → ek waqt me ek open session
-- (10) submit/resolve_sponsored_withdrawal : LIVE definitions repo me committed
--                          (parity) + reject semantics ka explicit proof field
-- ══════════════════════════════════════════════════════════════════════════

-- ── (0) CANONICAL HELPERS ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.norm_entry_type(p_entry_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT COALESCE(lower(regexp_replace(COALESCE(p_entry_type, ''), '[_[:space:]-]', '', 'g')), 'free');
$function$;

/* entry_type → users table ka wallet column.
   'none' = kuch charge/refund hota hi nahi (free / ad / unknown-empty). */
CREATE OR REPLACE FUNCTION public.wallet_col_for_entry_type(p_entry_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT CASE public.norm_entry_type(p_entry_type)
           WHEN 'coin'          THEN 'coins'
           WHEN 'coins'         THEN 'coins'
           WHEN 'cash'          THEN 'coins'
           WHEN 'paid'          THEN 'sky_diamonds'
           WHEN 'sky'           THEN 'sky_diamonds'
           WHEN 'skydiamond'    THEN 'sky_diamonds'
           WHEN 'skydiamonds'   THEN 'sky_diamonds'
           WHEN 'green'         THEN 'green_diamonds'
           WHEN 'greendiamond'  THEN 'green_diamonds'
           WHEN 'greendiamonds' THEN 'green_diamonds'
           WHEN 'free'          THEN 'none'
           WHEN 'ad'            THEN 'none'
           WHEN 'ads'           THEN 'none'
           WHEN ''              THEN 'none'
           ELSE 'sky_diamonds'
         END;
$function$;

/* wallet_transactions.currency ke liye canonical (plural) label. */
CREATE OR REPLACE FUNCTION public.ledger_currency_for_entry_type(p_entry_type text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT public.wallet_col_for_entry_type(p_entry_type);
$function$;

GRANT EXECUTE ON FUNCTION public.norm_entry_type(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wallet_col_for_entry_type(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ledger_currency_for_entry_type(text) TO anon, authenticated, service_role;


-- ── (1) gift_match_entry — FIXED ──
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
  /* ✅ D99 FIX (paisa doobne wala rasta): pehle fee ALWAYS kat jati thi aur
     join_request SIRF tab banti thi jab match upcoming ho + slot khali ho +
     dost already joined na ho. Warna ticket 'pending' pada rehta, entry nahi
     banti thi — paisa gaya, entry nahi. Ab joinability PEHLE check hoti hai,
     debit BAAD me. */
  IF COALESCE(v_m.status, '') <> 'upcoming' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Match ab joinable nahi hai (sirf upcoming match ka ticket gift ho sakta hai)');
  END IF;
  IF EXISTS (SELECT 1 FROM join_requests
              WHERE user_id = p_to_uid AND match_id = v_m.id
                AND status NOT IN ('cancelled','refunded','no_show','rejected')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Aapka dost is match me pehle se registered hai');
  END IF;
  IF COALESCE(v_m.max_slots, 0) > 0 AND COALESCE(v_m.filled_slots, 0) >= v_m.max_slots THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Match full hai — gift nahi bhej sakte');
  END IF;
  SELECT COALESCE(ign, 'Player') INTO v_my_name FROM users WHERE id = v_me;
  /* ✅ D99 FIX: purana check sirf singular 'coin' dekhta tha — live DB me
     creator matches ka entry_type 'coins' (plural) hota hai, isliye COIN match
     ka gift SKY DIAMONDS wallet se kat raha tha (UI coins dikha raha hota tha).
     Ab canonical helper (coin/coins/cash → coins, paid/sky* → sky_diamonds,
     green* → green_diamonds, free/ad → none). */
  v_col := public.wallet_col_for_entry_type(v_m.entry_type);
  IF v_col = 'none' THEN v_col := 'sky_diamonds'; END IF;  /* fee>0 hai, kuch to lagega */
  IF v_col = 'green_diamonds' THEN
    /* D87 (owner): GD se entry fee kabhi nahi katti — aisa match gift-worthy nahi */
    RETURN jsonb_build_object('ok', false, 'error', 'Green Diamond entry matches ab free hote hain — gift ki zaroorat nahi');
  END IF;

  EXECUTE format('SELECT COALESCE(%I, 0) FROM users WHERE id = $1 FOR UPDATE', v_col) INTO v_bal USING v_me;
  IF v_bal IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'User not found'); END IF;
  IF v_bal < v_m.entry_fee THEN RETURN jsonb_build_object('ok', false, 'error', 'Insufficient balance'); END IF;
  EXECUTE format('UPDATE users SET %I = COALESCE(%I, 0) - $1 WHERE id = $2', v_col, v_col) USING v_m.entry_fee, v_me;

  INSERT INTO gift_tickets (from_uid, from_name, to_uid, to_ff_uid, match_id, match_name, fee, entry_type, status)
  VALUES (v_me, v_my_name, p_to_uid, v_friend.ff_uid, v_m.id, v_m.name, v_m.entry_fee, v_m.entry_type, 'pending')
  RETURNING id INTO v_gift_id;
  INSERT INTO wallet_transactions (user_id, currency, txn_type, amount, reason)
  VALUES (v_me, v_col, 'debit', v_m.entry_fee, 'gift_entry');

  /* ✅ D99: joinability upar guarantee ho chuki hai — entry TURANT register
     hoti hai aur ticket 'delivered' mark hota hai (paisa kata + entry bani =
     flow complete; pehle 'pending' ticket adhakha chhoot jata tha). */
  INSERT INTO join_requests (match_id, user_id, status, entry_type, entry_fee_paid, user_ign, ign_at_join, user_ff_uid)
  VALUES (v_m.id, p_to_uid, 'pending', v_m.entry_type, 0,
          (SELECT COALESCE(ign,'Player') FROM users WHERE id = p_to_uid),
          (SELECT COALESCE(ign,'Player') FROM users WHERE id = p_to_uid),
          v_friend.ff_uid);
  UPDATE matches SET filled_slots = COALESCE(filled_slots,0) + 1 WHERE id = v_m.id;
  UPDATE gift_tickets SET status = 'delivered' WHERE id = v_gift_id;
  INSERT INTO notifications (user_id, type, title, body)
  VALUES (p_to_uid, 'gift_ticket', '🎁 Match Ticket Gift!', v_my_name || ' ne tumhe "' || v_m.name || '" ka entry ticket gift kiya — entry register ho gayi hai (approval creator karega).')
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'gift_id', v_gift_id, 'fee', v_m.entry_fee,
                            'currency', v_col, 'entry_registered', true, 'ticket_status', 'delivered');
END;
$function$;


-- ── (2) join_match_team — D87 GD policy TEAM path par bhi ──
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
    /* ✅ D99 FIX (D87 owner policy): Green Diamond ENTRY abolished — solo path
       (validate_and_join_match) me 07-Nov ko hi GD-entry FREE ho chuka tha, par
       TEAM path me abhi bhi GD wallet se entry fee kat rahi thi (solo vs team
       rules alag = audit finding). Ab dono identical: GD-entry match FREE,
       GD se fee KABHI nahi katti. GD sirf prize/points/rank ke liye (D87). */
    WHEN 'greendiamond' THEN v_server_fee := 0; v_fee_mode := 'free';
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


-- ── (3) cancel_match_with_refunds — gift GIVER refund ──
CREATE OR REPLACE FUNCTION public.cancel_match_with_refunds(p_match_id text, p_admin_uid text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_match RECORD; v_jr RECORD; v_refund_count INT := 0; v_currency TEXT;
  /* ✅ D99: gift-ticket refunds (giver ko paisa wapas) */
  v_gt RECORD; v_gt_col TEXT; v_gt_count INT := 0;
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
  /* ✅ D99 FIX (audit + own re-audit): gift entry ka paisa GIVER ne diya hota
     hai (join_requests.entry_fee_paid = 0 hota hai), isliye upar ka loop giver
     ko refund nahi karta tha — match cancel hone par giver ka paisa doob jata
     tha. Ab delivered gift tickets ka fee from_uid ko wapas + ledger + notif. */
  FOR v_gt IN
    SELECT * FROM gift_tickets
     WHERE match_id = p_match_id AND status = 'delivered' AND COALESCE(fee,0) > 0
     FOR UPDATE
  LOOP
    v_gt_col := public.wallet_col_for_entry_type(v_gt.entry_type);
    IF v_gt_col = 'green_diamonds' OR v_gt_col = 'none' THEN
      UPDATE gift_tickets SET status = 'refunded' WHERE id = v_gt.id;
      CONTINUE;
    END IF;
    EXECUTE format('UPDATE users SET %I = COALESCE(%I,0) + $1 WHERE id = $2', v_gt_col, v_gt_col)
      USING v_gt.fee, v_gt.from_uid;
    INSERT INTO wallet_transactions(user_id, currency, txn_type, amount, reason, ref_id, status)
    VALUES (v_gt.from_uid, v_gt_col, 'credit', v_gt.fee, 'match_cancelled_gift_refund', p_match_id, 'approved');
    UPDATE gift_tickets SET status = 'refunded' WHERE id = v_gt.id;
    INSERT INTO notifications(user_id, type, title, body, is_read, created_at, ref_id)
    VALUES (v_gt.from_uid, 'refund', '💰 Gift Entry Refund',
            CHR(34)||COALESCE(v_gt.match_name, p_match_id)||CHR(34)||' cancel ho gaya — aapka gift entry fee wapas kar diya gaya hai.',
            false, NOW(), p_match_id)
    ON CONFLICT DO NOTHING;
    v_gt_count := v_gt_count + 1;
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
  RETURN jsonb_build_object('ok', true, 'refund_count', v_refund_count,
                            'gift_refund_count', v_gt_count);   /* ✅ D99 */
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$;


-- ── (4) admin_confirm_creator_cheat — canonical refund + honest ledger ──
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
  v_col TEXT;   /* ✅ D99: canonical refund wallet */
BEGIN
  IF NOT EXISTS(SELECT 1 FROM users WHERE id = v_caller AND is_admin = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  SELECT match_id, creator_uid INTO v_match_id, v_owner FROM creator_result_flags WHERE id = p_flag_id AND status = 'open';
  IF v_match_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'flag_not_found_or_resolved'); END IF;

  /* ✅ D99 FIX: refund wallet ab canonical helper se decide hota hai. Pehle
     SIRF exact 'sky_diamond' / 'coins' strings par paisa wapas jata tha —
     'coin', 'paid', 'skydiamond' wale match par refund hota hi nahi tha, aur
     ledger me phir bhi 'credit' row ban jati thi (jhootha audit trail: ledger
     kehta paisa diya, balance me kuch nahi aata tha). Ab wallet + ledger ek hi
     helper se, aur ledger row SIRF tab banti hai jab balance sach me credit hua. */
  v_col := public.wallet_col_for_entry_type((SELECT entry_type FROM matches WHERE id = v_match_id));
  IF v_col = 'coins' THEN
    UPDATE users u SET coins = COALESCE(coins,0) + jr.entry_fee_paid
    FROM join_requests jr
    WHERE jr.match_id = v_match_id AND jr.user_id = u.id AND jr.entry_fee_paid > 0
      AND jr.status NOT IN ('refunded','cancelled');
  ELSIF v_col = 'sky_diamonds' THEN
    UPDATE users u SET sky_diamonds = COALESCE(sky_diamonds,0) + jr.entry_fee_paid
    FROM join_requests jr
    WHERE jr.match_id = v_match_id AND jr.user_id = u.id AND jr.entry_fee_paid > 0
      AND jr.status NOT IN ('refunded','cancelled');
  END IF;

  IF v_col IN ('coins','sky_diamonds') THEN
    INSERT INTO wallet_transactions(user_id, currency, txn_type, amount, reason, ref_id)
    SELECT jr.user_id, v_col, 'credit', jr.entry_fee_paid, 'creator_match_voided_refund', v_match_id
    FROM join_requests jr
    WHERE jr.match_id = v_match_id AND jr.entry_fee_paid > 0
      AND jr.status NOT IN ('refunded','cancelled');
    UPDATE join_requests SET status = 'refunded'
     WHERE match_id = v_match_id AND COALESCE(entry_fee_paid,0) > 0
       AND status NOT IN ('refunded','cancelled');
  END IF;

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
$function$;


-- ── (5) admin_dismiss_creator_flag — canonical prize wallet + ledger ──
CREATE OR REPLACE FUNCTION public.admin_dismiss_creator_flag(p_flag_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller TEXT := auth.jwt() ->> 'sub';
  v_match_id TEXT;
  v_owner TEXT;
  v_per_kill NUMERIC;
  v_entry_type TEXT;
  v_col TEXT;   /* ✅ D99: canonical prize wallet + ledger label */
BEGIN
  IF NOT EXISTS(SELECT 1 FROM users WHERE id = v_caller AND is_admin = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'admin_only');
  END IF;

  SELECT match_id, creator_uid INTO v_match_id, v_owner FROM creator_result_flags WHERE id = p_flag_id AND status = 'open';
  IF v_match_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'flag_not_found_or_resolved'); END IF;

  SELECT per_kill_prize, entry_type INTO v_per_kill, v_entry_type FROM matches WHERE id = v_match_id;

  -- Legit — pay out same as the normal auto-approve path would have.
  /* ✅ D99 FIX: (a) ledger currency raw entry_type likhta tha — 'sky_diamond'
     jaisa non-canonical label wallet_transactions me chala jata tha (baaki
     system 'sky_diamonds' plural use karta hai) → wallet history filter/total
     galat. (b) singular 'coin' wala match SKY wallet me prize deta tha.
     Ab canonical helper: coin/coins/cash → coins, green* → green_diamonds
     (D87: GD = prize/points currency), baaki → sky_diamonds. Ledger label
     hamesha us wallet ke barabar hi likha jata hai jis me paisa gaya. */
  IF v_per_kill > 0 THEN
    v_col := public.wallet_col_for_entry_type(v_entry_type);
    IF v_col = 'coins' THEN
      UPDATE users u SET coins = COALESCE(coins,0) + (jr.kills * v_per_kill)
      FROM join_requests jr WHERE jr.match_id = v_match_id AND jr.user_id = u.id AND jr.kills > 0;
    ELSIF v_col = 'green_diamonds' THEN
      UPDATE users u SET green_diamonds = COALESCE(green_diamonds,0) + (jr.kills * v_per_kill)
      FROM join_requests jr WHERE jr.match_id = v_match_id AND jr.user_id = u.id AND jr.kills > 0;
    ELSE
      v_col := 'sky_diamonds';
      UPDATE users u SET sky_diamonds = COALESCE(sky_diamonds,0) + (jr.kills * v_per_kill)
      FROM join_requests jr WHERE jr.match_id = v_match_id AND jr.user_id = u.id AND jr.kills > 0;
    END IF;
    INSERT INTO wallet_transactions(user_id, currency, txn_type, amount, reason, ref_id)
    SELECT user_id, v_col, 'credit', kills * v_per_kill, 'creator_match_prize', v_match_id
    FROM join_requests WHERE match_id = v_match_id AND kills > 0;
  END IF;

  UPDATE matches SET status = 'completed' WHERE id = v_match_id;
  PERFORM finalize_creator_commission(v_match_id);

  UPDATE creator_result_flags SET status = 'dismissed', resolved_at = NOW(), resolved_by = v_caller WHERE id = p_flag_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;


-- ── (6) creator_publish_result — canonical ledger/prize wallet ──
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
  /* ✅ D99 FIX (same class as admin_dismiss_creator_flag): ledger currency
     canonical helper se; singular 'coin' par galat wallet credit band; GD-entry
     creator match ka prize Green Diamonds me (D87 — GD = prize/points). */
  v_ledger_currency := public.wallet_col_for_entry_type(v_entry_type);

  IF v_per_kill > 0 THEN
    IF v_ledger_currency = 'coins' THEN
      UPDATE users u SET coins = COALESCE(coins,0) + (jr.kills * v_per_kill)
      FROM join_requests jr WHERE jr.match_id = p_match_id AND jr.user_id = u.id AND jr.kills > 0;
    ELSIF v_ledger_currency = 'green_diamonds' THEN
      UPDATE users u SET green_diamonds = COALESCE(green_diamonds,0) + (jr.kills * v_per_kill)
      FROM join_requests jr WHERE jr.match_id = p_match_id AND jr.user_id = u.id AND jr.kills > 0;
    ELSE
      v_ledger_currency := 'sky_diamonds';
      UPDATE users u SET sky_diamonds = COALESCE(sky_diamonds,0) + (jr.kills * v_per_kill)
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
$function$;


-- ── (7) claim_ad_reward — exact Origin allowlist ──
CREATE OR REPLACE FUNCTION public.claim_ad_reward()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid text; v_org text; v_hdrs jsonb; v_sid bigint;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'Not authorized'); end if;
  begin
    v_hdrs := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then v_hdrs := null; end;
  v_org := coalesce(current_setting('request.header.origin', true), v_hdrs ->> 'origin', '');
  /* ✅ D99 FIX: EXACT Origin allowlist — purana `not like '%…github.io%'`
     substring match tha, isliye koi bhi crafted Origin header (jaise
     'https://evil.example/deepsilence10161-source.github.io') pass ho jata tha. */
  if lower(btrim(coalesce(v_org, ''))) not in (
        'https://deepsilence10161-source.github.io',
        'https://deepsilence10161-source.github.io/',
        'https://deepsilence10161.workers.dev',
        'https://deepsilence10161.workers.dev/') then
    return jsonb_build_object('success', false, 'error', 'origin not allowed');
  end if;
  select id into v_sid from public.ad_watch_sessions
   where uid = v_uid and not consumed
     and started_at between now() - interval '150 seconds' and now() - interval '4 seconds'
   order by started_at desc limit 1;
  if v_sid is null then
    return jsonb_build_object('success', false, 'error', 'no active ad session — pehle ad dekhiye');
  end if;
  update public.ad_watch_sessions set consumed = true where id = v_sid;
  return public.claim_ad_reward_inner();
end $function$;


-- ── (8) claim_watch_earn_reward — exact Origin allowlist (naya guard) ──
CREATE OR REPLACE FUNCTION public.claim_watch_earn_reward(p_match_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid text; v_started timestamptz; v_beat timestamptz; v_org text; v_hdrs jsonb;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'Not authorized'); end if;
  /* ✅ D99 FIX: watch-earn claim par pehle koi Origin check tha hi nahi (ad
     reward par bhi sirf substring tha). Ab dono par EXACT allowlist — session
     heartbeat wala script-farming rasta aur tang. */
  begin
    v_hdrs := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then v_hdrs := null; end;
  v_org := coalesce(current_setting('request.header.origin', true), v_hdrs ->> 'origin', '');
  if lower(btrim(coalesce(v_org, ''))) not in (
        'https://deepsilence10161-source.github.io',
        'https://deepsilence10161-source.github.io/',
        'https://deepsilence10161.workers.dev',
        'https://deepsilence10161.workers.dev/') then
    return jsonb_build_object('success', false, 'error', 'origin not allowed');
  end if;
  select started_at, last_beat into v_started, v_beat
    from public.watch_earn_sessions
   where uid = v_uid and match_id = p_match_id and closed_at is null
   order by started_at desc limit 1;
  if v_started is null then
    return jsonb_build_object('success', false, 'error', 'watch session not active');
  end if;
  if now() - v_beat > interval '100 seconds' then
    return jsonb_build_object('success', false, 'error', 'watch session stale — match live dekhte rahiye');
  end if;
  if now() - v_started < interval '45 seconds' then
    return jsonb_build_object('success', false, 'error', 'abhi watch shuru hua — thodi der me reward');
  end if;
  return public.claim_watch_earn_inner(p_match_id);
end $function$;


-- ── (9) ad_watch_start — ek waqt me ek open session ──
CREATE OR REPLACE FUNCTION public.ad_watch_start()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_uid text; v_id bigint;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'Not authorized'); end if;
  /* ✅ D99 FIX: session STACKING band. Pehle ek script ek hi waqt me दर्जनों
     open ad-session bana kar (har ek 4-150 second window me valid) daily-cap
     tak claims nikal sakti thi — bina asli ad dekhe. Ab ek user ke liye ek hi
     open session: naya start = purana expire. */
  update public.ad_watch_sessions set consumed = true where uid = v_uid and not consumed;
  insert into public.ad_watch_sessions(uid) values (v_uid) returning id into v_id;
  return jsonb_build_object('success', true, 'session', v_id);
end $function$;


-- ── (10) sponsored withdrawal — LIVE definitions repo me committed (parity) ──
-- NOTE: ye dono function production me pehle se maujood the; repo me source
--       nahi tha (audit finding D). Ab repo = live (byte-for-byte base +
--       reject-path clarity), taaki future audit me "source available nahi" na aaye.
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
$function$;

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

  IF p_action = 'reject' THEN
    /* ✅ D99 CLARITY (audit finding C): submit_sponsored_withdrawal balance ko
       DEDUCT karta hi nahi (sirf pending-guard rakhta hai), isliye reject par
       refund ki zaroorat NAHI — paisa user ke sponsored_winnings me pehle se
       maujood hai. Client (js/fix5-listener-manager.js) pehle "Amount refunded"
       toast dikha kar ek blocked Firebase-style credit try karta tha = jhootha
       message + silent no-op; wo client code isi release me hata diya gaya hai.
       Reject par balance_after dikhaane ke liye actual balance padh lete hain. */
    SELECT COALESCE(sponsored_winnings,0) INTO v_balance FROM users WHERE id = v_txn.user_id;
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
                            'amount', v_txn.amount, 'balance_after', (CASE WHEN p_action='approve' THEN v_after ELSE v_balance END),
                            /* ✅ D99: reject par refund hota hi nahi (submit par deduction hota hi nahi) */
                            'refund_required', (p_action = 'reject' AND false),
                            'balance_deducted_at_submit', false);
END;
$function$;


-- ── VERIFY (apply ke baad yahi row proof hai) ───────────────────────────────
SELECT jsonb_build_object(
  'helper_wallet_col',    (SELECT count(*) FROM pg_proc WHERE proname='wallet_col_for_entry_type'),
  'unit_coins_plural',    public.wallet_col_for_entry_type('coins'),
  'unit_coin_singular',   public.wallet_col_for_entry_type('coin'),
  'unit_sky_diamond',     public.wallet_col_for_entry_type('sky_diamond'),
  'unit_green_diamond',   public.wallet_col_for_entry_type('green_diamond'),
  'unit_free',            public.wallet_col_for_entry_type('free'),
  'gift_canonical',       (SELECT count(*) FROM pg_proc WHERE proname='gift_match_entry'
                             AND prosrc LIKE '%wallet_col_for_entry_type%'
                             AND prosrc LIKE '%Match full hai%'),
  'team_d87_free',        (SELECT count(*) FROM pg_proc WHERE proname='join_match_team'
                             AND prosrc LIKE '%GD-entry match FREE%'),
  'gift_giver_refund',    (SELECT count(*) FROM pg_proc WHERE proname='cancel_match_with_refunds'
                             AND prosrc LIKE '%match_cancelled_gift_refund%'),
  'cheat_canonical',      (SELECT count(*) FROM pg_proc WHERE proname='admin_confirm_creator_cheat'
                             AND prosrc LIKE '%wallet_col_for_entry_type%'),
  'dismiss_canonical',    (SELECT count(*) FROM pg_proc WHERE proname='admin_dismiss_creator_flag'
                             AND prosrc LIKE '%wallet_col_for_entry_type%'),
  'publish_canonical',    (SELECT count(*) FROM pg_proc WHERE proname='creator_publish_result'
                             AND prosrc LIKE '%wallet_col_for_entry_type%'),
  'ad_origin_exact',      (SELECT count(*) FROM pg_proc WHERE proname='claim_ad_reward'
                             AND prosrc LIKE '%not in (%'
                             AND prosrc LIKE '%''https://deepsilence10161-source.github.io''%'),
  'w2e_origin_exact',     (SELECT count(*) FROM pg_proc WHERE proname='claim_watch_earn_reward'
                             AND prosrc LIKE '%origin not allowed%'),
  'ad_single_session',    (SELECT count(*) FROM pg_proc WHERE proname='ad_watch_start'
                             AND prosrc LIKE '%set consumed = true%'),
  'sponsored_parity',     (SELECT count(*) FROM pg_proc WHERE proname IN
                             ('submit_sponsored_withdrawal','resolve_sponsored_withdrawal'))
) AS d99_proof;
