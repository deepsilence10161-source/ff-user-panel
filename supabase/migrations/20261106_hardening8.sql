-- HARDENING 8 (report #3, 04 Nov): 
-- (A) cron-only definers se anon/authenticated EXECUTE wapas lo
--     (ye sirf pg_cron/postgres + service_role se chalte hain);
-- (B) WATCH & EARN: asli watch-session binding — server-side heartbeat
--     ke bina reward nahi (report ka naya P1);
-- (C) AD REWARD: ad-session binding — ad_watch_start ke bina claim nahi;
-- (D) hot FK indexes.
do $$ declare n text;
begin
  foreach n in array array['release_due_rooms','sync_match_statuses','fn_emit_universal_pulse',
    'emit_join_event','cleanup_live_join_events','declare_season_champion','send_season_ending_alerts',
    'send_trial_expiry_alerts','internal_process_no_show_refunds','fn_fulfill_paytm_purpose',
    'fn_referral_match_bonus'] loop
    begin
      execute format('revoke execute on function public.%I(text) from anon, authenticated', n);
    exception when others then
      begin execute format('revoke execute on function public.%I() from anon, authenticated', n);
      exception when others then null; end;
    end;
  end loop;
end $$;

-- (B) watch sessions
create table if not exists public.watch_earn_sessions (
  id bigserial primary key,
  uid text not null,
  match_id text not null,
  started_at timestamptz not null default now(),
  last_beat timestamptz not null default now(),
  closed_at timestamptz
);
create unique index if not exists uq_wes_open on public.watch_earn_sessions(uid, match_id) where closed_at is null;
alter table public.watch_earn_sessions enable row level security;

create or replace function public.watch_earn_beat(p_match_id text) returns jsonb
language plpgsql security definer set search_path='public' as $$
declare v_uid text;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'Not authorized'); end if;
  insert into public.watch_earn_sessions(uid, match_id) values (v_uid, p_match_id)
  on conflict (uid, match_id) where closed_at is null
  do update set last_beat = now();
  return jsonb_build_object('success', true);
end $$;
grant execute on function public.watch_earn_beat(text) to anon, authenticated;

alter function public.claim_watch_earn_reward(text) rename to claim_watch_earn_inner;
revoke execute on function public.claim_watch_earn_inner(text) from anon, authenticated;

create or replace function public.claim_watch_earn_reward(p_match_id text) returns jsonb
language plpgsql security definer set search_path='public' as $$
declare v_uid text; v_started timestamptz; v_beat timestamptz;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'Not authorized'); end if;
  select started_at, last_beat into v_started, v_beat
    from public.watch_earn_sessions
   where uid = v_uid and match_id = p_match_id and closed_at is null
   order by started_at desc limit 1;
  if v_started is null then
    return jsonb_build_object('success', false, 'error', 'watch session not active');
  end if;
  if now() - v_beat > interval '100 seconds' then
    return jsonb_build_object('success', false, 'error', 'watch session stale — match live dekhte rahiye');
  end if;
  if now() - v_started < interval '45 seconds' then
    return jsonb_build_object('success', false, 'error', 'abhi watch shuru hua — thodi der me reward');
  end if;
  return public.claim_watch_earn_inner(p_match_id);
end $$;
grant execute on function public.claim_watch_earn_reward(text) to anon, authenticated;

-- (C) ad sessions
create table if not exists public.ad_watch_sessions (
  id bigserial primary key,
  uid text not null,
  started_at timestamptz not null default now(),
  consumed boolean not null default false
);
create index if not exists idx_ads_uid_open on public.ad_watch_sessions(uid) where consumed = false;
alter table public.ad_watch_sessions enable row level security;

create or replace function public.ad_watch_start() returns jsonb
language plpgsql security definer set search_path='public' as $$
declare v_uid text; v_id bigint;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'Not authorized'); end if;
  insert into public.ad_watch_sessions(uid) values (v_uid) returning id into v_id;
  return jsonb_build_object('success', true, 'session', v_id);
end $$;
grant execute on function public.ad_watch_start() to anon, authenticated;

create or replace function public.claim_ad_reward() returns jsonb
language plpgsql security definer set search_path='public' as $$
declare v_uid text; v_org text; v_hdrs jsonb; v_sid bigint;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then return jsonb_build_object('success', false, 'error', 'Not authorized'); end if;
  begin
    v_hdrs := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then v_hdrs := null; end;
  v_org := coalesce(current_setting('request.header.origin', true), v_hdrs ->> 'origin', '');
  if v_org not like '%deepsilence10161-source.github.io%' then
    return jsonb_build_object('success', false, 'error', 'origin not allowed');
  end if;
  select id into v_sid from public.ad_watch_sessions
   where uid = v_uid and not consumed
     and started_at between now() - interval '150 seconds' and now() - interval '4 seconds'
   order by started_at desc limit 1;
  if v_sid is null then
    return jsonb_build_object('success', false, 'error', 'no active ad session — pehle ad dekhiye');
  end if;
  update public.ad_watch_sessions set consumed = true where id = v_sid;
  return public.claim_ad_reward_inner();
end $$;

-- (D) hot FK indexes
create index if not exists idx_sm_ticket on public.support_messages(ticket_id);
create index if not exists idx_wel_user on public.watch_earn_log(user_id);
create index if not exists idx_arl_user on public.ad_reward_log(user_id);
create index if not exists idx_pr_user on public.premium_requests(user_id);
create index if not exists idx_ca_user on public.creator_applications(user_id);

select jsonb_build_object(
  'we_wrapper', (select count(*) from pg_proc where proname='claim_watch_earn_reward' and prosrc like '%watch session not active%'),
  'ad_wrapper', (select count(*) from pg_proc where proname='claim_ad_reward' and prosrc like '%no active ad session%'),
  'cron_revoked', (select count(*) from pg_proc p where p.proname in ('release_due_rooms','sync_match_statuses','declare_season_champion','internal_process_no_show_refunds') and not has_function_privilege('anon', p.oid, 'execute')),
  'idx', (select count(*) from pg_indexes where indexname in ('idx_sm_ticket','idx_wel_user','idx_arl_user','idx_pr_user','idx_ca_user'))
) as h8_proof;
