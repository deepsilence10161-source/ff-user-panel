/* ══════════════════════════════════════════════════════════════════
   Hunter7 PUSH RETRY (owner: "Hm kar diya" — APK update + Hunter7
   login ho gaya, 2026-10-31 ~03:0x UTC).
   Pehla attempt (run 41161989044): tokens=0 → OneSignal fallback →
   invalid_aliases (0 recipients). Ab naya APK FCM token sync karta
   hai app-open/login par.
   Yeh script: token fresh45 me MEHMOOD ho tabhi INSERT (DO-guard,
   warna koi waste notification row nahi). push-send ka live response
   agle result-run me padha jayega (net_baseline se aage).
   ══════════════════════════════════════════════════════════════════ */

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_push_tokens
              WHERE user_id = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3'
                AND updated_at > now() - interval '45 days') THEN
    INSERT INTO public.notifications (user_id, type, title, body, ref_id)
    VALUES ('TyHtzFOnggMxWbEdTnTdEl2j7oF3', 'owner_push',
            '🎮 Mini eSports — FCM Live',
            'Hunter7 — यह push आपके device पर नए Firebase FCM सिस्टम से आई है ✅ (OneSignal→FCM migration live proof) — Team Mini eSports',
            'hunter7-live-20261031b');
  END IF;
END $$;

SELECT 'hunter7_retry_state' AS k, json_build_object(
  'tokens', (SELECT jsonb_build_object(
               'total', count(*),
               'fresh45', count(*) FILTER (WHERE updated_at > now() - interval '45 days'),
               'platforms', coalesce(jsonb_agg(DISTINCT platform), '[]'::jsonb),
               'newest_update', max(updated_at),
               'token_tails', coalesce(jsonb_agg(right(token, 6)), '[]'::jsonb))
             FROM user_push_tokens
             WHERE user_id = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3'),
  'inserted', (SELECT jsonb_build_object('id', id, 'title', title, 'created_at', created_at)
               FROM notifications WHERE ref_id = 'hunter7-live-20261031b' LIMIT 1),
  'net_baseline', (SELECT coalesce(max(id), 0) FROM net._http_response)
)::text AS v;
