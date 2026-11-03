select jsonb_build_object(
 'recent_admin_notifs',(select coalesce(jsonb_agg(jsonb_build_array(created_at,title,kind)),'[]'::jsonb) from (select created_at,title,kind from public.admin_notifications order by created_at desc limit 6) x),
 'trg_def',(select prosrc from pg_proc where proname='trg_request_admin_alert'),
 'notify_kind_check',(select conname||':'||pg_get_constraintdef(oid) from pg_constraint where conrelid='public.admin_notifications'::regclass and contype='c')
) as nprobe;
