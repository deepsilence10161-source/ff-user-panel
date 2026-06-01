-- ================================================================
-- MINI ESPORTS — Supabase SQL Setup (FINAL v2 — All Bugs Fixed)
-- Run this COMPLETELY in Supabase Dashboard > SQL Editor
-- ================================================================

-- ── 1. increment_balance RPC (Bug 16 Fix: reject negative amounts) ──
CREATE OR REPLACE FUNCTION increment_balance(
  p_uid    UUID,
  p_col    TEXT,
  p_amount NUMERIC
) RETURNS void AS $$
DECLARE
  allowed_cols TEXT[] := ARRAY[
    'coins','green_diamonds','sky_diamonds',
    'total_wins','total_kills','total_matches','rank_points',
    'win_streak','clean_matches','filled_slots'
  ];
BEGIN
  -- Bug 16 Fix: Reject negative amounts
  IF p_amount < 0 THEN
    RAISE EXCEPTION 'Amount must be non-negative, got: %', p_amount;
  END IF;
  IF NOT (p_col = ANY(allowed_cols)) THEN
    RAISE EXCEPTION 'Column % not allowed', p_col;
  END IF;
  EXECUTE format(
    'UPDATE users SET %I = COALESCE(%I, 0) + $1 WHERE id = $2',
    p_col, p_col
  ) USING p_amount, p_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. decrement_balance RPC (Bug 32 Fix: returns JSONB status) ──
CREATE OR REPLACE FUNCTION decrement_balance(
  p_uid    UUID,
  p_col    TEXT,
  p_amount NUMERIC
) RETURNS JSONB AS $$
DECLARE
  allowed_cols TEXT[] := ARRAY['coins','green_diamonds','sky_diamonds'];
  v_balance    NUMERIC;
BEGIN
  IF p_amount < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be non-negative');
  END IF;
  IF NOT (p_col = ANY(allowed_cols)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Column not allowed: ' || p_col);
  END IF;
  EXECUTE format('SELECT COALESCE(%I, 0) FROM users WHERE id = $1', p_col)
    USING p_uid INTO v_balance;
  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance',
      'balance', v_balance, 'required', p_amount);
  END IF;
  EXECUTE format(
    'UPDATE users SET %I = GREATEST(COALESCE(%I, 0) - $1, 0) WHERE id = $2',
    p_col, p_col
  ) USING p_amount, p_uid;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. increment_city_score RPC (Bug 7 Fix: no negative scores) ──
CREATE OR REPLACE FUNCTION increment_city_score(
  p_city   TEXT,
  p_month  TEXT,
  p_score  INT DEFAULT 0,
  p_wins   INT DEFAULT 0,
  p_kills  INT DEFAULT 0
) RETURNS void AS $$
BEGIN
  -- Bug 7 Fix: Validate non-negative values
  IF p_score < 0 OR p_wins < 0 OR p_kills < 0 THEN
    RAISE EXCEPTION 'Score/wins/kills must be non-negative';
  END IF;
  INSERT INTO city_championship (city, month, score, wins, kills, player_count)
  VALUES (p_city, p_month, p_score, p_wins, p_kills, 1)
  ON CONFLICT (city, month) DO UPDATE SET
    score        = city_championship.score  + EXCLUDED.score,
    wins         = city_championship.wins   + EXCLUDED.wins,
    kills        = city_championship.kills  + EXCLUDED.kills,
    player_count = city_championship.player_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 4. increment_rank_points RPC ──
CREATE OR REPLACE FUNCTION increment_rank_points(
  p_uid    UUID,
  p_points INT
) RETURNS void AS $$
BEGIN
  IF p_points < 0 THEN
    RAISE EXCEPTION 'Points must be non-negative';
  END IF;
  UPDATE users SET rank_points = COALESCE(rank_points, 0) + p_points WHERE id = p_uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. validate_and_join_match (Bug 2 Fix: explicit transaction + Bug 13 Fix: max slots) ──
CREATE OR REPLACE FUNCTION validate_and_join_match(
  p_uid       UUID,
  p_match_id  TEXT,
  p_entry_fee NUMERIC,
  p_currency  TEXT,
  p_join_data JSONB
) RETURNS JSONB AS $$
DECLARE
  v_balance      NUMERIC;
  v_joined       BOOLEAN := false;
  v_jr_id        UUID;
  v_max_slots    INT;
  v_filled_slots INT;
BEGIN
  -- Bug 2 Fix: Explicit transaction (PL/pgSQL functions run in a transaction by default,
  -- but we use RAISE EXCEPTION to rollback on any failure)

  -- 1. Lock user row and check balance
  IF p_currency = 'coins' THEN
    SELECT coins INTO v_balance FROM users WHERE id = p_uid FOR UPDATE;
  ELSE
    SELECT sky_diamonds INTO v_balance FROM users WHERE id = p_uid FOR UPDATE;
  END IF;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  IF p_entry_fee > 0 AND v_balance < p_entry_fee THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  -- 2. Check duplicate join
  SELECT EXISTS(
    SELECT 1 FROM join_requests
    WHERE user_id = p_uid AND match_id = p_match_id
    AND status NOT IN ('cancelled','refunded')
  ) INTO v_joined;

  IF v_joined THEN
    RAISE EXCEPTION 'ALREADY_JOINED';
  END IF;

  -- 3. Bug 13 Fix: Check max slots
  SELECT
    COALESCE((data->>'maxSlots')::int, (data->>'totalSlots')::int, 999),
    COALESCE((data->>'filledSlots')::int, 0)
  INTO v_max_slots, v_filled_slots
  FROM matches WHERE id = p_match_id;

  IF v_max_slots IS NOT NULL AND v_filled_slots >= v_max_slots THEN
    RAISE EXCEPTION 'MATCH_FULL';
  END IF;

  -- 4. Deduct balance atomically
  IF p_entry_fee > 0 THEN
    IF p_currency = 'coins' THEN
      UPDATE users SET coins = coins - p_entry_fee WHERE id = p_uid;
    ELSE
      UPDATE users SET sky_diamonds = sky_diamonds - p_entry_fee WHERE id = p_uid;
    END IF;

    INSERT INTO wallet_transactions(user_id, currency, txn_type, amount, reason, ref_id)
    VALUES(p_uid, p_currency, 'debit', p_entry_fee, 'match_entry', p_match_id);
  END IF;

  -- 5. Create join request
  INSERT INTO join_requests(user_id, match_id, entry_fee, entry_type, status, created_at)
  VALUES(
    p_uid, p_match_id, p_entry_fee,
    CASE WHEN p_currency='coins' THEN 'coin' ELSE 'sky' END,
    'pending', NOW()
  ) RETURNING id INTO v_jr_id;

  -- 6. Increment filled slots
  UPDATE matches SET
    data = jsonb_set(
      COALESCE(data, '{}'::jsonb), '{filledSlots}',
      to_jsonb(COALESCE((data->>'filledSlots')::int, 0) + 1)
    )
  WHERE id = p_match_id;

  RETURN jsonb_build_object('ok', true, 'jr_id', v_jr_id::text);

EXCEPTION
  WHEN OTHERS THEN
    -- All changes rolled back automatically
    RETURN jsonb_build_object('ok', false, 'error',
      CASE SQLERRM
        WHEN 'USER_NOT_FOUND'       THEN 'User not found'
        WHEN 'INSUFFICIENT_BALANCE' THEN 'Balance kam hai'
        WHEN 'ALREADY_JOINED'       THEN 'Aap already join ho chuke ho'
        WHEN 'MATCH_FULL'           THEN 'Match full ho gaya'
        ELSE SQLERRM
      END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── Grant permissions ──
GRANT EXECUTE ON FUNCTION increment_balance(UUID, TEXT, NUMERIC) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION decrement_balance(UUID, TEXT, NUMERIC) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_city_score(TEXT, TEXT, INT, INT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_rank_points(UUID, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_and_join_match(UUID,TEXT,NUMERIC,TEXT,JSONB) TO anon, authenticated;

-- ── Schema additions ──
ALTER TABLE sd_requests ADD COLUMN IF NOT EXISTS img_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS win_streak INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS clean_matches INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_clean_badge BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_level INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rank_points INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_granted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fraud_score INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_policy BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_policy_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT;

CREATE INDEX IF NOT EXISTS idx_sd_requests_img_hash ON sd_requests(img_hash);
CREATE INDEX IF NOT EXISTS idx_sd_requests_upi_ref  ON sd_requests(upi_ref);
CREATE INDEX IF NOT EXISTS idx_join_requests_match_user ON join_requests(match_id, user_id);
CREATE INDEX IF NOT EXISTS idx_users_is_vip ON users(is_vip) WHERE is_vip = true;

-- ── Bug 36 Fix: Clan leader auto-reassign trigger ──
CREATE OR REPLACE FUNCTION reassign_clan_leader()
RETURNS TRIGGER AS $$
DECLARE
  v_clan_id   UUID;
  v_new_leader UUID;
BEGIN
  -- Find clans where this user is leader
  FOR v_clan_id IN
    SELECT id FROM clans WHERE leader_uid = OLD.id
  LOOP
    -- Find oldest co-leader or member
    SELECT user_id INTO v_new_leader
    FROM clan_members
    WHERE clan_id = v_clan_id AND user_id != OLD.id
    ORDER BY joined_at ASC LIMIT 1;

    IF v_new_leader IS NOT NULL THEN
      UPDATE clans SET leader_uid = v_new_leader WHERE id = v_clan_id;
    ELSE
      -- No members left — disband clan
      UPDATE clans SET status = 'disbanded', disbanded_at = NOW() WHERE id = v_clan_id;
    END IF;
  END LOOP;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reassign_clan_leader ON users;
CREATE TRIGGER trg_reassign_clan_leader
  BEFORE DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION reassign_clan_leader();
