-- =====================================================================
-- OPS PANEL WATCH (2026-11-04, owner order: "per minute, 24 hours,
-- non-stop jaanch"): DB-side watchdog — har MINUTE pg_net se user-panel
-- aur admin-panel ko ping karta hai, ops_health me likhta hai, lagatar
-- 2 fail par admin_notify (bell + device push). GitHub watchdog
-- (health-watch.yml, */5) isi ka heartbeat check karta hai — dono ek
-- doosre ke watch-dog hain, koi single point of failure nahi.
-- =====================================================================
create table if not exists public.ops_health (
  id         bigserial primary key,
  target     text not null,
  ok         boolean not null,
  status     int,
  detail     text,
  checked_at timestamptz not null default now()
);
create index if not exists ops_health_time_idx on public.ops_health (checked_at desc);

create table if not exists public.ops_watch_state (
  target        text primary key,
  req_id        bigint,
  last_alert_at timestamptz
);
insert into public.ops_watch_state (target) values ('user-panel'), ('admin-panel')
on conflict (target) do nothing;

create or replace function public.ops_panel_watch() returns json
language plpgsql security definer
set search_path to public, net
as $$
declare
  v_prev record;
  v_resp record;
  v_reqid bigint;
  v_bad int;
  v_url text;
  v_ticks int;
begin
  /* 1) pichle tick ke HTTP requests ke nateeje dekho */
  for v_prev in select * from public.ops_watch_state where req_id is not null loop
    select * into v_resp from net._http_response where id = v_prev.req_id;
    if v_resp is not null then
      insert into public.ops_health (target, ok, status, detail)
      values (v_prev.target, coalesce(v_resp.status, 0) = 200, v_resp.status,
              case when coalesce(v_resp.status,0) = 200 then 'ok'
                   else coalesce(left(v_resp.error_msg, 120), 'no-response') end);
      select count(*) into v_bad
        from (select ok from public.ops_health where target = v_prev.target
              order by checked_at desc limit 3) x
       where not ok;
      if v_bad >= 2 then
        if not exists (select 1 from public.ops_watch_state
                        where target = v_prev.target
                          and last_alert_at > now() - interval '30 minutes') then
          perform public.admin_notify(
            '⚠️ Panel down: ' || v_prev.target,
            'Ops watchdog (per-minute): ' || v_prev.target || ' lagatar 2+ tick se respond nahi kar raha. Status: ' ||
            coalesce((select status from public.ops_health where target = v_prev.target order by checked_at desc limit 1), -1)::text ||
            '. Turant dekhein.', 'warn');
          update public.ops_watch_state set last_alert_at = now() where target = v_prev.target;
        end if;
      end if;
      update public.ops_watch_state set req_id = null where target = v_prev.target;
    end if;
  end loop;

  /* 2) naye HTTP pings bhejo (20s timeout — slow-net tolerant) */
  for v_prev in
    select 'user-panel' as target, 'https://deepsilence10161-source.github.io/ff-user-panel/' as url
    union all select 'admin-panel', 'https://deepsilence10161-source.github.io/ff-admin-panel/'
  loop
    begin
      select net.http_get(url := v_prev.url, timeout_msecs := 20000) into v_reqid;
      update public.ops_watch_state set req_id = v_reqid where target = v_prev.target;
    exception when others then
      insert into public.ops_health (target, ok, detail) values (v_prev.target, false, 'http_get error: ' || left(sqlerrm, 100));
    end;
  end loop;

  /* 3) DB heartbeat — GitHub watchdog isi ko verify karta hai */
  insert into public.ops_health (target, ok, detail) values ('db', true, 'per-minute tick alive');
  select count(*) into v_ticks from cron.job where jobname = 'ops-panel-watch';
  return json_build_object('tick_at', now(), 'cron_rows', v_ticks);
end $$;

/* har MINUTE, 24/7 */
do $do$
begin
  perform cron.schedule('ops-panel-watch', '* * * * *', $$select public.ops_panel_watch()$$);
exception when others then
  raise notice 'cron schedule skip: %', sqlerrm;
end $do$;

/* 7 din purana health data auto-trim (free-plan disk bachao) */
do $do$
begin
  perform cron.schedule('ops-health-trim', '17 3 * * *',
    $$delete from public.ops_health where checked_at < now() - interval '7 days'$$);
exception when others then
  raise notice 'trim schedule skip: %', sqlerrm;
end $do$;

select json_build_object(
  'cron_watch', (select count(*) from cron.job where jobname = 'ops-panel-watch'),
  'cron_trim',  (select count(*) from cron.job where jobname = 'ops-health-trim'),
  'state_rows', (select count(*) from public.ops_watch_state),
  'fn',         to_regprocedure('public.ops_panel_watch()') is not null
) as panel_watch_state;
