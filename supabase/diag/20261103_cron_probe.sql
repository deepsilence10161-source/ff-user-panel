select json_build_object(
  'fails', (select coalesce(json_agg(o), '[]'::json) from (
      select json_build_object('cmd', left(d.command,34), 'status', d.status, 'ret', left(coalesce(d.return_message,''),220), 'at', d.start_time) o
        from cron.job_run_details d
       where d.command like '%ops_checkin_watch%' or d.command like '%ops_room_reminder%'
         and d.start_time between '2026-11-02 23:30' and '2026-11-03 00:20'
       order by d.start_time desc limit 14) x)
) as cron_probe;
