/* ══════════════════════════════════════════════════════════════════
   LIMITS AUDIT (owner directive 16, 2026-10-31): "sabhi tools ki
   limits check kar — unlimited, free, higher accuracy, kuch miss na ho"
   READ-ONLY measurement: Supabase free-tier headroom ka live data —
   DB size vs 500MB cap, sabse badi tables, FCM adoption (OneSignal
   fallback removal ka decision isi se), row counts, cron jobs,
   legacy OneSignal columns, users-activity columns ka probe.
   Tool sirf LAST SELECT print karta hai → sab ek consolidated jsonb.
   ══════════════════════════════════════════════════════════════════ */

SELECT 'limits_audit' AS k, json_build_object(
  'db_size_mb', round(pg_database_size(current_database()) / 1048576.0, 2),
  'db_cap_mb', 500,
  'top_tables_mb', (
    SELECT jsonb_object_agg(relname, mb)
    FROM (SELECT c.relname, round(pg_total_relation_size(c.oid)/1048576.0, 3) AS mb
            FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname IN ('public','net') AND c.relkind = 'r'
           ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 12) t),
  'users_total', (SELECT count(*) FROM users),
  'fcm_users_distinct', (SELECT count(DISTINCT user_id) FROM user_push_tokens),
  'fcm_tokens_total', (SELECT count(*) FROM user_push_tokens),
  'fcm_tokens_by_platform', (
    SELECT coalesce(jsonb_object_agg(platform, n), '{}'::jsonb)
    FROM (SELECT platform, count(*) n FROM user_push_tokens GROUP BY platform) p),
  'notifications_rows', (SELECT count(*) FROM notifications),
  'net_response_rows', (SELECT count(*) FROM net._http_response),
  'support_tickets', (SELECT count(*) FROM support_tickets),
  'support_messages', (SELECT count(*) FROM support_messages),
  'matches_rows', (SELECT count(*) FROM matches),
  'wallet_txn_rows', (SELECT to_jsonb(count(*)) FROM wallet_transactions),
  'cron_jobs', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'job', jobname, 'schedule', schedule, 'active', active)), '[]'::jsonb)
    FROM cron.job),
  'legacy_push_cols', (
    SELECT coalesce(jsonb_agg(table_name || '.' || column_name), '[]'::jsonb)
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (column_name ILIKE '%onesignal%' OR column_name ILIKE '%player_id%'
           OR column_name ILIKE '%fcm%' OR column_name ILIKE '%push_id%')),
  'users_activity_cols', (
    SELECT coalesce(jsonb_agg(column_name), '[]'::jsonb)
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
      AND (column_name ILIKE '%login%' OR column_name ILIKE '%seen%'
           OR column_name ILIKE '%active%' OR column_name ILIKE '%version%'
           OR column_name ILIKE '%last%')),
  'hook_enabled', (SELECT enabled FROM push_hook_config WHERE id = 1)
)::text AS v;
