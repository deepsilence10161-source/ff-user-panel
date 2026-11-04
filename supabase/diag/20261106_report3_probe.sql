select jsonb_build_object(
 'tz_funcs', (select coalesce(jsonb_agg(proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc like '%pg_timezone_names%'),
 'mutable_sp', (select coalesce(jsonb_agg(jsonb_build_array(proname, proconfig)),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))),
 'support_cols', (select coalesce(jsonb_agg(column_name),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='support_messages'),
 'watch_earn_src', (select left(prosrc, 700) from pg_proc where proname='claim_watch_earn_reward'),
 'watch_earn_acl', (select jsonb_build_array(has_function_privilege('anon',(select oid from pg_proc where proname='claim_watch_earn_reward' limit 1),'execute'), has_function_privilege('authenticated',(select oid from pg_proc where proname='claim_watch_earn_reward' limit 1),'execute')),
 'definer_no_identity', (select coalesce(jsonb_agg(proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') and p.prosrc not like '%auth.jwt%' and p.prosrc not like '%auth.uid%' and p.prosrc not like '%is_caller_admin%' and p.prosrc not like '%is_admin%' and p.prosrc not like '%service_role%')
) as r3_probe;
