-- ═══════════════════════════════════════════════════════════════
-- 20261029_apk_cleanup_client_read.sql
-- SAFE-CLEANER v5 ka server-gate (features/device-cleanup.js) client
-- se app_settings.key='apk_cleanup' padhta hai, lekin repo me is
-- table ke liye koi RLS SELECT policy committed NAHI thi — live DB
-- par policy na hone par postgrest silently null deta hai aur gate
-- fail-safe return kar jata hai (verdict "unknown" → post-update
-- auto-delete KABHI nahi chalta). Emulator E2E (2026-10-29) me yahi
-- dekha gaya: logged-in QA user par bhi "Cleanup ALLOWED" line nahi.
--
-- FIX (minimum scope): sirf 'apk_cleanup' key ke liye anon +
-- authenticated ko READ. Value me koi secret nahi (policy JSON:
-- enabled/mode/exempt lists) — wahi jo admin Studio me edit karta
-- hai. Baaki keys ka behaviour bilkul unchanged.
-- Idempotent: policy pehle se ho to dobara create nahi hoti.
-- ═══════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'app_settings'
      AND policyname = 'apk_cleanup_client_read'
  ) THEN
    CREATE POLICY apk_cleanup_client_read
      ON public.app_settings
      FOR SELECT
      TO anon, authenticated
      USING (key = 'apk_cleanup');
    RAISE NOTICE 'policy apk_cleanup_client_read created';
  ELSE
    RAISE NOTICE 'policy apk_cleanup_client_read already exists';
  END IF;
END $$;
