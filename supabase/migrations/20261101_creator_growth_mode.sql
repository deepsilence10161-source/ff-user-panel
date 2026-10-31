-- =====================================================================
-- 2026-11-01 CREATOR GROWTH MODE (owner decision):
--   Creator Mode abhi ke liye FREE — chhote YouTubers/creators khud
--   interested hon aur app grow kare. app_settings.creator_system me
--   creatorFreeMode=1 merge (baaki values untouched). Admin panel →
--   App Settings → Creator section → "🆓 Creator Mode FREE" = 0 karne
--   par wapas normal (Gold Premium gate).
-- User panel gate: premium-creator.js showCreatorSignup() ab ye flag
-- on-demand padhta hai (1 → bina premium signup form + FREE banner).
-- =====================================================================

insert into public.app_settings (key, value, updated_at)
values ('creator_system', '{"creatorFreeMode": 1}'::jsonb, now())
on conflict (key) do update
   set value = coalesce(public.app_settings.value, '{}'::jsonb) || '{"creatorFreeMode": 1}'::jsonb,
       updated_at = now();

select json_build_object(
  'creator_free_mode',  (select value->>'creatorFreeMode' from public.app_settings where key = 'creator_system'),
  'all_keys',           (select coalesce(json_agg(k), '[]'::json) from (select jsonb_object_keys(value) k from public.app_settings where key = 'creator_system') x)
) as creator_growth_state;
