-- GH watchdog alert (guarded: max 1 per 30 min) — bell + device push dono
insert into public.admin_notifications (title, body, kind)
select '⚠️ GH watchdog: panels/DB me dikkat',
       'GitHub health-watch (har 5 min) ne failure detect ki: panels HTTP ya DB heartbeat. Ops health admin panel bell/alerts me dekhein.',
       'warn'
 where not exists (select 1 from public.admin_notifications
                    where title like '⚠️ GH watchdog%' and created_at > now() - interval '30 minutes');
insert into public.notifications (user_id, type, title, body)
select 'TyHtzFOnggMxWbEdTnTdEl2j7oF3', 'admin_alert',
       '⚠️ GH watchdog: panels/DB me dikkat',
       'GitHub health-watch (har 5 min) ne failure detect ki — admin panel bell dekhein.'
 where not exists (select 1 from public.notifications
                    where user_id = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3'
                      and title like '⚠️ GH watchdog%' and created_at > now() - interval '30 minutes');
select json_build_object('gh_alert', (select count(*) from public.admin_notifications
                                       where title like '⚠️ GH watchdog%'
                                         and created_at > now() - interval '5 minutes')) as gh_alert_state;
