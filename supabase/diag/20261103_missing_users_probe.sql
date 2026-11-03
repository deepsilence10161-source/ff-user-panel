select json_build_object(
  'is_deleted_col', (select json_build_object('exists', count(*)>0, 'default', max(column_default), 'nullable', max(is_nullable)) from information_schema.columns where table_schema='public' and table_name='users' and column_name='is_deleted'),
  'del_counts', (select json_build_object('true', count(*) filter (where is_deleted = true), 'false', count(*) filter (where is_deleted = false), 'null', count(*) filter (where is_deleted is null)) from public.users),
  'auth_no_profile', (select json_build_object('count', count(*), 'sample', coalesce(json_agg(json_build_object('email', left(au.email,34), 'at', au.created_at)) order by au.created_at desc limit 8), '[]'::json)
                       from (select id, email, created_at from auth.users where created_at > now() - interval '21 days') au
                       left join public.users pu on pu.id = au.id
                      where pu.id is null),
  'recent_users', (select coalesce(json_agg(json_build_object('ign', left(ign,18), 'del', is_deleted, 'at', created_at)), '[]'::json) from (select ign, is_deleted, created_at from public.users order by created_at desc limit 6) x),
  'total', (select json_build_object('auth_21d', (select count(*) from auth.users where created_at > now() - interval '21 days'), 'users_21d', (select count(*) from public.users where created_at > now() - interval '21 days')) from public.users limit 1)
) as missing_users_probe;
