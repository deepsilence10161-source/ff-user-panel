create or replace function public.tmp_probe_reqflow() returns jsonb
language plpgsql security definer set search_path='public' as $$
declare j jsonb := '{}'::jsonb; r jsonb;
begin
  j := jsonb_set(j,'{tables}', coalesce((select jsonb_agg(tablename) from pg_tables where schemaname='public'
        and tablename in ('creator_applications','premium_requests','season_pass_requests')),'[]'::jsonb));

  if to_regclass('public.creator_applications') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.creator_applications order by created_at desc limit 8) x' into r;
    j := jsonb_set(j,'{ca_rows}', coalesce(r,'[]'::jsonb));
    j := jsonb_set(j,'{ca_policies}', coalesce((select jsonb_agg(jsonb_build_array(policyname,cmd,roles::text,qual is not null)) from pg_policies where schemaname='public' and tablename='creator_applications'),'[]'::jsonb));
    j := jsonb_set(j,'{ca_grants}', jsonb_build_array(has_table_privilege('authenticated','creator_applications','SELECT'), has_table_privilege('authenticated','creator_applications','INSERT')));
    j := jsonb_set(j,'{ca_rls}', (select relrowsecurity from pg_class where oid='public.creator_applications'::regclass)::text::jsonb);
  end if;

  if to_regclass('public.premium_requests') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.premium_requests order by created_at desc limit 8) x' into r;
    j := jsonb_set(j,'{pr_rows}', coalesce(r,'[]'::jsonb));
    j := jsonb_set(j,'{pr_policies}', coalesce((select jsonb_agg(jsonb_build_array(policyname,cmd,roles::text,qual is not null)) from pg_policies where schemaname='public' and tablename='premium_requests'),'[]'::jsonb));
    j := jsonb_set(j,'{pr_grants}', jsonb_build_array(has_table_privilege('authenticated','premium_requests','SELECT'), has_table_privilege('authenticated','premium_requests','INSERT')));
    j := jsonb_set(j,'{pr_rls}', (select relrowsecurity from pg_class where oid='public.premium_requests'::regclass)::text::jsonb);
  end if;

  execute 'select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select id, ign, is_admin, is_creator, premium_level, premium_expires, created_at from public.users where lower(ign) like ''%hunter%'' or id=''TyHtzFOnggMxWbEdTnTdEl2j7oF3'' limit 6) x' into r;
  j := jsonb_set(j,'{hunter_and_owner}', coalesce(r,'[]'::jsonb));

  execute 'select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select id, ign, premium_level, premium_expires from public.users where premium_level is not null and premium_level > 0 limit 15) x' into r;
  j := jsonb_set(j,'{premium_users}', coalesce(r,'[]'::jsonb));

  if to_regclass('public.season_pass_requests') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(x)),''[]''::jsonb) from (select * from public.season_pass_requests order by created_at desc limit 8) x' into r;
    j := jsonb_set(j,'{sp_rows}', coalesce(r,'[]'::jsonb));
  end if;

  return j;
end $$;
select public.tmp_probe_reqflow() as reqflow;
