select jsonb_build_object(
 'hunter7', (select jsonb_build_object('uid', id, 'ign', ign) from public.users where ilike(ign,'hunter7') or ilike(username,'hunter7') limit 1),
 'h7_notif_types', (select coalesce(jsonb_agg(jsonb_build_array(type, cnt)),'[]'::jsonb) from (select type, count(*) cnt from public.notifications where user_id = (select id from public.users where ilike(ign,'hunter7') limit 1) group by type) x),
 'h7_recent', (select coalesce(jsonb_agg(jsonb_build_array(type, left(title,40), created_at)),'[]'::jsonb) from (select type, title, created_at from public.notifications where user_id = (select id from public.users where ilike(ign,'hunter7') limit 1) order by created_at desc limit 12) y),
 'all_types', (select coalesce(jsonb_agg(jsonb_build_array(type, cnt)),'[]'::jsonb) from (select type, count(*) cnt from public.notifications group by type order by cnt desc limit 14) z),
 'notif_insert_fns', (select coalesce(jsonb_agg(proname),'[]'::jsonb) from pg_proc where prosrc ilike '%insert into public.notifications%' or prosrc ilike '%insert into notifications%'),
 'adminnotif_insert_fns', (select coalesce(jsonb_agg(proname),'[]'::jsonb) from pg_proc where prosrc ilike '%insert into public.admin_notifications%'),
 'notif_triggers', (select coalesce(jsonb_agg(tgname),'[]'::jsonb) from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname in ('notifications','admin_notifications') and not tgisinternal)
) as map_probe;
