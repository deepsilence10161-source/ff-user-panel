-- HARDENING 2/2 — leftovers: PUBLIC-route se anon ko bache 5 admin fns
-- ka EXECUTE, aur 7 mutable search_path definer fns ka pinning.

revoke execute on function public.admin_create_sponsored_match(text,text,text,integer,timestamptz,numeric,numeric,numeric,text,text,text,numeric) from public, anon;
revoke execute on function public.admin_distribute_sponsored_prize(text,numeric,text,text,text) from public, anon;
revoke execute on function public.admin_match_interests(text) from public, anon;
revoke execute on function public.admin_notify(text,text,text) from public, anon;
revoke execute on function public.admin_start_new_season(text,integer) from public, anon;

alter function public.ops_daily_digest() set search_path = 'public';
alter function public.ops_notify(text,text,text,text) set search_path = 'public';
alter function public.ops_auto_cancel_stale() set search_path = 'public';
alter function public.ops_chat_watch() set search_path = 'public';
alter function public.ops_checkin_watch() set search_path = 'public';
alter function public.user_restore_account(text) set search_path = 'public';
alter function public.ops_room_reminder() set search_path = 'public';

select json_build_object(
  'anon_admin_left', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and p.proname like 'admin\_%' and has_function_privilege('anon', p.oid, 'execute')),
  'mutable_sp_left', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and coalesce(p.proconfig,'{}')::text not like '%search_path%'),
  'gw_grants', (select coalesce(json_agg(grantee),'[]'::json) from information_schema.routine_privileges where routine_name='admin_gateway_exec' and privilege_type='EXECUTE' and grantee in ('anon','authenticated','service_role')),
  'owner_bell', (select public.admin_notify('🛡️ Security hardening LIVE','Gateway sirf service_role • bell grants • 8 indexes • search_path sab fixed • anon admin-fn access 0. Full report chat me.','success') is not null)
) as harden2_proof;
