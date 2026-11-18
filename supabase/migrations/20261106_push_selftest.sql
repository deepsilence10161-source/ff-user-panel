-- Admin push self-test: sirf is_admin user khud ke liye test alert bana
-- sakta hai (trigger → push-send → uske device tokens).
create or replace function public.admin_push_selftest() returns jsonb
language plpgsql security definer set search_path='public' as $$
declare v_uid text; v_admin boolean;
begin
  v_uid := auth.jwt() ->> 'sub';
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'Not authorized'); end if;
  select is_admin into v_admin from public.users where id = v_uid;
  if not coalesce(v_admin, false) then return jsonb_build_object('ok', false, 'error', 'admin only'); end if;
  insert into public.notifications(user_id, type, title, body)
  values (v_uid, 'admin_alert', '📨 Push self-test', 'Ye test alert push-chain confirm karne ke liye hai — phone par notification aayi to sab sahi.');
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.admin_push_selftest() to anon, authenticated;
select jsonb_build_object('selftest_fn', (select count(*) from pg_proc where proname='admin_push_selftest')) as st_proof;
