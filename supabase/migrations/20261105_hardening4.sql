-- HARDENING 4 — PUBLIC-route se bache 34 anon definers:
-- pehle authenticated+service_role ko DIRECT grant (taki PUBLIC revoke
-- ke baad user flows zinda rahen), phir PUBLIC+anon revoke.
-- Admin-family (admin_%, gateway whitelist) ko authenticated NAHI dena.
do $$ declare r record; n int := 0;
  v_admin_only boolean;
begin
  for r in select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args
           from pg_proc p join pg_namespace nn on nn.oid = p.pronamespace
          where nn.nspname = 'public' and p.prosecdef
            and has_function_privilege('anon', p.oid, 'execute') loop
    v_admin_only := (r.proname like 'admin\_%')
      or r.proname in ('admin_gateway_exec','resolve_sd_request','release_eligible_commissions',
                       'approve_premium','cancel_premium','approve_creator_application',
                       'reject_creator_application','publish_match_results','correct_match_result',
                       'cancel_match_with_refunds','set_user_ban_status','sync_admin_tables',
                       'admin_adjust_wallet','admin_reward_suggestion','admin_send_notification',
                       'admin_send_broadcast_notification','admin_create_sponsored_match',
                       'admin_distribute_sponsored_prize','resolve_sponsored_withdrawal');
    if not v_admin_only then
      execute format('grant execute on function public.%I(%s) to authenticated, service_role', r.proname, r.args);
    end if;
    execute format('revoke execute on function public.%I(%s) from public, anon', r.proname, r.args);
    n := n + 1;
  end loop;
  raise notice 'public-route revoked: %', n;
end $$;

select jsonb_build_object(
  'anon_definers_left', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  'auth_still_ok', (select coalesce(jsonb_agg(jsonb_build_array(proname, has_function_privilege('authenticated', p.oid, 'execute'))),'[]'::jsonb)
                     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                    where n.nspname='public' and proname in ('validate_and_join_match','claim_ad_reward','claim_match_refund','process_daily_checkin')),
  'admin_still_closed', (select has_function_privilege('authenticated', p.oid, 'execute') from pg_proc p where proname='admin_gateway_exec')
) as h4_proof;
