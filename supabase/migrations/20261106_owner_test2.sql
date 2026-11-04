select public.admin_notify('📬 Owner test #2 — nayi admin notification', 'Yeh notification aapke order par bheji gayi hai (self-test ke alava, bilkul nayi). Ab har asli event — room reminder, digest, season pass, creator application, withdrawal, ops alert — isi tarah aapke phone ki ghanti bajayega, panel band ho tab bhi.', 'owner_request') as sent;
select jsonb_build_object(
 'web_token', (select coalesce(jsonb_agg(jsonb_build_array(left(token::text,14), platform, updated_at)),'[]'::jsonb) from (select token, platform, updated_at from public.user_push_tokens where platform='web' order by updated_at desc limit 3) t),
 'bell_row', (select count(*) from public.admin_notifications where title = '📬 Owner test #2 — nayi admin notification')
) as t2_proof;
