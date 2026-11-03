-- pg_net ka asli param naam timeout_milliseconds hai (timeout_msecs nahi)
create or replace function public.ops_panel_watch() returns json
language plpgsql security definer
set search_path to public, net
as $$
declare
  v_prev record;
  v_resp record;
  v_reqid bigint;
  v_bad int;
  v_ticks int;
begin
  for v_prev in select * from public.ops_watch_state where req_id is not null loop
    select * into v_resp from net._http_response where id = v_prev.req_id;
    /* composite IS NOT NULL = sab fields non-null chahiye (error_msg NULL
       hota hai success par) — isliye scalar field se check karo. */
    if v_resp.id is not null then
      insert into public.ops_health (target, ok, status, detail)
      values (v_prev.target, coalesce(v_resp.status_code, 0) = 200, v_resp.status_code,
              case when coalesce(v_resp.status_code,0) = 200 then 'ok'
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

  for v_prev in
    select 'user-panel' as target, 'https://deepsilence10161-source.github.io/ff-user-panel/' as url
    union all select 'admin-panel', 'https://deepsilence10161-source.github.io/ff-admin-panel/'
  loop
    begin
      select net.http_get(url := v_prev.url, timeout_milliseconds := 20000) into v_reqid;
      update public.ops_watch_state set req_id = v_reqid where target = v_prev.target;
    exception when others then
      insert into public.ops_health (target, ok, detail) values (v_prev.target, false, 'http_get error: ' || left(sqlerrm, 100));
    end;
  end loop;

  insert into public.ops_health (target, ok, detail) values ('db', true, 'per-minute tick alive');
  select count(*) into v_ticks from cron.job where jobname = 'ops-panel-watch';
  return json_build_object('tick_at', now(), 'cron_rows', v_ticks);
end $$;

select json_build_object('fixed', to_regprocedure('public.ops_panel_watch()') is not null) as sig_fix_state;
