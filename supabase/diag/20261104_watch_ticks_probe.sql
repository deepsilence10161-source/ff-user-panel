select json_build_object(
  'db_ticks_10min', (select count(*) from public.ops_health where target = 'db' and checked_at > now() - interval '10 minutes'),
  'user_panel', (select json_agg(o) from (select ok, status, detail, to_char(checked_at at time zone 'Asia/Kolkata','HH24:MI:SS') as ist from public.ops_health where target = 'user-panel' order by checked_at desc limit 4) x o),
  'admin_panel', (select json_agg(o) from (select ok, status, detail, to_char(checked_at at time zone 'Asia/Kolkata','HH24:MI:SS') as ist from public.ops_health where target = 'admin-panel' order by checked_at desc limit 4) x o),
  'crons', (select json_agg(jobname) from cron.job where jobname like 'ops-%')
) as watch_ticks;
