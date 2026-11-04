delete from public.notifications where user_id='ykAk1iSmYtMdzUlIPSs9AEwGDH62';
delete from public.user_push_tokens where user_id='ykAk1iSmYtMdzUlIPSs9AEwGDH62';
delete from public.admins where uid='ykAk1iSmYtMdzUlIPSs9AEwGDH62';
delete from public.users where id='ykAk1iSmYtMdzUlIPSs9AEwGDH62';
select public.admin_notify('📱 Admin panel mobile deep-sweep complete + LIVE Chat Log file ready', 'D41: (1) Aapki LIVE Chat Log Google Doc ban gayi — har reply ke baad update hogi, same link hamesha (purana PDF archive me). (2) Admin panel ki poori mobile sweep (390px touch, 25 sections): koi horizontal overflow nahi, koi stuck modal nahi, koi console error nahi; PNG proofs reports/mobile/d41/. (3) Chhote findings: 10 tiny tap-targets (creatorApplications 2, systemSettings 8) — fix queue me; Devanagari tofu sirf test-sandbox font gap tha (proof: font daal kar re-shot clean). (4) Temp QA admin m41 delete kar diya — admins me sirf aap.', 'session_end') as notified;
select jsonb_build_object('m41_left', (select count(*) from public.users where id='ykAk1iSmYtMdzUlIPSs9AEwGDH62'), 'admins_now', (select count(*) from public.admins where is_active)) as m41_cleanup_proof;
