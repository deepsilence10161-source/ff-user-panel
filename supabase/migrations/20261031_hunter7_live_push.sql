/* ══════════════════════════════════════════════════════════════════
   Hunter7 LIVE PUSH (owner order, 2026-10-31):
   "Hunter7 user ko notification bhej kuch bhi, me us account se login hu"
   ──────────────────────────────────────────────────────────────────
   1) read-only diag: Hunter7 row, uske FCM device tokens, hook config,
      net._http_response baseline.
   2) notifications INSERT (wahi columns jo push-e2e fcm7 driver me
      proven hain) → trg_notifications_push → notifications_push_hook v2
      → pg_net → push-send edge fn:
        - FCM tokens maujood → via=fcm (HTTP v1)
        - tokens khali → OneSignal fallback (uid par, transition)
   3) push-send ka live response agle diag run me padha jayega
      (net_baseline se aage ki net._http_response rows) — kyunki
      Management-API ka yeh script ek transaction me chalta hai aur
      pg_net worker request tab hi dekhta hai jab yeh COMMIT ho.
   ══════════════════════════════════════════════════════════════════ */

-- 1) Hunter7 ki user row (uid = users.id = notifications.user_id)
SELECT 'hunter7_row' AS k, json_build_object(
         'id', id, 'ign', ign,
         'premium_level', premium_level, 'premium_expires', premium_expires
       )::text AS v
FROM users WHERE lower(ign) = 'hunter7';

-- 2) Uske device FCM tokens (hook ≤10 fresh-45d chunta hai)
SELECT 'hunter7_tokens' AS k, json_build_object(
         'total', count(*),
         'fresh45', count(*) FILTER (WHERE updated_at > now() - interval '45 days'),
         'platforms', coalesce(jsonb_agg(DISTINCT platform)
                        FILTER (WHERE updated_at > now() - interval '45 days'),
                        '[]'::jsonb),
         'newest_update', max(updated_at)
       )::text AS v
FROM user_push_tokens
WHERE user_id = (SELECT id FROM users WHERE lower(ign) = 'hunter7' LIMIT 1);

-- 3) Hook gate (enabled + url + secret set?)
SELECT 'hook_cfg' AS k, json_build_object(
         'enabled', enabled,
         'url_set', hook_url IS NOT NULL,
         'secret_set', hook_secret IS NOT NULL
       )::text AS v
FROM push_hook_config WHERE id = 1;

-- 4) net._http_response baseline — result-run me id > baseline padhenge
SELECT 'net_baseline' AS k, coalesce(max(id), 0)::text AS v FROM net._http_response;

-- 5) INSERT — proven fcm7 pattern (user_id, type, title, body, ref_id)
INSERT INTO public.notifications (user_id, type, title, body, ref_id)
SELECT id, 'owner_push',
       '🎮 Mini eSports — Live Test',
       'Hunter7 — यह push नए Firebase FCM सिस्टम से भेजी गई है (OneSignal → FCM migration पूर्ण ✅)। आपका account लाइव टेस्ट में पास हुआ! — Team Mini eSports',
       'hunter7-live-20261031'
FROM users WHERE lower(ign) = 'hunter7' LIMIT 1;

-- 6) Insert-landed proof (apna INSERT same transaction me dikhta hai)
SELECT 'inserted' AS k, json_build_object(
         'notif_id', id, 'user_id', user_id, 'title', title, 'created_at', created_at
       )::text AS v
FROM notifications WHERE ref_id = 'hunter7-live-20261031';
