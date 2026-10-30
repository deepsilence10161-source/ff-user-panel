-- ═══════════════════════════════════════════════════════════════════════════
-- 20261030_premium_system_e2e_hardening.sql
-- PREMIUM-E2E (owner directive: "Premium system check kar perfectly") se pehle
-- schema hygiene — poora idempotent (jo pehle se hai us par no-op):
--
-- (A) premium_requests.utr — B16 (2026-10-06) se user panel ka premium buy
--     submit { user_id, user_name, tier, price, screenshot_url, UTR, status }
--     insert karta hai, admin panel ka review queue UTR column dikhata/edit
--     karta hai, aur supabase-rtdb-bridge premiumReqToSupa/FromSupa dono utr
--     map karte hain — LEKIN COMPLETE_SCHEMA.sql record me utr column ka koi
--     ALTER kahin nahi hai (sirf plan_type/bundle_id/approved_at/rejected_at/
--     approved_by). Agar live table me column missing hua to PostgREST
--     "Could not find column 'utr'" se POORA premium purchase flow toot'ta
--     hai. IF NOT EXISTS se guarantee: column hamesha maujood.
--
-- (B) trial_used — start_free_trial() NULL par 'User not found' return karta
--     hai; column DEFAULT false documented hai, phir bhi explicit ensure.
--
-- (C) User-facing premium RPC grants — R8 hardening sweep (2026-09-26d) ne
--     dastaavez ke mutabik kai user-facing RPCs se `authenticated` EXECUTE
--     revoke kar diya tha (final state: sirf anon+service_role). Login-shuda
--     user ka JWT role `authenticated` hota hai — us role ke bina:
--       * start_free_trial()            → FREE TRIAL kabhi shuru nahi
--       * claim_premium_monthly_bonus() → MONTHLY COINS BONUS kabhi nahi
--     Dono functions ANDAR se self-only guarded hain (trial_used row-lock;
--     premium_level==p_tier check + UNIQUE(user_id, month_key)), isliye
--     authenticated grant safe hai. Admin-only RPCs (approve_premium,
--     cancel_premium) JAAN-BOOJH kar service_role-only rehne diye gaye hain
--     (admin panel unhe admin-gateway Edge Function se call karta hai) —
--     yahan unke grants chhede nahi gaye.
--     Signature-drift-safe: DO-block pg_proc se actual signature uthata hai.
--
-- Apply: supabase-sql workflow (Management API), run log + git history me
-- auditable. Verification: premium-e2e workflow (PRE00 introspection +
-- PRE03–PRE23 behavioral proofs).
-- ═══════════════════════════════════════════════════════════════════════════

-- (A) premium_requests: B16/admin-queue ke saare expected columns
ALTER TABLE public.premium_requests ADD COLUMN IF NOT EXISTS utr          TEXT;
ALTER TABLE public.premium_requests ADD COLUMN IF NOT EXISTS plan_type    TEXT DEFAULT 'monthly';
ALTER TABLE public.premium_requests ADD COLUMN IF NOT EXISTS bundle_id    TEXT;
ALTER TABLE public.premium_requests ADD COLUMN IF NOT EXISTS approved_at  TIMESTAMPTZ;
ALTER TABLE public.premium_requests ADD COLUMN IF NOT EXISTS rejected_at  TIMESTAMPTZ;
ALTER TABLE public.premium_requests ADD COLUMN IF NOT EXISTS approved_by  TEXT;

-- (B) users.trial_used — server-authoritative trial gate ka flag
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT false;
UPDATE public.users SET trial_used = false WHERE trial_used IS NULL;

-- (C) user-facing premium RPCs → authenticated (+ service_role) EXECUTE.
--     Admin-only approve_premium/cancel_premium ko YAHAN JAAN-BOOJH KAR
--     authenticated nahi diya (wo admin-gateway/service_role path se chalte
--     hain — R8 FINAL posture wahi hai).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('start_free_trial', 'claim_premium_monthly_bonus')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.fn);
    RAISE NOTICE 'premium-rpc grant: % → authenticated, service_role', r.fn;
  END LOOP;
END $$;
