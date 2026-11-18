select jsonb_build_object(
 'mutable_all', (select coalesce(jsonb_agg(jsonb_build_array(n.nspname, p.proname, p.prosecdef)),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','auth','extensions') and p.proconfig is null or p.proconfig::text not like '%search_path=%')
) as sp_probe;
