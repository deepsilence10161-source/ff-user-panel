select jsonb_build_object(
 'hook_src', (select left(prosrc, 1500) from pg_proc where proname='notifications_push_hook' limit 1),
 'web_tokens', (select coalesce(jsonb_agg(jsonb_build_array(left(token::text,25), created_at)),'[]'::jsonb) from (select token, created_at from public.user_push_tokens where platform='web' order by created_at desc limit 4) x)
) as hook_probe;
