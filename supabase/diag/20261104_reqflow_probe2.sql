create or replace function public.tmp_probe_reqflow2() returns jsonb
language plpgsql security definer set search_path='public' as $$
declare j jsonb := '{}'::jsonb; r jsonb;
begin
  if to_regclass('public.admins') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.admins limit 6) x' into r;
    j := jsonb_set(j,'{admins_rows}', coalesce(r,'[]'::jsonb));
  else
    j := jsonb_set(j,'{admins_rows}','"NO admins TABLE"'::jsonb);
  end if;

  execute 'select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select id, ign, is_admin from public.users where is_admin = true limit 8) x' into r;
  j := jsonb_set(j,'{is_admin_users}', coalesce(r,'[]'::jsonb));

  j := jsonb_set(j,'{policies}', coalesce((select jsonb_agg(jsonb_build_array(tablename,policyname,cmd,roles::text,left(coalesce(qual,''),60),left(coalesce(with_check,''),60))) from pg_policies where schemaname='public' and tablename in ('creator_applications','premium_requests','season_pass_requests')),'[]'::jsonb));

  j := jsonb_set(j,'{grants}', coalesce((select jsonb_agg(jsonb_build_array(table_name,grantee,string_agg(privilege_type,','))) from information_schema.table_privileges where table_schema='public' and table_name in ('creator_applications','premium_requests','season_pass_requests') and grantee in ('authenticated','anon') group by table_name,grantee),'[]'::jsonb));

  execute 'select coalesce(jsonb_agg(jsonb_build_array(p.proname, pg_get_function_arguments(p.oid))),''[]''::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=''public'' and p.proname in (''approve_creator_application'',''reject_creator_application'',''approve_premium'',''cancel_premium'',''admin_notify'')' into r;
  j := jsonb_set(j,'{rpc_sigs}', coalesce(r,'[]'::jsonb));

  j := jsonb_set(j,'{cols}', coalesce((select jsonb_agg(jsonb_build_array(table_name,column_name)) from information_schema.columns where table_schema='public' and table_name in ('creator_applications','premium_requests','season_pass_requests') order by table_name,ordinal_position),'[]'::jsonb));

  return j;
end $$;
select public.tmp_probe_reqflow2() as reqflow2;
