/* ══════════════════════════════════════════════════════════════════
   Hunter7 PUSH RESULT #2 (retry run 41162942501 ke baad):
   - android FCM token sync mila 03:01:20 UTC (tail …nzwpes)
   - DO-guard INSERT chala: notif 344dab0b-50f4-4bcb-b3fb-39fe0fa41d56,
     title '🎮 Mini eSports — FCM Live', 03:07:08 UTC
   - net_baseline = 1952 → push-send ka live response id > 1952 par
   ══════════════════════════════════════════════════════════════════ */
SELECT 'hunter7_push_result2' AS k, json_build_object(
  'responses', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id', id, 'status', status_code,
             'content', left(content::text, 400),
             'error', error_msg, 'timed_out', timed_out, 'created', created
           ) ORDER BY id DESC), '[]'::jsonb)
    FROM (SELECT id, status_code, content, error_msg, timed_out, created
            FROM net._http_response WHERE id > 1952
           ORDER BY id DESC LIMIT 8) r),
  'notif_row', (
    SELECT jsonb_build_object('id', id, 'user_id', user_id, 'type', type,
                              'title', title, 'created_at', created_at)
    FROM notifications WHERE ref_id = 'hunter7-live-20261031b' LIMIT 1)
)::text AS v;
