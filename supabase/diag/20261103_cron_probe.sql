select json_build_object(
  'duty_runs', (select coalesce(json_agg(json_build_object('job', j.jobname, 'status', d.status, 'ret', left(d.return_value::text,60), 'err', left(coalesce(d.message,''),80), 'at', d.runstart)) , '[]'::json)
                 from cron.job_run_details d join cron.job j on j.jobid = d.jobid
                where j.jobname in ('ops-room-reminder','ops-checkin-watch','ops-chat-watch','ops-auto-cancel','ops-exception-watch','ops-daily-digest')
                order by d.runstart desc limit 12),
  'ops_notifs_today', (select coalesce(json_agg(ref_id), '[]'::json) from (select ref_id from public.notifications where ref_id like 'ops-%' order by created_at desc limit 12) x)
) as cron_probe;
