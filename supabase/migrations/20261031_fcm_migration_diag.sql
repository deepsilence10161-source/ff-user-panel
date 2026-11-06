/* ══════════════════════════════════════════════════════════════════════
   FCM MIGRATION DIAG (2026-10-31) — READ-ONLY
   OneSignal → Firebase FCM migration se pehle live DB ka exact state:
     1. notifications_push_hook() ki ASLI definition (repo me nahi hai —
        purani migration live DB me applied thi)
     2. notifications table ke triggers + columns
     3. users.fcm_token / fcm_updated_at columns (core/firebase.js inhe
        update karta hai — exist karte hain ya silently fail?)
     4. kitne users ke web-FCM tokens pehle se stored hain
     5. net._http_response — push-send ke haal ke asli response codes
        (batayega Supabase secrets me ONESIGNAL_* abhi bhi hain ya nahi:
        500 "env missing" = secrets gayab, 403 = secret mismatch,
        200 = OneSignal abhi live kaam kar raha)
     6. send_due_match_reminders definition (doosra push caller)
     7. cron.job list
   Sirf SELECT — koi DDL/DML nahi.
   ══════════════════════════════════════════════════════════════════════ */
SELECT json_build_object(
  'hook_def', (SELECT pg_get_functiondef(p.oid)
                 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'notifications_push_hook'
                LIMIT 1),
  'triggers', (SELECT json_agg(json_build_object('tgname', t.tgname, 'enabled', t.tgenabled))
                 FROM pg_trigger t
                WHERE t.tgrelid = 'public.notifications'::regclass AND NOT t.tgisinternal),
  'notif_cols', (SELECT json_agg(column_name || ':' || data_type)
                   FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'notifications'),
  'users_fcm_cols', (SELECT json_agg(column_name)
                       FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = 'users'
                        AND column_name LIKE 'fcm%'),
  'fcm_token_user_count', (SELECT count(*) FROM public.users
                            WHERE fcm_token IS NOT NULL AND fcm_token <> ''),
  'push_tokens_table_exists', (SELECT to_regclass('public.user_push_tokens')::text),
  'net_last8', (SELECT json_agg(json_build_object('id', x.id, 'status', x.status_code,
                                                  'body', left(x.content::text, 180)))
                  FROM (SELECT id, status_code, content
                          FROM net._http_response ORDER BY id DESC LIMIT 8) x),
  'match_reminders_def', (SELECT left(pg_get_functiondef(p.oid), 2500)
                            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                           WHERE n.nspname = 'public' AND p.proname = 'send_due_match_reminders'
                           LIMIT 1),
  'cron_jobs', (SELECT json_agg(json_build_object('name', jobname, 'schedule', schedule,
                                                  'active', active))
                  FROM cron.job),
  'notif_recent3d', (SELECT count(*) FROM public.notifications
                      WHERE created_at > now() - interval '3 days')
) AS diag;
