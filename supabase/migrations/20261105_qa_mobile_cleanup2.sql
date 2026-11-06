delete from public.user_push_tokens where token like 'DUMMY-E2E-TOKEN-%';
delete from public.admins where uid = 'MNTVkuiATOcFWBxw2kOuhk5DVcp1';
delete from public.notifications where user_id = 'MNTVkuiATOcFWBxw2kOuhk5DVcp1';
delete from public.users where id = 'MNTVkuiATOcFWBxw2kOuhk5DVcp1';
select public.admin_notify('Push system update', 'Device-push registration ab step-by-step feedback deta hai (1/3 permission, 2/3 FCM token, 3/3 server save) — koi step fail ho to laal toast me exact wajah dikhegi. Panel khula ho tab bhi alerts Notification se dikhengi. Ek baar panel reload karke 📲 dabaiye.', 'session_end') as notified;
select jsonb_build_object('admins_left', (select count(*) from public.admins), 'dummy_tokens', (select count(*) from public.user_push_tokens where token like 'DUMMY-E2E-TOKEN-%'), 'qa_left', (select count(*) from public.users where id='MNTVkuiATOcFWBxw2kOuhk5DVcp1')) as cleanup2_proof;
