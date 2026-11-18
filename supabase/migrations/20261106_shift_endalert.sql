select public.admin_notify('📋 Ops alerts ab ADMIN PANEL par', 'Aapke order se: (1) ops_notify ab Hunter7 par nahi, seedha admin panel ki bell + aapke device push par likhta hai; (2) Hunter7 par padi purani 4 ops alerts (room-ID urgent, room-time, digest, room-ID baaki) admin panel me shift ho gayi hain; (3) Hunter7 ka notifications kholra AB KHALI hai (0 rows). Live test pass: admin_panel_row=1, push_mirror=1, hunter7=0. Purana dead Chrome token FCM ne khud prune kiya — panel khula hote hi naya token khud register hoga.', 'ops_shift') as notified;
select jsonb_build_object(
 'tokens_now', (select coalesce(jsonb_agg(jsonb_build_array(left(token::text,14), platform, updated_at)),'[]'::jsonb) from (select token, platform, updated_at from public.user_push_tokens order by updated_at desc limit 5) t),
 'hunter7_final', (select count(*) from public.notifications where user_id='TyHtzFOnggMxWbEdTnTdEl2j7oF3'),
 'panel_ops', (select count(*) from public.admin_notifications where kind='ops'),
 'panel_total', (select count(*) from public.admin_notifications)
) as final_proof;
