/* ══════════════════════════════════════════════════════════════════════
   FCM PUSH MIGRATION (2026-10-31) — OneSignal → Firebase FCM (direct)
   ─────────────────────────────────────────────────────────────────────
   KYU: OneSignal ne free plan me mobile push 1,000 MAU par cap kar diya
   (existing accounts par 1-Oct-2026 se LIVE). FCM direct = $0 + unlimited
   (Spark/Blaze dono), Firebase project (fft-app-1e283) stack me pehle se
   hai, aur Android delivery OneSignal bhi FCM se hi karta tha — capability
   loss zero. (Research: reports/push-tools-comparison-2026-10-31.html)

   KYA:
     1. user_push_tokens — device FCM tokens ki EK-MATRA table.
        user_id = firebase uid (= users.id = notifications.user_id, TEXT).
        Write path SIRF push-token edge fn (service_role, Firebase-idToken
        verified). RLS ON + koi anon/authenticated policy NAHI + REVOKE —
        client direct table touch nahi kar sakta.
        Read path: notifications_push_hook (SECURITY DEFINER, owner-postgres)
        aur push-send edge fn (service_role, dead-token pruning).
     2. notifications_push_hook() v2 — wahi push_hook_config gate, wahi
        headers/URL; body me ab 'tokens' array bhi (≤10 fresh tokens).
        'uid' bhi bheja jata rahega — transition me OneSignal fallback
        (purane APK users bina FCM token) ke liye.
     3. prune_stale_push_tokens() + daily cron — 60 din purane tokens out
        (live pruning push-send me UNREGISTERED/404 par hoti hai).

   COMPAT: purana users.fcm_token column untouched (0 rows tha — dead path
   tha; core/firebase.js backward-compat ke liye usse bhi bharta rahega).
   ══════════════════════════════════════════════════════════════════════ */

-- ── 1) TOKEN TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id         bigserial PRIMARY KEY,
  user_id    text NOT NULL,
  platform   text NOT NULL CHECK (platform IN ('android','web')),
  token      text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_push_tokens_user_idx
  ON public.user_push_tokens (user_id, updated_at DESC);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

/* Table poori tarah LOCKED: sirf service_role (edge fns) aur owner
   (SECURITY DEFINER hook) pahunch sakte hain. FORCE RLS jaan-boojh kar
   NAHI — warna owner-postgres hook bhi block ho jata. */
REVOKE ALL ON public.user_push_tokens FROM PUBLIC, anon, authenticated;

-- ── 2) updated_at TOUCH TRIGGER ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_user_push_tokens()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_user_push_tokens_touch ON public.user_push_tokens;
CREATE TRIGGER trg_user_push_tokens_touch
  BEFORE UPDATE ON public.user_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_push_tokens();

-- ── 3) HOOK v2 (FCM tokens ke saath; config/gate/headers IDENTICAL) ───
CREATE OR REPLACE FUNCTION public.notifications_push_hook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_url TEXT; v_sec TEXT; v_key TEXT; v_tokens JSONB;
BEGIN
  IF NEW.user_id IS NULL OR COALESCE(NEW.target_all, false) THEN RETURN NEW; END IF;
  SELECT hook_url, hook_secret, gateway_apikey INTO v_url, v_sec, v_key
    FROM push_hook_config WHERE id = 1 AND enabled;
  IF v_url IS NULL THEN RETURN NEW; END IF;
  /* FCM (2026-10-31): user ke fresh device tokens (≤10, 45 din) body me —
     push-send inhe FCM HTTP v1 se bhejta hai. Tokens khali hue to push-send
     'uid' par OneSignal fallback try karta hai (purane APK transition). */
  SELECT COALESCE(jsonb_agg(t.token), '[]'::jsonb) INTO v_tokens
    FROM (SELECT token FROM public.user_push_tokens
           WHERE user_id = NEW.user_id
             AND updated_at > now() - interval '45 days'
           ORDER BY updated_at DESC
           LIMIT 10) t;
  BEGIN
    PERFORM net.http_post(
      url := v_url,
      body := jsonb_build_object('uid', NEW.user_id, 'title', NEW.title,
                                 'body', NEW.body, 'tokens', v_tokens),
      headers := jsonb_build_object('Content-Type','application/json',
                                    'x-push-secret', v_sec,
                                    'apikey', v_key,
                                    'Authorization', 'Bearer '||v_key)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- push best-effort; notification table row already saved
  END;
  RETURN NEW;
END $function$;

-- ── 4) STALE TOKEN PRUNE + DAILY CRON ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.prune_stale_push_tokens()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_n integer;
BEGIN
  DELETE FROM public.user_push_tokens
   WHERE updated_at < now() - interval '60 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('fcm-token-prune')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'fcm-token-prune');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule('fcm-token-prune', '15 4 * * *',
                     $cron$select public.prune_stale_push_tokens();$cron$);
