-- ════════════════════════════════════════════════════════════════════
-- 20261031_fcm_token_grants_fix.sql  v2 (push-e2e fcm5 ki seekh)
-- ────────────────────────────────────────────────────────────────────
-- PUSH03 fail: push-token edge fn (service_role) upsert → HTTP 500.
-- Schema sahi (token UNIQUE, CHECK ok) — android_seed postgres-role se
-- PASS. Matlab service_role ko table/sequence GRANT missing (purana
-- project, default privileges absent).
--
-- v1 mistake: BEGIN…ROLLBACK proof-block ne Management-API ke outer
-- transaction me GRANTs bhi ROLLBACK kar diye (after_state=false aaya).
-- v2: koi transaction game nahi — GRANT → SET ROLE proof INSERT →
-- RESET ROLE → explicit DELETE (zero residue).
-- ════════════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_push_tokens TO service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.user_push_tokens_id_seq TO service_role;

-- ── PROOF: service_role bankar asli upsert (PostgREST wala hi raasta) ──
SET ROLE service_role;
INSERT INTO public.user_push_tokens (user_id, platform, token)
VALUES ('diag-grant-fix', 'web', 'DIAGTESTTOKEN_abcdefghijklmnopqrstuvwxyz_0123456789')
ON CONFLICT (token) DO UPDATE
  SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = now();
RESET ROLE;

-- ── cleanup (residue 0) ──
DELETE FROM public.user_push_tokens WHERE user_id = 'diag-grant-fix';

-- ── final state (yahi print hoga) ──
SELECT json_build_object(
  'phase', 'after-v2',
  'tbl_ins', has_table_privilege('service_role','public.user_push_tokens','INSERT'),
  'tbl_sel', has_table_privilege('service_role','public.user_push_tokens','SELECT'),
  'tbl_upd', has_table_privilege('service_role','public.user_push_tokens','UPDATE'),
  'tbl_del', has_table_privilege('service_role','public.user_push_tokens','DELETE'),
  'seq_use', has_sequence_privilege('service_role','public.user_push_tokens_id_seq','USAGE'),
  'anon_ins_MUST_be_false',  has_table_privilege('anon','public.user_push_tokens','INSERT'),
  'auth_ins_MUST_be_false',  has_table_privilege('authenticated','public.user_push_tokens','INSERT'),
  'rls_enabled', (SELECT relrowsecurity FROM pg_class WHERE oid='public.user_push_tokens'::regclass),
  'residue_rows_MUST_be_0', (SELECT count(*) FROM public.user_push_tokens WHERE user_id='diag-grant-fix')
) AS after_state;
