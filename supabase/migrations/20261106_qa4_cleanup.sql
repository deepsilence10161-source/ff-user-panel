delete from public.admins where uid = 'n0KipyMJH3UnqfKFJhKRM8leRtY2';
delete from public.notifications where user_id = 'n0KipyMJH3UnqfKFJhKRM8leRtY2';
delete from public.users where id = 'n0KipyMJH3UnqfKFJhKRM8leRtY2';
select public.admin_notify('Asli push bug mil gayi thi', 'Admin panel ka Firebase app named ("adminPanel") hai aur push module default app maang raha tha — isliye HAR device par token registration fail hoti thi (chupchaap). Fix live: named app use hota hai. Ab panel reload karke 📲 dabaiye → Allow → test push phone par aayegi. Swipe-hint spam + floating Save/Cancel bhi hat chuke hain (live verified).', 'session_end') as notified;
select jsonb_build_object('admins_left', (select count(*) from public.admins), 'qa_left', (select count(*) from public.users where id='n0KipyMJH3UnqfKFJhKRM8leRtY2')) as c4_proof;
