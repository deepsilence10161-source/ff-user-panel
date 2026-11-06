select json_build_object(
  'manual', public.ops_panel_watch(),
  'panel_rows_2min', (select count(*) from public.ops_health where target in ('user-panel','admin-panel') and checked_at > now() - interval '2 minutes'),
  'state_now', (select json_agg(to_jsonb(s)) from (select target, req_id from public.ops_watch_state) s)
) as manual_test;
