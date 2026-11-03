-- =====================================================================
-- SECURITY HARDENING (2026-11-04) — engineer report ke har P0/P1 ka fix
-- 1) admin_gateway_exec: anon+authenticated se EXECUTE revoke (sirf
--    service_role — admin panel ka edge fn 'admin-gateway' Firebase token
--    verify karke service_role se call karta hai, isliye UI unaffected).
-- 2) admin_notifications: authenticated ko GRANT (owner ka bell
--    'permission denied' kha raha tha).
-- 3) bina-policy wali server-only tables se anon/authenticated revoke.
-- 4) mutable search_path fix (ops_exception_watch).
-- 5) admin-family SECURITY DEFINER fns se anon EXECUTE revoke.
-- 6) hot FK/join columns par indexes (PostgREST timeouts kam karne).
-- =====================================================================

-- (1) GATEWAY: sirf service_role
revoke execute on function public.admin_gateway_exec(text, jsonb, text) from public, anon, authenticated;
grant  execute on function public.admin_gateway_exec(text, jsonb, text) to service_role, postgres;

-- (2) ADMIN NOTIFICATIONS grants (+ sequence for insert)
grant select, insert, update, delete on public.admin_notifications to authenticated, service_role;
grant usage, select on sequence public.admin_notifications_id_seq to authenticated, service_role;

-- (3) server-only tables: client roles se band
do $$ declare t text;
begin
  foreach t in array array['user_push_tokens','season_finalizations','suggestion_rewards'] loop
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;
end $$;

-- (4) mutable search_path
do $$ declare r record;
begin
  for r in select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'ops_exception_watch' and p.prosecdef loop
    execute format('alter function public.%I(%s) set search_path = public', r.proname, r.args);
  end loop;
end $$;

-- (5) admin-family definers se anon execute revoke
do $$ declare r record; n int := 0;
begin
  for r in select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args
           from pg_proc p join pg_namespace nn on nn.oid = p.pronamespace
          where nn.nspname = 'public' and p.prosecdef
            and (p.proname like 'admin\_%'
                 or p.proname in ('admin_gateway_exec','resolve_sd_request','release_eligible_commissions',
                                  'approve_premium','cancel_premium','approve_creator_application',
                                  'reject_creator_application','publish_match_results','correct_match_result',
                                  'cancel_match_with_refunds','set_user_ban_status','admin_adjust_wallet',
                                  'admin_reward_suggestion','admin_send_notification',
                                  'admin_send_broadcast_notification','admin_create_sponsored_match',
                                  'admin_distribute_sponsored_prize','resolve_sponsored_withdrawal')) loop
    execute format('revoke execute on function public.%I(%s) from anon', r.proname, r.args);
    n := n + 1;
  end loop;
  raise notice 'anon-revoked definers: %', n;
end $$;

-- (6) indexes for timeout relief
create index if not exists idx_jr_match      on public.join_requests (match_id);
create index if not exists idx_jr_user       on public.join_requests (user_id);
create index if not exists idx_notif_user_ts on public.notifications (user_id, created_at desc);
create index if not exists idx_chat_match    on public.match_chat (match_id);
create index if not exists idx_chat_user     on public.match_chat (user_id);
create index if not exists idx_wtx_user_ts   on public.wallet_transactions (user_id, created_at desc);
create index if not exists idx_sd_user       on public.sd_requests (user_id);
create index if not exists idx_sm_ticket     on public.support_messages (ticket_id);

select json_build_object(
  'gateway_grants', (select coalesce(json_agg(grantee), '[]'::json) from information_schema.routine_privileges where specific_schema='public' and routine_name='admin_gateway_exec' and privilege_type='EXECUTE'),
  'notif_grants', (select coalesce(json_agg(grantee), '[]'::json) from information_schema.table_privileges where table_name='admin_notifications' and grantee in ('authenticated','service_role')),
  'anon_on_gateway', (select has_function_privilege('anon', oid, 'execute') from pg_proc where proname='admin_gateway_exec'),
  'anon_admin_fns_left', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.proname like 'admin\_%' and has_function_privilege('anon', p.oid, 'execute')),
  'mutable_sp_left', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and coalesce(p.proconfig,'{}')::text not like '%search_path%'),
  'new_indexes', (select count(*) from pg_indexes where schemaname='public' and indexname in ('idx_jr_match','idx_jr_user','idx_notif_user_ts','idx_chat_match','idx_chat_user','idx_wtx_user_ts','idx_sd_user','idx_sm_ticket'))
) as harden_proof;
