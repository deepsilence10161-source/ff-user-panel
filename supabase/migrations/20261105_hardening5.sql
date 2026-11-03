-- HARDENING 5 (CRITICAL CORRECTION) — is app me Supabase client
-- Firebase ID-token (external JWT) bhejta hai jisme `role` claim NAHIN
-- hota → PostgREST session role hamesha ANON hota hai (auth.uid() =
-- Firebase UID). Isliye "anon revoke" = poora app band. Sahi model:
--   • anon EXECUTE = signed-in Firebase user; asli identity check
--     function ke ANDAR (auth.jwt()->>'sub') + RLS policies me.
--   • admin-family + ops/cron + gateway = sirf service_role/postgres
--     (admin UI ya to gateway use karta hai, ya internal is_admin check).
-- h4 se production RPCs 42501 mar rahe the — ab user-facing definers
-- par anon wapas (inner wrappers band rahenge), admin-family band.
do $$ declare r record; n int := 0;
  v_keep_closed boolean;
begin
  for r in select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args
           from pg_proc p join pg_namespace nn on nn.oid = p.pronamespace
          where nn.nspname = 'public' and p.prosecdef loop
    v_keep_closed := (r.proname like 'admin\_%')
      or (r.proname like 'ops\_%')
      or r.proname in ('admin_gateway_exec','admin_gateway_exec_inner','sync_admin_tables',
                       'resolve_sd_request','release_eligible_commissions','approve_premium',
                       'cancel_premium','approve_creator_application','reject_creator_application',
                       'publish_match_results','correct_match_result','cancel_match_with_refunds',
                       'set_user_ban_status','admin_adjust_wallet','admin_reward_suggestion',
                       'admin_send_notification','admin_send_broadcast_notification',
                       'admin_create_sponsored_match','admin_distribute_sponsored_prize',
                       'resolve_sponsored_withdrawal','prune_stale_push_tokens',
                       'guard_notification_insert','claim_ad_reward_inner',
                       'claim_match_refund_inner','trg_request_admin_alert',
                       'notifications_push_hook','touch_user_push_tokens')
      or r.proname like 'trg\_%';
    if not v_keep_closed then
      execute format('grant execute on function public.%I(%s) to anon, authenticated', r.proname, r.args);
      n := n + 1;
    end if;
  end loop;
  raise notice 'reopened for signed-in users: %', n;
end $$;

-- admin panel ka direct rpc (internal is_caller_admin check ke saath)
grant execute on function public.admin_match_interests(text) to anon, authenticated;

select jsonb_build_object(
  'anon_open_user_fns', jsonb_build_array(
     has_function_privilege('anon',(select oid from pg_proc where proname='validate_and_join_match' limit 1),'execute'),
     has_function_privilege('anon',(select oid from pg_proc where proname='claim_ad_reward' limit 1),'execute'),
     has_function_privilege('anon',(select oid from pg_proc where proname='claim_match_refund' limit 1),'execute'),
     has_function_privilege('anon',(select oid from pg_proc where proname='process_daily_checkin' limit 1),'execute'),
     has_function_privilege('anon',(select oid from pg_proc where proname='admin_match_interests' limit 1),'execute')),
  'still_closed', jsonb_build_array(
     has_function_privilege('anon',(select oid from pg_proc where proname='admin_gateway_exec' limit 1),'execute'),
     has_function_privilege('authenticated',(select oid from pg_proc where proname='admin_gateway_exec' limit 1),'execute'),
     has_function_privilege('anon',(select oid from pg_proc where proname='claim_ad_reward_inner' limit 1),'execute'),
     has_function_privilege('anon',(select oid from pg_proc where proname='approve_premium' limit 1),'execute'))
) as h5_proof;
