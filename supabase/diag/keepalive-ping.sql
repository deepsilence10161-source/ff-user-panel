/* DB keepalive ping (anti-pause, directive 16) — READ-ONLY, no PII.
   Free plan: 7 din inactivity → project pause. Yeh ping Mon+Thu
   db-keepalive.yml se chalti hai (aur kabhi bhi manual dispatch se). */
SELECT 'keepalive' AS k, json_build_object(
  'ts', now(),
  'db_size_mb', round(pg_database_size(current_database()) / 1048576.0, 2),
  'db_cap_mb', 500,
  'users', (SELECT count(*) FROM users),
  'fcm_tokens', (SELECT count(*) FROM user_push_tokens),
  'hook_enabled', (SELECT enabled FROM push_hook_config WHERE id = 1)
)::text AS v;
