select json_build_object(
  'gateway_def', (select pg_get_functiondef(oid) from pg_proc where proname='admin_gateway_exec' limit 1),
  'gateway_grants', (select coalesce(json_agg(json_build_object('grantee', grantee, 'priv', privilege_type)), '[]'::json) from information_schema.routine_privileges where specific_schema='public' and routine_name='admin_gateway_exec'),
  'anon_definers', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  'mutable_sp', (select coalesce(json_agg(o), '[]'::json) from (select p.proname o from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and coalesce(p.proconfig,'{}')::text not like '%search_path%') x),
  'v_resp_fns', (select coalesce(json_agg(proname), '[]'::json) from pg_proc where prosrc like '%v_resp%' and prosrc like '%.status%'),
  'admin_notif_grants', (select coalesce(json_agg(grantee), '[]'::json) from information_schema.table_privileges where table_name='admin_notifications' and grantee not in ('postgres','supabase_admin')),
  'no_policy_tables', (select coalesce(json_agg(c.relname), '[]'::json) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsec and not exists (select 1 from pg_policy pol where pol.polrelid=c.oid)),
  'watch_ticks', (select json_build_object('db10', (select count(*) from public.ops_health where target='db' and checked_at > now() - interval '10 minutes'), 'up10', (select count(*) from public.ops_health where target='user-panel' and checked_at > now() - interval '10 minutes'), 'ap10', (select count(*) from public.ops_health where target='admin-panel' and checked_at > now() - interval '10 minutes')))
) as sec_probe;
