select jsonb_build_object(
 'http_resp', (select coalesce(jsonb_agg(left(to_jsonb(z)::text,240)),'[]'::jsonb) from (select * from net._http_response order by id desc limit 6) z),
 'owner_notifs', (select coalesce(jsonb_agg(jsonb_build_array(title, created_at)),'[]'::jsonb) from (select title, created_at from public.notifications where user_id='BwZglJY2XffByLls8KHaFyi519t2' order by created_at desc limit 6) x)
) as push_probe;
