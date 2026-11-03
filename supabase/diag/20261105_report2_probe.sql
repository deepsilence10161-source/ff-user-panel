create or replace function public.tmp_probe_r2() returns jsonb
language plpgsql security definer set search_path='public' as $$
declare j jsonb := '{}'::jsonb; r jsonb;
begin
  execute 'select left(prosrc, 1500) from pg_proc where proname=''admin_notify''' into r;
  j := jsonb_set(j,'{admin_notify_src}', to_jsonb(r));
  execute 'select left(prosrc, 1200) from pg_proc where proname=''admin_match_interests''' into r;
  j := jsonb_set(j,'{ami_src}', to_jsonb(r));
  execute 'select left(prosrc, 1600) from pg_proc where proname=''claim_ad_reward''' into r;
  j := jsonb_set(j,'{ad_src}', to_jsonb(r));
  execute 'select left(prosrc, 1200) from pg_proc where proname=''claim_match_refund''' into r;
  j := jsonb_set(j,'{refund_src}', to_jsonb(r));
  j := jsonb_set(j,'{wt_indexes}', coalesce((select jsonb_agg(jsonb_build_array(indexrelname, idx_scan, pg_get_indexdef(indexrelid)))
     from pg_stat_user_indexes where relname='wallet_transactions' and indexrelname in ('idx_wt_user_date','idx_wtx_user_ts')),'[]'::jsonb));
  execute 'select coalesce(jsonb_agg(p.proname),''[]''::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=''public'' and p.prosecdef and has_function_privilege(''anon'', p.oid, ''execute'')' into r;
  j := jsonb_set(j,'{anon_definers}', coalesce(r,'[]'::jsonb));
  j := jsonb_set(j,'{an_policies}', coalesce((select jsonb_agg(jsonb_build_array(policyname,cmd,roles::text,left(coalesce(qual,''),80),left(coalesce(with_check,''),60))) from pg_policies where schemaname='public' and tablename='admin_notifications'),'[]'::jsonb));
  execute 'select coalesce(jsonb_agg(p.proname),''[]''::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=''public'' and p.prosecdef and coalesce(p.proconfig,''{}'')::text not like ''%search_path%''' into r;
  j := jsonb_set(j,'{mutable_sp}', coalesce(r,'[]'::jsonb));
  return j;
end $$;
select public.tmp_probe_r2() as r2;
