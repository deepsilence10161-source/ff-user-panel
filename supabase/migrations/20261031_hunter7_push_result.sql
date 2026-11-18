/* ══════════════════════════════════════════════════════════════════
   Hunter7 PUSH RESULT (run 41161989044 ke baad — INSERT commit
   ~2026-10-31 02:53:49 UTC, notif_id dce6a300-4524-4ee7-815f-
   855bc03f0c30, uid TyHtzFOnggMxWbEdTnTdEl2j7oF3).
   push-send edge fn ka live response net._http_response me hota hai
   (hook → pg_net → fn). Tool sirf LAST SELECT print karta hai, isliye
   sab kuch ek hi consolidated jsonb me.
   ══════════════════════════════════════════════════════════════════ */

SELECT 'hunter7_push_result' AS k, json_build_object(
  'responses', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'id', id, 'status', status_code,
             'content', left(content::text, 400),
             'error', error_msg, 'timed_out', timed_out, 'created', created
           ) ORDER BY id DESC), '[]'::jsonb)
    FROM (SELECT id, status_code, content, error_msg, timed_out, created
            FROM net._http_response
           WHERE created > '2026-10-31 02:53:40+00'
           ORDER BY id DESC LIMIT 8) r),
  'tokens', (
    SELECT jsonb_build_object(
             'total', count(*),
             'fresh45', count(*) FILTER (WHERE updated_at > now() - interval '45 days'),
             'platforms', coalesce(jsonb_agg(DISTINCT platform), '[]'::jsonb),
             'newest_update', max(updated_at))
    FROM user_push_tokens
    WHERE user_id = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3'),
  'notif_row', (
    SELECT jsonb_build_object('id', id, 'user_id', user_id, 'type', type,
                              'title', title, 'created_at', created_at)
    FROM notifications WHERE ref_id = 'hunter7-live-20261031' LIMIT 1)
)::text AS v;
