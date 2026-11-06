-- H7: (1) purane admin_notify ne jo admin_alert rows Hunter7 ki
-- notifications me likhi thi (aakhri end-alert tak), saaf karo —
-- Hunter7 = simple user. (2) D32 ka end-alert admin_notify v2 se.
delete from public.notifications
 where user_id = 'TyHtzFOnggMxWbEdTnTdEl2j7oF3' and type = 'admin_alert';
select public.admin_notify('D32 session complete', 'Security report #2 fixes + admin device push + chat-log Drive par — sab live-verified. Hunter7 ki admin_alert rows bhi saaf.', 'session_end') as notified;
select jsonb_build_object('hunter7_admin_alerts_left', (select count(*) from public.notifications where user_id='TyHtzFOnggMxWbEdTnTdEl2j7oF3' and type='admin_alert')) as h7_proof;
