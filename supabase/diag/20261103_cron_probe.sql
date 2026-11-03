select json_build_object(
  'duty_runs', (select coalesce(json_agg(o), '[]'::json) from (
      select json_build_object('cmd', left(d.command,40), 'status', d.status, 'ret', left(coalesce(d.return_message,''),70), 'at', d.start_time) o
        from cron.job_run_details d
       where d.command like '%ops_room_reminder%' or d.command like '%ops_checkin_watch%' or d.command like '%ops_chat_watch%'
       order by d.start_time desc limit 10) x),
  'ops_jobs', (select coalesce(json_agg(jobname), '[]'::json) from cron.job where jobname like 'ops-%'),
  'ops_notifs', (select coalesce(json_agg(ref_id), '[]'::json) from (select ref_id from public.notifications where ref_id like 'ops-%' order by created_at desc limit 10) x)
) as cron_probe;
