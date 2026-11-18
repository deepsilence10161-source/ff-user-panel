select jsonb_build_object(
 'owner_token_rows', (select coalesce(jsonb_agg(row),'[]'::jsonb) from (select to_jsonb(t) row from public.user_push_tokens t) x where row::text like '%BwZglJY2XffByLls8KHaFyi519t2%'),
 'total_token_rows', (select count(*) from public.user_push_tokens),
 'owner_recent_notifs', (select coalesce(jsonb_agg(row),'[]'::jsonb) from (select to_jsonb(n) row from public.notifications n where n.user_id='BwZglJY2XffByLls8KHaFyi519t2' order by n.created_at desc limit 5) x),
 'owner_recent_notifs_types', (select coalesce(jsonb_agg(jsonb_build_array(type, created_at)),'[]'::jsonb) from public.notifications where user_id='BwZglJY2XffByLls8KHaFyi519t2'),
 'push_hook_present', (select count(*) from public.push_hook_config),
 'trigger_present', (select count(*) from pg_trigger where tgname='notifications_push_hook'),
 'last_admin_notifs', (select coalesce(jsonb_agg(jsonb_build_array(title, created_at)),'[]'::jsonb) from (select title, created_at from public.admin_notifications order by created_at desc limit 4) y)
) as push_probe;
