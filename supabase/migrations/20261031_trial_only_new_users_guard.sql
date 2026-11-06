-- ═══════════════════════════════════════════════════════════════════════
-- TRIAL SIRF NAYE USERS KE LIYE — server-authoritative guard
-- (2026-10-31, owner live report — Hunter7 diag run 41129725938)
--
-- Live facts: Hunter7 = expired Diamond (premium_level=3,
-- premium_expires=2026-10-15, trial_used=false). start_free_trial() sirf
-- trial_used dekhta hai → expired ex-premium user trial le sakta tha:
--   premium_expires = GREATEST(now)+3d  ⇒ expire ho chuke Diamond ko
--   3 din ka FREE Diamond extension (abuse path), aur client par
--   "Silver trial" ka jhoota prompt.
--
-- Guard: BEFORE UPDATE trigger — agar trial_used false→true flip ho raha
-- hai aur OLD row me premium_level > 0 tha (kabhi premium liya ja chuka,
-- chahe expire ho gaya ho) → RAISE (RPC error → client toast).
-- Function signature/security ko chhuta hi nahi jata (CREATE OR REPLACE
-- FUNCTION start_free_trial ki zaroorat nahi). Idempotent.
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.guard_trial_only_for_new_users()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (NEW.trial_used IS DISTINCT FROM OLD.trial_used)
     AND NEW.trial_used = true
     AND COALESCE(OLD.premium_level, 0) > 0 THEN
    RAISE EXCEPTION 'Trial sirf naye users ke liye hai — premium pehle se liya ja chuka hai (renew karo)';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trial_only_new_users ON public.users;
CREATE TRIGGER trg_trial_only_new_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_trial_only_for_new_users();
