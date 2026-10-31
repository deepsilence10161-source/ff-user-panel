-- ════════════════════════════════════════════════════════════════════
-- 20261031_fcm_token_grants_fix.sql  (push-e2e fcm5 ki seekh)
-- ────────────────────────────────────────────────────────────────────
-- PUSH03 fail hua tha: push-token edge fn (service_role) ka upsert →
-- HTTP 500 "upsert fail". Schema sahi hai (token UNIQUE, CHECK ok) —
-- android_seed.mjs wahi ON CONFLICT postgres-role se karke PASS hota
-- raha. Matlab: service_role ko TABLE/SEQUENCE grants nahi mile
-- (purana project — default privileges absent; REVOKE ALL FROM PUBLIC
-- ne bhi kuch nahi diya). Edge fns PostgREST me service_role JWT se
-- authenticator → SET ROLE service_role hote hain: grant ke bina
-- INSERT permission-denied.
--
-- FIX: explicit GRANT (table + bigserial sequence) SIRF service_role
-- ko (anon/authenticated LOCKED hi rahenge — RLS + REVOKE as-is).
-- PROOF: SET LOCAL ROLE service_role se asli upsert (ROLLBACK — zero
-- residue) + has_*_privilege snapshot.
-- ════════════════════════════════════════════════════════════════════

-- ── 1) PEHLE ka state (record) ──
SELECT json_build_object(
  'phase', 'before',
  'tbl_ins', has_table_privilege('service_role','public.user_push_tokens','INSERT'),
  'tbl_sel', has_table_privilege('service_role','public.user_push_tokens','SELECT'),
  'tbl_del', has_table_privilege('service_role','public.user_push_tokens','DELETE'),
  'seq_use', has_sequence_privilege('service_role','public.user_push_tokens_id_seq','USAGE')
) AS before_state;

-- ── 2) GRANT fix ──
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_push_tokens TO service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.user_push_tokens_id_seq TO service_role;

-- ── 3) PROOF: service_role bankar asli upsert (rollback — residue 0) ──
BEGIN;
SET LOCAL ROLE service_role;
INSERT INTO public.user_push_tokens (user_id, platform, token)
VALUES ('diag-grant-fix', 'web', 'DIAGTESTTOKEN_abcdefghijklmnopqrstuvwxyz_0123456789')
ON CONFLICT (token) DO UPDATE
  SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = now()
RETURNING id, user_id, platform;
ROLLBACK;

-- ── 4) BAAD ka state + safety checks ──
SELECT json_build_object(
  'phase', 'after',
  'tbl_ins', has_table_privilege('service_role','public.user_push_tokens','INSERT'),
  'tbl_sel', has_table_privilege('service_role','public.user_push_tokens','SELECT'),
  'tbl_del', has_table_privilege('service_role','public.user_push_tokens','DELETE'),
  'seq_use', has_sequence_privilege('service_role','public.user_push_tokens_id_seq','USAGE'),
  'anon_ins_MUST_be_false',  has_table_privilege('anon','public.user_push_tokens','INSERT'),
  'auth_ins_MUST_be_false',  has_table_privilege('authenticated','public.user_push_tokens','INSERT'),
  'rls_enabled', (SELECT relrowsecurity FROM pg_class WHERE oid='public.user_push_tokens'::regclass),
  'residue_rows_MUST_be_0', (SELECT count(*) FROM public.user_push_tokens WHERE user_id='diag-grant-fix')
) AS after_state;
