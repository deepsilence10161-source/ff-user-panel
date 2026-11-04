-- TEMPORARY QA admin (mobile UI audit ke liye) — audit ke baad turant delete.
insert into public.users (id, ign, email, is_admin, profile_status, age_verified, accepted_policy, email_verified, created_at, updated_at)
values ('7T5KCAgylDQH0ey3QB5jbt3kks13', 'QA-Mobile', 'qa.mobile@fft.test', true, 'approved', true, true, true, now(), now())
on conflict (id) do update set is_admin = true;
insert into public.admins (uid, email, display_name, role, is_active, added_at)
values ('7T5KCAgylDQH0ey3QB5jbt3kks13', 'qa.mobile@fft.test', 'QA-Mobile', 'admin', true, now())
on conflict (uid) do update set is_active = true;
select jsonb_build_object('admins_now', (select count(*) from public.admins where is_active)) as qa_mobile_proof;
