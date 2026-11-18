delete from public.battle_pass_progress where user_id='IEjEYy5o66Z2tJBy7L9UYdDW4UA2';
delete from public.notifications where user_id='IEjEYy5o66Z2tJBy7L9UYdDW4UA2';
delete from public.user_push_tokens where user_id='IEjEYy5o66Z2tJBy7L9UYdDW4UA2';
delete from public.users where id='IEjEYy5o66Z2tJBy7L9UYdDW4UA2';
select public.admin_notify('🃏 Profile card v2 LIVE — exact replica', 'Aapki bheji hui design ka 100% exact profile card ab app me permanently hai: (1) modal player-card, (2) Share Card image — dono wahi art, wahi layout: crown+diamond emblem, PRO PLAYER plate, name+verified+crown, UID pill+copy, Lv hexagon, tier pill, XP bar, 5-stat neon bar. Live E2E: QA user se login karke modal khola (PNG proof), share-canvas draw bhi pass. Naam/UID/stats har user ke apne dikhte hain; lambe naam auto-fit hote hain. QA temp user delete kar diya gaya hai.', 'session_end') as notified;
select jsonb_build_object('qa5_left', (select count(*) from public.users where id='IEjEYy5o66Z2tJBy7L9UYdDW4UA2')) as c5_proof;
