-- ═══════════════════════════════════════════════════════════════════════
-- READ-ONLY DIAGNOSTIC (koi DDL/DML nahi): owner report 2026-10-31 —
-- "Hunter7 profile par 'Premium III' dikhta hai par perks par trial
--  prompt aata hai". Client-side audit se do jagah mili jo RAW
--  premium_level padhti hain bina expiry check ke (screens/profile.js
--  plate + free-trial trial-prompt wrapper). Ye query LIVE facts lati
--  hai: Hunter7 ki row, expire-hue users ka count, aur start_free_trial
--  ka source (server-guard likhne se pehle body dekhna zaroori).
-- ═══════════════════════════════════════════════════════════════════════
SELECT json_build_object(
  'hunter7', (SELECT json_build_object(
                'id', left(id::text, 8),
                'ign', ign,
                'premium_level', premium_level,
                'premium_expires', premium_expires,
                'expires_iso', to_char(premium_expires AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI'),
                'trial_used', trial_used,
                'expired_now', (premium_expires IS NOT NULL AND premium_expires < now()),
                'updated_at', to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI')
              ) FROM users WHERE ign = 'Hunter7'),
  'expired_premium_users', (SELECT json_agg(json_build_object('lvl', premium_level, 'n', c)) FROM (
                              SELECT premium_level, count(*) c FROM users
                              WHERE premium_level > 0 AND premium_expires IS NOT NULL AND premium_expires < now()
                              GROUP BY premium_level) s),
  'null_expiry_level_users', (SELECT count(*) FROM users WHERE premium_level > 0 AND premium_expires IS NULL),
  'trial_src', left(coalesce((SELECT prosrc FROM pg_proc WHERE proname = 'start_free_trial' LIMIT 1), ''), 2600)
) AS diag;
