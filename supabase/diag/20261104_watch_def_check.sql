select json_build_object(
  'def_has_fix', (select strpos(pg_get_functiondef(oid), 'v_resp.id is not null') > 0 from pg_proc where proname='ops_panel_watch'),
  'def_has_ms_fix', (select strpos(pg_get_functiondef(oid), 'timeout_milliseconds') > 0 from pg_proc where proname='ops_panel_watch'),
  'manual', public.ops_panel_watch(),
  'panel_rows_2min', (select count(*) from public.ops_health where target in ('user-panel','admin-panel') and checked_at > now() - interval '2 minutes'),
  'resp_last2', (select json_agg(to_jsonb(r)) from (select id, status_code, left(error_msg,60) err, to_char(created,'HH24:MI:SS') utc from net._http_response order by id desc limit 2) r)
) as def_check;
