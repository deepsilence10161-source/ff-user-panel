select json_build_object(
  'is_deleted_col', (select json_build_object('exists', count(*)>0, 'default', max(column_default), 'nullable', max(is_nullable)) from information_schema.columns where table_schema='public' and table_name='users' and column_name='is_deleted'),
  'del_counts', (select json_build_object('true', count(*) filter (where is_deleted = true), 'false', count(*) filter (where is_deleted = false), 'null', count(*) filter (where is_deleted is null)) from public.users),
  'auth_no_profile', (select json_build_object('count', count(*), 'sample', (select coalesce(json_agg(o), '[]'::json) from (select json_build_object('email', left(au2.email,34), 'at', au2.created_at) o from (select id, email, created_at from auth.users where created_at > now() - interval '21 days') au2 left join public.users pu2 on pu2.id = au2.id::text where pu2.id is null order by au2.created_at desc limit 8) y))
                       from (select id from auth.users where created_at > now() - interval '21 days') au
                       left join public.users pu on pu.id = au.id::text
                      where pu.id is null),
  'recent_users', (select coalesce(json_agg(o), '[]'::json) from (select json_build_object('ign', left(ign,18), 'del', is_deleted, 'at', created_at) o from (select ign, is_deleted, created_at from public.users order by created_at desc limit 6) x2) y2),
  'totals', (select json_build_object('auth_21d', (select count(*) from auth.users where created_at > now() - interval '21 days'), 'users_21d', (select count(*) from public.users where created_at > now() - interval '21 days')) from public.users limit 1)
) as missing_users_probe;
