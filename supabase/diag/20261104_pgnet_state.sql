select json_build_object(
  'resp_rows', (select count(*) from net._http_response),
  'resp_latest', (select max(created_at) from net._http_response),
  'resp_sample', (select json_agg(to_jsonb(x)) from (select id, status_code, error_msg, left(content::text,60) as body, created_at from net._http_response order by id desc limit 4) x),
  'state', (select json_agg(to_jsonb(s)) from (select * from public.ops_watch_state) s),
  'health_latest', (select max(checked_at) from public.ops_health)
) as pgnet_state;
