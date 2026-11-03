select json_build_object(
  'duty_runs', (select coalesce(json_agg(json_build_object('job', j.jobname, 'status', d.status, 'at', d.runstart)), '[]'::json)
                 from cron.job_run_details d join cron.job j on j.jobid = d.jobid
                where j.jobname in ('ops-room-reminder','ops-checkin-watch','ops-chat-watch')
                order by d.runstart desc limit 15),
  'ops_notifs', (select coalesce(json_agg(ref_id), '[]'::json) from (select ref_id from public.notifications where ref_id like 'ops-%' order by created_at desc limit 12) x),
  'cols', (select coalesce(json_agg(column_name), '[]'::json) from information_schema.columns where table_schema='cron' and table_name='job_run_details')
) as cron_probe;
