select jsonb_build_object(
 'trigs_on_notifications', (select coalesce(jsonb_agg(jsonb_build_array(tgname, tgenabled)),'[]'::jsonb) from pg_trigger t join pg_class c on c.oid=t.tgrelid where c.relname='notifications' and not tgisinternal),
 'push_send_fn', (select count(*) from pg_proc where proname like 'push%send%' or proname like '%push_send%')
) as trig_probe;
