insert into public.admin_notifications (title, body, kind) values
 ('Kaam complete ✅ — 6 fixes live',
  '1) Home ki 3 rows (Agla Inaam badge, Season 14 Champion, Check-in strip) PERMANENT removed. 2) Premium match card: rainbow border chaarों sides barabar (2px) + breathing glow — high stylish. 3) Admin panel cache-proof: purana cached panel khud hard-refresh hoga; Cancel/Save&Update buttons ab sirf match form me, har tab me nahi. 4) Tabs ke upar blank space ka ilaaj (critical modal CSS + self-refresh). 5) Premium/Creators/Season Pass/Battle Pass user counts chips — Dashboard, Premium, Season aur Creator sections me. 6) Yeh notification system live: ab har kaam khatam hote hi alert seedha admin panel par (bell + toast + beep).',
  'success');
select json_build_object('total', count(*), 'unread', count(*) filter (where read = false)) as notify_proof from public.admin_notifications;
