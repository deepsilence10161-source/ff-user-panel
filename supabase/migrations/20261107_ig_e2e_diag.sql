select (select count(*) from public.ig_dm_messages) as msgs,
       (select matched_key from public.ig_dm_messages order by id desc limit 1) as last_match,
       (select replied_by from public.ig_dm_messages order by id desc limit 1) as last_replied,
       (select title from public.admin_notifications order by created_at desc limit 1) as last_alert;
