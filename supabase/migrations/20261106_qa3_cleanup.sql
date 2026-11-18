delete from public.admins where uid = 'g7WI1DfU38Q8t09knJLO2o4Hjwf1';
delete from public.notifications where user_id = 'g7WI1DfU38Q8t09knJLO2o4Hjwf1';
delete from public.users where id = 'g7WI1DfU38Q8t09knJLO2o4Hjwf1';
select public.admin_notify('UI drama fix complete', 'Swipe-hint spam hata diya, modals ab section badalte hi band hote hain (Save/Cancel float nahi hoga), push guide me aasan steps + registration ke baad self-test alert. Sab mobile-size par live verify + PNG.', 'session_end') as notified;
select jsonb_build_object('admins_left', (select count(*) from public.admins), 'qa_left', (select count(*) from public.users where id='g7WI1DfU38Q8t09knJLO2o4Hjwf1')) as c3_proof;
