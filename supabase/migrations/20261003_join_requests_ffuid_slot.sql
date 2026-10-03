-- Ensure validate_and_join_match and join_match_team populate user_ign, user_ff_uid, slot_number, and entry_fee on join_requests

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
  v_creator_code   TEXT;
  v_creator_uid    TEXT;
  v_commission     NUMERIC;
  v_commission_pct NUMERIC;
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

  CASE COALESCE(lower(regexp_replace(v_m.entry_type, '[_ -]', '', 'g')), 'free')
    WHEN 'coin' THEN
      v_server_fee := COALESCE(v_m.entry_fee, 0);
      v_fee_mode   := 'coins';
    WHEN 'paid' THEN
      v_server_fee := COALESCE(v_m.entry_fee, 0);
      v_fee_mode   := 'sky_diamonds';
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

  IF v_fee_mode = 'sky_diamonds' AND v_charge_fee > 0 THEN
    SELECT creator_code INTO v_creator_code FROM users WHERE id = p_uid;
    IF v_creator_code IS NOT NULL THEN
      SELECT user_id INTO v_creator_uid FROM creator_codes WHERE code = v_creator_code;
      IF v_creator_uid IS NOT NULL AND v_creator_uid <> p_uid
         AND EXISTS(SELECT 1 FROM users WHERE id = v_creator_uid AND is_creator = true) THEN
        SELECT COALESCE((value->>'sdMatchCommissionPct')::numeric, 15)
          INTO v_commission_pct
          FROM app_settings WHERE key = 'creator_system';
        v_commission_pct := COALESCE(v_commission_pct, 15);
        v_commission := ROUND(v_charge_fee * v_commission_pct / 100, 2);
        INSERT INTO creator_stats(user_id, total_matches, total_earnings)
        VALUES (v_creator_uid, 1, v_commission)
        ON CONFLICT (user_id) DO UPDATE SET
          total_matches = creator_stats.total_matches + 1,
          total_earnings = creator_stats.total_earnings + v_commission,
          updated_at = NOW();
        INSERT INTO creator_commissions(creator_uid, match_id, amount, currency, status, eligible_at)
        VALUES (v_creator_uid, p_match_id, v_commission, 'inr', 'hold', NOW() + INTERVAL '7 days');
      END IF;
    END IF;
  END IF;

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

-- Backfill existing join_requests rows where user_ign or user_ff_uid is empty
UPDATE public.join_requests jr
SET
  user_ign = COALESCE(NULLIF(jr.user_ign, ''), NULLIF(jr.ign_at_join, ''), u.ign, ''),
  ign_at_join = COALESCE(NULLIF(jr.ign_at_join, ''), NULLIF(jr.user_ign, ''), u.ign, ''),
  user_ff_uid = COALESCE(NULLIF(jr.user_ff_uid, ''), u.ff_uid, '')
FROM public.users u
WHERE u.id = jr.user_id
  AND (jr.user_ign IS NULL OR jr.user_ign = '' OR jr.user_ff_uid IS NULL OR jr.user_ff_uid = '');

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
    WHEN 'free'  THEN v_server_fee := 0; v_fee_mode := 'free';
    WHEN 'ad'    THEN v_server_fee := 0; v_fee_mode := 'ad';
    ELSE
      IF COALESCE(v_m.entry_fee,0) > 0 THEN v_server_fee := v_m.entry_fee; v_fee_mode := 'sky_diamonds';
      ELSE v_server_fee := 0; v_fee_mode := 'free'; END IF;
  END CASE;
  v_col := CASE WHEN v_fee_mode = 'coins' THEN 'coins' ELSE 'sky_diamonds' END;

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

DROP POLICY IF EXISTS aal_user_self_alert_insert ON public.admin_activity_log;
CREATE POLICY aal_user_self_alert_insert ON public.admin_activity_log
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'sub') IS NOT NULL
    AND admin_uid IS NULL
    AND COALESCE(target_user_id, target_uid) = (auth.jwt() ->> 'sub')
  );

ALTER TABLE public.admin_activity_log ALTER COLUMN admin_uid SET DEFAULT 'system';

DROP POLICY IF EXISTS aal_user_self_alert_insert ON public.admin_activity_log;
CREATE POLICY aal_user_self_alert_insert ON public.admin_activity_log
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'sub') IS NOT NULL
    AND COALESCE(admin_uid, 'system') IN ('system', (auth.jwt() ->> 'sub'))
    AND COALESCE(target_user_id, target_uid) = (auth.jwt() ->> 'sub')
  );

CREATE OR REPLACE FUNCTION public.fn_emit_universal_pulse()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid text;
  v_tag text;
  v_old_json jsonb;
  v_new_json jsonb;
BEGIN
  IF TG_TABLE_NAME = 'matches' THEN
    v_uid := '*';
  ELSIF TG_OP = 'DELETE' THEN
    v_old_json := to_jsonb(OLD);
    v_uid := coalesce(v_old_json->>'user_id', v_old_json->>'id', '*');
  ELSE
    v_new_json := to_jsonb(NEW);
    v_uid := coalesce(v_new_json->>'user_id', v_new_json->>'id', '*');
    IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'users' THEN
      v_old_json := to_jsonb(OLD);
      IF (v_new_json - 'last_seen' - 'updated_at' - 'fcm_updated_at') = (v_old_json - 'last_seen' - 'updated_at' - 'fcm_updated_at') THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  v_tag := CASE
    WHEN v_uid IS NULL OR v_uid = '*' OR length(v_uid) < 8 THEN '*'
    ELSE left(v_uid, 4) || '_' || right(v_uid, 4)
  END;

  DELETE FROM public.live_join_events WHERE created_at < now() - interval '10 minutes';
  INSERT INTO public.live_join_events(match_id, filled_slots, event)
  VALUES ('pulse:' || TG_TABLE_NAME, NULL, v_tag);

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DROP TRIGGER IF EXISTS trg_universal_pulse_matches ON public.matches;
CREATE TRIGGER trg_universal_pulse_matches
  AFTER INSERT OR UPDATE OR DELETE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.fn_emit_universal_pulse();

DROP POLICY IF EXISTS notif_insert ON public.notifications;
CREATE POLICY notif_insert ON public.notifications
  FOR INSERT
  WITH CHECK (
    (auth.jwt() ->> 'sub') IS NOT NULL
    AND COALESCE(target_all, false) = false
    AND (auth.jwt() ->> 'sub') IN (
      SELECT users.id FROM public.users WHERE COALESCE(users.is_banned, false) = false
    )
    AND (
      user_id = (auth.jwt() ->> 'sub')
      OR type = ANY (ARRAY[
        'clan_cosmetic'::text,
        'clan_war_challenge'::text,
        'duel_accepted'::text,
        'duel_challenge'::text,
        'friend_add'::text,
        'gift_ticket'::text,
        'mentor_accepted'::text,
        'mentor_request'::text,
        'mentor_reward'::text,
        'premium'::text,
        'premium_request'::text,
        'squad_request'::text,
        'team_formed'::text
      ])
    )
  );
