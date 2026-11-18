select json_build_object(
  'ops_notifs', (select coalesce(json_agg(json_build_object('ref',ref_id,'uid',left(user_id,6),'title',title,'at',created_at)), '[]'::json)
                 from (select * from public.notifications where ref_id like 'ops-%' order by created_at desc limit 8) x),
  'owner_cfg',  (select value from public.ops_config where key='owner_uid'),
  'notif_cols', (select array_agg(column_name) from information_schema.columns where table_schema='public' and table_name='notifications')
) as ops_probe;
