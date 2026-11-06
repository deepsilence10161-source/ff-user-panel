select jsonb_build_object(
 'notif_cols', (select coalesce(jsonb_agg(column_name),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='notifications'),
 'adminnotif_cols', (select coalesce(jsonb_agg(column_name),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='admin_notifications'),
 'admin_notify_src', (select left(prosrc,700) from pg_proc where proname='admin_notify' limit 1),
 'mirror_trg', (select count(*) from pg_trigger where tgname like '%admin_notif_push%')
) as cols_probe;
