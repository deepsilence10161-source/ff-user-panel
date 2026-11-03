-- =====================================================================
-- HARDENING 3 (D32, 05-Nov-2026) — engineer report #2 ke P1/P2 fixes
-- ---------------------------------------------------------------------
-- 1) admin_notify v2: purana body har admin alert ki ek copy
--    `notifications` me Hunter7 (TyHtz…) ke naam daalta tha → owner ke
--    NORMAL user profile me admin alerts ja rahe the. Ab: bell row +
--    notifications sirf un uids ko jin ke users.is_admin = true
--    (push trigger unhi ke device tokens par bhejta hai — admin panel
--    se registered tokens). Hunter7 = simple user, kuch nahi milega.
-- 2) claim_ad_reward: rename→inner + outer wrapper jo (a) jwt-sub
--    strict, (b) browser Origin allow-list check karta hai (seedha
--    curl/REST se farm karna band), anon EXECUTE revoke.
--    (Asli ad-provider server-verification web AdMob me available
--    nahi; economic cap + serialization + origin-bind + daily limit
--    = practical mitigation, report ko bhi yahi chahiye tha:
--    idempotency/duplicate-rok already ad_reward_log se hai.)
-- 3) claim_match_refund: outer wrapper — p_uid bheja hi tab accept
--    jab wo JWT sub se match kare; warna sirf JWT sub use hota hai.
-- 4) wallet_transactions duplicate index: idx_wtx_user_ts (scan=90)
--    drop; idx_wt_user_date (scan=29370) retained — usage-proof ke saath.
-- 5) SAARE public SECURITY DEFINER functions se anon EXECUTE revoke
--    (engineer: 107 anon definers). User flows authenticated role se
--    chalte hain (Firebase JWT), anon ko koi rpc zaroorat nahi.
--    Mere tmp_probe_* functions bhi drop.
-- =====================================================================

-- (0) probe litter saaf
drop function if exists public.tmp_probe_r2();
drop function if exists public.tmp_probe_reqflow();
drop function if exists public.tmp_probe_reqflow2();

-- (1) admin_notify v2
create or replace function public.admin_notify(p_title text, p_body text, p_kind text default 'info')
returns jsonb language plpgsql security definer set search_path='public' as $$
declare v_uid text; v_n int := 0;
begin
  insert into public.admin_notifications (title, body, kind)
  values (p_title, p_body, coalesce(p_kind,'info'));
  for v_uid in select id from public.users where is_admin = true loop
    insert into public.notifications (user_id, type, title, body)
    values (v_uid, 'admin_alert', p_title, p_body);
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'admins_notified', v_n);
end $$;

-- (2) claim_ad_reward wrapper
alter function public.claim_ad_reward() rename to claim_ad_reward_inner;
create function public.claim_ad_reward() returns jsonb
language plpgsql security definer set search_path='public' as $$
declare v_uid text; v_org text;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Not authorized');
  end if;
  v_org := coalesce(current_setting('request.header.origin', true), '');
  if v_org not like '%deepsilence10161-source.github.io%' then
    return jsonb_build_object('success', false, 'error', 'origin not allowed');
  end if;
  return public.claim_ad_reward_inner();
end $$;
revoke execute on function public.claim_ad_reward() from public, anon;
grant  execute on function public.claim_ad_reward() to authenticated;
revoke execute on function public.claim_ad_reward_inner() from public, anon, authenticated;

-- (3) claim_match_refund wrapper
alter function public.claim_match_refund(uuid, text) rename to claim_match_refund_inner;
create function public.claim_match_refund(p_join_id uuid, p_uid text) returns jsonb
language plpgsql security definer set search_path='public' as $$
declare v_uid text;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then
    return jsonb_build_object('success', false, 'error', 'Not authorized');
  end if;
  if p_uid is not null and p_uid <> v_uid then
    return jsonb_build_object('success', false, 'error', 'actor mismatch');
  end if;
  return public.claim_match_refund_inner(p_join_id, v_uid);
end $$;
revoke execute on function public.claim_match_refund(uuid, text) from public, anon;
grant  execute on function public.claim_match_refund(uuid, text) to authenticated;
revoke execute on function public.claim_match_refund_inner(uuid, text) from public, anon, authenticated;

-- (4) duplicate index
drop index if exists public.idx_wtx_user_ts;

-- (5) anon EXECUTE: sabhi public security definers se revoke
do $$ declare r record; n int := 0;
begin
  for r in select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) args
           from pg_proc p join pg_namespace nn on nn.oid = p.pronamespace
          where nn.nspname = 'public' and p.prosecdef loop
    execute format('revoke execute on function public.%I(%s) from anon', r.proname, r.args);
    n := n + 1;
  end loop;
  raise notice 'anon-revoked definers: %', n;
end $$;

-- proof (last statement)
select jsonb_build_object(
  'anon_definers_left', (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  'ad_outer', (select count(*) from pg_proc where proname='claim_ad_reward' and prosrc like '%origin not allowed%'),
  'refund_outer', (select count(*) from pg_proc where proname='claim_match_refund' and prosrc like '%actor mismatch%'),
  'wt_idx', (select coalesce(jsonb_agg(indexrelname),'[]'::jsonb) from pg_stat_user_indexes where relname='wallet_transactions'),
  'notify_src', (select left(prosrc,180) from pg_proc where proname='admin_notify')
) as h3_proof;
