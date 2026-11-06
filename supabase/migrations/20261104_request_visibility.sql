-- =====================================================================
-- REQUEST VISIBILITY (2026-11-04) — owner ka complaint:
--   "user ki creator/premium request admin panel me nahi dikh rahi"
-- Fix:
--   1) creator_applications / premium_requests / season_pass_requests
--      par INSERT trigger → admin_notify (bell + DEVICE PUSH turant,
--      admin panel khula ho ya na ho).
--   2) season_pass_requests par admin SELECT policy confirm/add
--      (admin panel ka Season Pass list authenticated role se padhta hai).
--   3) Hunter7 (owner ka USER account, uid TyHtz…) ko normal user
--      banao: is_creator=false, premium_level=0, premium_expires=null,
--      creator_code=null — owner ka saaf order: "Hunter7 ko normal
--      user ki tarah treat kar".
-- =====================================================================

-- (1) trigger: har nayi request par owner ko bell + push
create or replace function public.trg_request_admin_alert() returns trigger
language plpgsql security definer set search_path='public' as $$
declare
  v_ign text; v_title text; v_body text;
begin
  begin
    select ign into v_ign from public.users where id = new.user_id;
  exception when others then v_ign := null;
  end;
  v_ign := coalesce(v_ign, left(new.user_id, 8));

  if tg_table_name = 'creator_applications' then
    v_title := '🎬 नई Creator Application — ' || v_ign;
    v_body  := 'Code: ' || coalesce(new.creator_code,'—')
            || ' • Followers: ' || coalesce(new.followers,'—')
            || ' • Channel: ' || coalesce(left(new.channel_url,60),'—')
            || ' — Admin Panel → Creator Applications';
  elsif tg_table_name = 'premium_requests' then
    v_title := '👑 नई Premium Request — ' || coalesce(new.user_name, v_ign);
    v_body  := 'Tier ' || new.tier || ' • ₹' || new.price
            || ' • UTR: ' || coalesce(new.utr,'—')
            || ' — Admin Panel → Premium Requests';
  elsif tg_table_name = 'season_pass_requests' then
    v_title := '🎫 नई Season Pass Request — ' || coalesce(new.ign, v_ign);
    v_body  := 'Season: ' || coalesce(new.season_key,'—') || ' • ₹' || new.price
            || ' — Admin Panel → Season Pass';
  else
    return new;
  end if;

  begin
    perform public.admin_notify(v_title, v_body, 'work');
  exception when others then
    -- alert fail ho to request insert KABHI block na ho
    null;
  end;
  return new;
end $$;

drop trigger if exists trg_ca_admin_alert on public.creator_applications;
create trigger trg_ca_admin_alert after insert on public.creator_applications
  for each row execute function public.trg_request_admin_alert();

drop trigger if exists trg_pr_admin_alert on public.premium_requests;
create trigger trg_pr_admin_alert after insert on public.premium_requests
  for each row execute function public.trg_request_admin_alert();

drop trigger if exists trg_sp_admin_alert on public.season_pass_requests;
create trigger trg_sp_admin_alert after insert on public.season_pass_requests
  for each row execute function public.trg_request_admin_alert();

-- (2) season_pass_requests: admin ke liye SELECT policy pakki karo
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                 and tablename='season_pass_requests' and policyname='spr_select_admin') then
    -- purani spr_select_own me admin-OR clause hai ya nahi, confirm nahi tha —
    -- permissive policies OR hoti hain, isliye alag admin policy safe hai
    execute 'create policy spr_select_admin on public.season_pass_requests
             for select to anon, authenticated
             using (exists (select 1 from public.users au
                            where au.id = (auth.jwt() ->> ''sub'') and au.is_admin = true))';
  end if;
end $$;

-- (3) Hunter7 → normal user
update public.users
   set is_creator = false,
       premium_level = 0,
       premium_expires = null,
       creator_code = null
 where id = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3';

-- proof (last statement — dump yahi dikhata hai)
select jsonb_build_object(
  'triggers', (select coalesce(jsonb_agg(t.tgname),'[]'::jsonb) from pg_trigger t
                where not t.tgisinternal and t.tgrelid in
                ('public.creator_applications'::regclass,'public.premium_requests'::regclass,'public.season_pass_requests'::regclass)),
  'hunter7', (select to_jsonb(x) from (select ign, is_admin, is_creator, premium_level, premium_expires, creator_code
                                         from public.users where id='TyHtzFOnggMxWbEdTnTdEl2j7oF3') x),
  'sp_admin_policy', (select count(*) from pg_policies where schemaname='public' and tablename='season_pass_requests' and policyname='spr_select_admin'),
  'users_notnull_nodefault', (select coalesce(jsonb_agg(column_name),'[]'::jsonb) from information_schema.columns
                               where table_schema='public' and table_name='users' and is_nullable='NO' and column_default is null)
) as reqvis_proof;
