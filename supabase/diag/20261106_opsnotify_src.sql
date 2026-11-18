select jsonb_build_object(
 'ops_notify_src', (select prosrc from pg_proc where proname='ops_notify' limit 1),
 'ops_notify_args', (select jsonb_build_array(proargnames, prosrc is not null) from pg_proc where proname='ops_notify' limit 1),
 'callers', (select coalesce(jsonb_agg(proname),'[]'::jsonb) from pg_proc where prosrc ilike '%ops_notify(%' and proname <> 'ops_notify'),
 'ops_cfg_tables', (select coalesce(jsonb_agg(table_name),'[]'::jsonb) from information_schema.tables where table_schema='public' and (table_name ilike '%ops%' or table_name ilike '%duty%'))
) as ops_probe;
