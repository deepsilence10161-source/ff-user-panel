select jsonb_build_object(
 'qa_notif', (select count(*) from public.notifications where user_id='MNTVkuiATOcFWBxw2kOuhk5DVcp1' and type='admin_alert'),
 'owner_notif', (select count(*) from public.notifications where user_id='BwZglJY2XffByLls8KHaFyi519t2' and type='push_test' or (user_id='BwZglJY2XffByLls8KHaFyi519t2' and title='Push chain test')),
 'qa_token', (select count(*) from (select to_jsonb(t) r from public.user_push_tokens t) x where r::text like '%MNTVkuiATOcFWBxw2kOuhk5DVcp1%'),
 'http_results', (select coalesce(jsonb_agg(jsonb_build_array(status, left(content::text,120))),'[]'::jsonb) from (select status, content from net._http_response order by id desc limit 3) z)
) as chain2;
