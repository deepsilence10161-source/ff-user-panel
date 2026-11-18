/* ══════════════════════════════════════════════════════════════════
   D36 (owner order, 04 Nov ~19:15 IST): "Saari admin notifications
   admin panel par. Shift karde jo jo Hunter7 par shift hai ya thi."
   1) ops_notify ab ADMIN PANEL (admin_notifications) me likhta hai +
      admin device push ke liye is_admin users ke notifications me
      (ref-dedup bana raha). Hunter7/normal users ko kuch NAHI.
   2) Hunter7 par padi purani 4 ops rows → admin_notifications shift,
      phir Hunter7 se delete. Kisi bhi non-admin par ops row na bache.
   3) Live test: ops_notify call → proof → test rows cleanup.
   ══════════════════════════════════════════════════════════════════ */
create or replace function public.ops_notify(p_uid text, p_title text, p_body text, p_ref text)
returns void language plpgsql security definer set search_path=public as $$
begin
  /* ref-dedup (purana behaviour) — admin_alert mirror par check */
  if exists (select 1 from public.notifications where ref_id = p_ref and type = 'admin_alert') then return; end if;
  /* ADMIN PANEL bell */
  insert into public.admin_notifications (title, body, kind) values (p_title, p_body, 'ops');
  /* ADMIN DEVICE PUSH (token admin uid par hain) */
  insert into public.notifications (user_id, type, title, body, ref_id)
  select u.id, 'admin_alert', p_title, p_body, p_ref
    from public.users u where u.is_admin;
end $$;

/* 2) purani ops rows Hunter7 (aur kisi bhi non-admin) se → admin panel */
insert into public.admin_notifications (title, body, kind, created_at)
select n.title, n.body, 'ops', n.created_at
  from public.notifications n
 where n.type = 'ops'
   and n.user_id not in (select id from public.users where is_admin)
   and not exists (select 1 from public.admin_notifications a
                    where a.kind = 'ops' and a.title = n.title and a.body = n.body);
delete from public.notifications
 where type = 'ops'
   and user_id not in (select id from public.users where is_admin);

/* 3) LIVE TEST + proof + cleanup */
select public.ops_notify('ignored-uid', '🧪 Ops shift test', 'Yeh ops alert ab ADMIN PANEL par aata hai (Hunter7 par nahi). Shift ka live test.', 'shift-test-20261106');
select jsonb_build_object(
  'admin_panel_row', (select count(*) from public.admin_notifications where title = '🧪 Ops shift test'),
  'admin_push_mirror', (select count(*) from public.notifications where ref_id = 'shift-test-20261106' and user_id in (select id from public.users where is_admin)),
  'hunter7_ops_left', (select count(*) from public.notifications where type = 'ops' and user_id = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3'),
  'any_nonadmin_ops_left', (select count(*) from public.notifications where type = 'ops' and user_id not in (select id from public.users where is_admin)),
  'hunter7_total_left', (select count(*) from public.notifications where user_id = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3'),
  'shifted_ops_in_panel', (select count(*) from public.admin_notifications where kind = 'ops')
) as shift_proof;
delete from public.admin_notifications where title = '🧪 Ops shift test';
delete from public.notifications where ref_id = 'shift-test-20261106';
