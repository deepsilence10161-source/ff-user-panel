select jsonb_build_object(
 'is_admin_users', (select coalesce(jsonb_agg(to_jsonb(u)),'[]'::jsonb) from public.users u where u.is_admin = true),
 'admins_cols', (select coalesce(jsonb_agg(column_name),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='admins'),
 'admins_rows', (select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from public.admins a),
 'an_cols', (select coalesce(jsonb_agg(column_name),'[]'::jsonb) from information_schema.columns where table_schema='public' and table_name='admin_notifications'),
 'qa_notifs', (select count(*) from public.notifications where user_id='oZHczBc32oWoO1cJNe7KEhoFPl22')
) as admin_probe;
