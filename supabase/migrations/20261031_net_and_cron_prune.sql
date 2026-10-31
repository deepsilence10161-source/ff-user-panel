/* ══════════════════════════════════════════════════════════════════
   CAPACITY INSURANCE (directive 16, 2026-10-31) — infra-log pruning.
   Live measurement (run 41167535148): DB 62.6MB / 500MB cap (12.5%).
   Do tables bina retention ke badhti hain:
     • net._http_response — pg_net response blobs (~100KB/row avg
       measure hua; ids 1953 tak, rows 28 — platform-side kuch
       pruning chalti hai par guaranteed retention nahi).
     • cron.job_run_details — 10 active jobs (4 har-minute) →
       ~5.7k rows/DIN; yeh sabse tez badhne wali table hai.
   Retention 7 din (debugging window kaafi; push-e2e driver apna
   response turant padh leta hai). Permission-probe ke saath:
   DELETE na chala to job schedule hi nahi hoti (run fail nahi).
   ══════════════════════════════════════════════════════════════════ */

-- purane same-name jobs hatao (idempotent re-run)
DO $do$
BEGIN
  PERFORM cron.unschedule('net-response-prune')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'net-response-prune');
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;

DO $do$
BEGIN
  PERFORM cron.unschedule('job-run-details-prune')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'job-run-details-prune');
EXCEPTION WHEN OTHERS THEN NULL;
END $do$;

-- net._http_response: permission probe → schedule + ek-baari turant prune
DO $do$
DECLARE has_perm boolean := true;
BEGIN
  BEGIN
    DELETE FROM net._http_response WHERE id = -1;  -- no-op probe
  EXCEPTION WHEN insufficient_privilege THEN
    has_perm := false;
  END;
  IF has_perm THEN
    PERFORM cron.schedule('net-response-prune', '25 4 * * *',
      $cron$DELETE FROM net._http_response WHERE created < now() - interval '7 days'$cron$);
    DELETE FROM net._http_response WHERE created < now() - interval '7 days';
  END IF;
END $do$;

-- cron.job_run_details: same pattern
DO $do$
DECLARE has_perm boolean := true;
BEGIN
  BEGIN
    DELETE FROM cron.job_run_details WHERE jobid = -1;  -- no-op probe
  EXCEPTION WHEN insufficient_privilege THEN
    has_perm := false;
  END;
  IF has_perm THEN
    PERFORM cron.schedule('job-run-details-prune', '35 4 * * *',
      $cron$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$cron$);
    DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';
  END IF;
END $do$;

SELECT 'prune_state' AS k, json_build_object(
  'net_rows_now', (SELECT count(*) FROM net._http_response),
  'job_run_rows_now', (SELECT count(*) FROM cron.job_run_details),
  'db_size_mb', round(pg_database_size(current_database()) / 1048576.0, 2),
  'prune_jobs', (SELECT coalesce(jsonb_agg(jobname || ' @ ' || schedule), '[]'::jsonb)
                 FROM cron.job
                 WHERE jobname IN ('net-response-prune','job-run-details-prune','fcm-token-prune'))
)::text AS v;
