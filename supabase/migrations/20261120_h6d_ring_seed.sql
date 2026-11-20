-- 20261120_h6d_ring_seed.sql — H6d ring cosmetics ka PERMANENT seed
--
-- Wajah (2026-11-20): `purchase_cosmetic` rpc `unknown_cosmetic` de raha tha
-- kyunki 9 `frame_ring_*` keys DB me the hi nahi. Live DB me manually merge
-- kiye gaye the (TRI H6d green), lekin admin panel ke "App Settings reset"
-- se live_config dobara default par ja sakta hai — isliye ab repo me seed
-- migration hai. Idempotent: dobara chalane se sirf missing keys wapas aa
-- jayengi, existing prices touch nahi hongi.
--
-- Chalane ka tareeka: Supabase SQL editor (ya CLI) me project
-- hddhkculuyrfoevxmlwy par execute karo.

-- 1) app_settings key = 'cosmetic_prices'
insert into app_settings (key, value, updated_by)
values ('cosmetic_prices', jsonb_build_object(
    'frame_ring_bronze',      jsonb_build_object('name', 'Bronze Ring',          'price', 60),
    'frame_ring_silver',      jsonb_build_object('name', 'Silver Ring',          'price', 80),
    'frame_ring_gold',        jsonb_build_object('name', 'Gold Ring',            'price', 100),
    'frame_ring_platinum',    jsonb_build_object('name', 'Platinum Ring',        'price', 130),
    'frame_ring_diamond',     jsonb_build_object('name', 'Diamond Ring',         'price', 160),
    'frame_ring_legend',      jsonb_build_object('name', 'Legend Ring',          'price', 200),
    'frame_ring_prem_silver', jsonb_build_object('name', 'Premium Silver Ring',  'price', 120),
    'frame_ring_prem_gold',   jsonb_build_object('name', 'Premium Gold Ring',    'price', 180),
    'frame_ring_prem_diamond',jsonb_build_object('name', 'Premium Diamond Ring', 'price', 250)
  ), 'seed-migration')
on conflict (key) do update
set value = coalesce(app_settings.value, '{}'::jsonb) || excluded.value,
    updated_by = 'seed-migration',
    updated_at = now();

-- 2) app_settings key = 'live_config' → value->'cosmetics' ke andar same 9 keys
insert into app_settings (key, value, updated_by)
values ('live_config', jsonb_build_object('cosmetics', jsonb_build_object(
    'frame_ring_bronze',      jsonb_build_object('name', 'Bronze Ring',          'price', 60),
    'frame_ring_silver',      jsonb_build_object('name', 'Silver Ring',          'price', 80),
    'frame_ring_gold',        jsonb_build_object('name', 'Gold Ring',            'price', 100),
    'frame_ring_platinum',    jsonb_build_object('name', 'Platinum Ring',        'price', 130),
    'frame_ring_diamond',     jsonb_build_object('name', 'Diamond Ring',         'price', 160),
    'frame_ring_legend',      jsonb_build_object('name', 'Legend Ring',          'price', 200),
    'frame_ring_prem_silver', jsonb_build_object('name', 'Premium Silver Ring',  'price', 120),
    'frame_ring_prem_gold',   jsonb_build_object('name', 'Premium Gold Ring',    'price', 180),
    'frame_ring_prem_diamond',jsonb_build_object('name', 'Premium Diamond Ring', 'price', 250)
  )), 'seed-migration')
on conflict (key) do update
set value = jsonb_set(
      coalesce(app_settings.value, '{}'::jsonb),
      '{cosmetics}',
      coalesce(app_settings.value->'cosmetics', '{}'::jsonb) || (excluded.value->'cosmetics')
    ),
    updated_by = 'seed-migration',
    updated_at = now();

-- 3) Verify helper (manual):
--    select c.key, c.value from app_settings s, jsonb_each(s.value->'cosmetics') c
--      where s.key='live_config' and c.key like 'frame_ring%';
--    → 9 rows chahiye.
