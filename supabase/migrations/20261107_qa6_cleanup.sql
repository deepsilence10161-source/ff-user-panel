delete from public.battle_pass_progress where user_id='W2Gt9VTGCAWIboTf43vxR6Htmkz2';
delete from public.notifications where user_id='W2Gt9VTGCAWIboTf43vxR6Htmkz2';
delete from public.user_push_tokens where user_id='W2Gt9VTGCAWIboTf43vxR6Htmkz2';
delete from public.users where id='W2Gt9VTGCAWIboTf43vxR6Htmkz2';
select public.admin_notify('🃏 Profile card v2 — Profile tab inline bhi exact replica LIVE', 'Aapke roz wali Profile tab ki card bhi ab permanently nayi exact replica par hai: crown+diamond emblem, PRO PLAYER plate, naam+verified+crown, UID pill+copy, Lv hexagon, tier pill, XP bar, 5-stat neon bar — modal aur Share image ke bilkul same. Live E2E (QA login, PNG proof): inline card labels + pixel-exact art confirm; compliance sheets bypass karke poora Profile tab shot liya. QA temp user delete kar diya gaya hai.', 'session_end') as notified;
select jsonb_build_object('qa6_left', (select count(*) from public.users where id='W2Gt9VTGCAWIboTf43vxR6Htmkz2')) as c6_proof;
