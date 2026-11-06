-- 2026-10-31: ops-autonomy ka LIVE proof — pehla digest + exception scan
-- abhi chalao (owner ke phone pe push jayega = machine ka pehla message).
select json_build_object(
  'digest_sent', public.ops_daily_digest(),
  'exceptions_found', public.ops_exception_watch(),
  'auto_cancel_scan', public.ops_auto_cancel_stale(),
  'digest_row', (select title || ' ⇒ ' || body from public.notifications where ref_id = 'ops-digest-' || current_date limit 1)
) as ops_proof;
