select jsonb_build_object(
 'we_sig', (select jsonb_build_array(pg_get_function_arguments(oid), pg_get_function_result(oid)) from pg_proc where proname='claim_watch_earn_reward' limit 1),
 'ad_sig', (select jsonb_build_array(pg_get_function_arguments(oid), pg_get_function_result(oid)) from pg_proc where proname='claim_ad_reward' limit 1),
 'cron', (select coalesce(jsonb_agg(jsonb_build_array(jobid, schedule, command)),'[]'::jsonb) from cron.job),
 'we_log_cols', (select coalesce(jsonb_agg(column_name),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='watch_earn_log')
) as sig_probe;
