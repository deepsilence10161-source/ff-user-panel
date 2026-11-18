select json_build_object(
  'rows', (select coalesce(json_agg(o), '[]'::json) from (
     select json_build_object('id', id, 'ign', ign, 'email', email, 'at', created_at, 'del', is_deleted) o
       from public.users order by created_at desc limit 400) x)
) as users_dump;
