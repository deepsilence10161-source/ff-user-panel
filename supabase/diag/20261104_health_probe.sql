select json_build_object(
  'db_tick_age_min', (select round(extract(epoch from now() - max(checked_at)) / 60, 1)
                        from public.ops_health where target = 'db'),
  'user_bad',  (select count(*) filter (where not ok) from (select ok from public.ops_health where target = 'user-panel'  order by checked_at desc limit 3) x) >= 2,
  'admin_bad', (select count(*) filter (where not ok) from (select ok from public.ops_health where target = 'admin-panel' order by checked_at desc limit 3) x) >= 2
) as health_probe;
