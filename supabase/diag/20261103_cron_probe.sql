select json_build_object(
  'cols', (select coalesce(json_agg(column_name), '[]'::json) from information_schema.columns where table_schema='cron' and table_name='job_run_details'),
  'jobs', (select coalesce(json_agg(jobname), '[]'::json) from cron.job)
) as cron_probe;
