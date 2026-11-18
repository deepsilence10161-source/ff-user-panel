select jsonb_build_object(
 'owner_tokens', (select coalesce(jsonb_agg(jsonb_build_array(left(token::text,20), platform, updated_at)),'[]'::jsonb) from public.user_push_tokens where user_id='BwZglJY2XffByLls8KHaFyi519t2'),
 'all_rows', (select count(*) from public.user_push_tokens),
 'recent_notifs', (select coalesce(jsonb_agg(jsonb_build_array(title, created_at)),'[]'::jsonb) from (select title, created_at from public.admin_notifications order by created_at desc limit 3) x)
) as owner_probe;
