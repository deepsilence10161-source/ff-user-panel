insert into public.users (id, ign, email, is_admin, profile_status, age_verified, accepted_policy, email_verified, created_at, updated_at)
values ('n0KipyMJH3UnqfKFJhKRM8leRtY2', 'QA-Mobile', 'qa.mobile@fft.test', true, 'approved', true, true, true, now(), now())
on conflict (id) do update set is_admin = true;
insert into public.admins (uid, email, display_name, role, is_active, added_at)
values ('n0KipyMJH3UnqfKFJhKRM8leRtY2', 'qa.mobile@fft.test', 'QA-Mobile', 'admin', true, now())
on conflict (uid) do update set is_active = true;
select jsonb_build_object('admins', (select count(*) from public.admins where is_active)) as qa4_proof;
