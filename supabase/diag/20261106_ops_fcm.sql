select jsonb_build_object(
 'ops_fcm', (select coalesce(jsonb_agg(jsonb_build_array(id, left(to_jsonb(z)::text,150))),'[]'::jsonb) from (select id, z from net._http_response z where to_jsonb(z)::text not like '%DOCTYPE%' order by id desc limit 2) x),
 'panel_ops_now', (select coalesce(jsonb_agg(jsonb_build_array(left(title,40), created_at)),'[]'::jsonb) from (select title, created_at from public.admin_notifications where kind='ops' order by created_at desc limit 6) y),
 'hunter7_final', (select count(*) from public.notifications where user_id='TyHtzFOnggMxWbEdTnTdEl2j7oF3')
) as ops_fcm_probe;
