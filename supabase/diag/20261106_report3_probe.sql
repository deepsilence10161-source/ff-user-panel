select jsonb_build_object(
 'tz_funcs', (select coalesce(jsonb_agg(proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosrc like '%pg_timezone_names%'),
 'mutable_sp', (select coalesce(jsonb_agg(proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (p.proconfig is null or p.proconfig::text not like '%search_path=%')),
 'support_cols', (select coalesce(jsonb_agg(column_name),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='support_messages'),
 'watch_earn_src', (select left(prosrc, 800) from pg_proc where proname='claim_watch_earn_reward' limit 1),
 'watch_earn_acl', (select jsonb_build_array(has_function_privilege('anon', oid, 'execute'), has_function_privilege('authenticated', oid, 'execute')) from pg_proc where proname='claim_watch_earn_reward' limit 1),
 'definer_no_identity', (select coalesce(jsonb_agg(proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') and p.prosrc not like '%auth.jwt%' and p.prosrc not like '%auth.uid%' and p.prosrc not like '%is_caller_admin%' and p.prosrc not like '%is_admin%' and p.prosrc not like '%service_role%')
) as r3_probe;
