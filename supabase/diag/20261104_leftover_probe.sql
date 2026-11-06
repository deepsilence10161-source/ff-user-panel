select json_build_object(
 'left5', (select coalesce(json_agg(json_build_array(p.proname, pg_get_function_identity_arguments(p.oid))), '[]'::json)
             from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public' and p.prosecdef and p.proname like 'admin\_%'
              and has_function_privilege('anon', p.oid, 'execute')),
 'sp7', (select coalesce(json_agg(json_build_array(p.proname, pg_get_function_identity_arguments(p.oid))), '[]'::json)
            from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.prosecdef and coalesce(p.proconfig,'{}')::text not like '%search_path%')
) as leftovers;
