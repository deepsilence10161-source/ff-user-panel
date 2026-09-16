-- ================================================================
-- DIAGNOSTIC + FIX — "Photo save failed — dobara try karo"
--   (ImgBB upload SUCCESS, banner_url save SUCCESS, sirf avatar_url fail)
-- Date: 2026-09-16
--
-- KYU: Client ka photo aur banner dono EK HI code path se guzarta hai
-- (core/imgbb.js → DB.users.updateImage), sirf target column alag hai:
--     UPDATE public.users SET avatar_url=?, updated_at=? WHERE id=auth.uid()
-- Banner save hota hai ⇒ row hai, RLS UPDATE allow karti hai, transport
-- theek hai. Avatar-only fail ⇒ problem avatar_url COLUMN ke saath judi
-- hai, aur woh sirf Postgres side ho sakti hai:
--   (a) users pe koi BEFORE UPDATE trigger avatar_url change pe exception
--       deta hai (sabse common: trigger profile_requests / moderation /
--       audit table me INSERT karta hai jiska FK auth.users(id) pe hai —
--       humare Firebase-uid users auth.users me kabhi hote hi nahi, to
--       har insert 23503 se explode karta hai aur poori UPDATE rollback),
--   (b) koi trigger avatar_url ko rewrite kar deta hai (NEW.avatar_url
--       ko NULL/placeholder set),
--   (c) avatar_url pe CHECK constraint / type limit jo i.ibb.co URL ko
--       reject kare,
--   (d) column rename/drop ho gaya ho (PostgREST: 42703).
--
-- KAISE USE KAREIN:
--   Supabase Dashboard → SQL Editor → New query → yeh poori file paste
--   → Run. Har section ka output screenshot leke share karo.
--   Sections 1–6 SIRF SELECT hain — kuch nahi badalte.
--   Section 7 me likely FIXES (commented) hain — diagnosis ke BAAD hi
--   uncomment karna.
-- ================================================================

-- ── 1) Dono image columns exist karte hain? type/length kya hai? ──
--    Agar avatar_url ka type character varying(chhota) hai ya row hi
--    missing hai → wohi culprit hai.
SELECT column_name, data_type, character_maximum_length, is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'users'
  AND column_name IN ('avatar_url', 'banner_url', 'updated_at');

-- ── 2) users table ke SAARE triggers + unka source ──
--    YEH SABSE IMPORTANT SECTION HAI. Koi bhi trigger jo avatar_url ko
--    touch kare, ya INSERT INTO profile_requests/audit/moderation kare,
--    yahan dikhega. Function source me dhundo:
--      INSERT INTO ... / NEW.avatar_url / RAISE EXCEPTION
SELECT tg.tgname                       AS trigger_name,
       tg.tgenabled                    AS enabled,   -- 'O'=on, 'D'=disabled
       pg_get_triggerdef(tg.oid)       AS fires_when,
       p.proname                       AS function_name,
       pg_get_functiondef(p.oid)       AS function_source
FROM pg_trigger tg
JOIN pg_class      c ON c.oid = tg.tgrelid
JOIN pg_namespace  n ON n.oid = c.relnamespace
LEFT JOIN pg_proc  p ON p.oid = tg.tgfoid
WHERE n.nspname = 'public'
  AND c.relname = 'users'
  AND NOT tg.tgisinternal;

-- ── 3) avatar_url pe CHECK constraints ──
SELECT con.conname              AS constraint_name,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class     c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'users'
  AND con.contype = 'c';   -- CHECK

-- ── 4) profile_requests (aur moderation/audit tables) ke FK ──
--    Agar user_id → auth.users(id) hai to woh Firebase users ke liye
--    HAMESHA fail karega (23503). Isi class ka bug pehle bhi aa chuka
--    hai (core/db.js users.create comments).
SELECT cl.relname                 AS table_name,
       con.conname                AS fk_name,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class cl ON cl.oid = con.conrelid
JOIN pg_namespace n ON n.oid = cl.relnamespace
WHERE n.nspname = 'public'
  AND con.contype = 'f'
  AND cl.relname IN ('profile_requests', 'profile_updates',
                     'moderation_queue', 'audit_log', 'audit_logs');

-- ── 5) users ke UPDATE RLS policies (row-level hote hain — dono columns
--    pe same lagna chahiye; alag-alag nahi) ──
SELECT policyname, cmd, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'users';

-- ── 6) PostgREST schema cache — column abhi ADD/DROP hua hai to cache
--    reload kar do (harmless, kabhi bhi chala sakte ho) ──
NOTIFY pgrst, 'reload schema';

-- ================================================================
-- SECTION 7 — LIKELY FIXES (sirf diagnosis confirm hone ke baad,
-- ek comment block hata ke na poora file dobara run karo)
-- ================================================================

-- FIX A — Agar section 2 me trigger mila jo PROFILE PHOTO change pe
-- profile_requests push karta hai AUR section 4 ne dikaya ki uska FK
-- auth.users se juda hai (yeh sabse likely culprit hai):
-- Client (screens/profile.js) verification requests khud
-- profile_requests me upsert karta hai — trigger ka duplicate kaam
-- zaroori nahi. Trigger drop karo:
--
--   DROP TRIGGER IF EXISTS <section_2_wala_trigger_name> ON public.users;
--   DROP FUNCTION IF EXISTS <section_2_wala_function_name>();
--
-- (Agar moderation ka feature genuinely server-side chahiye to trigger
--  function ko fix karo: public.users.id se reference karo, auth.users
--  se nahi — ya insert se pehle EXISTS check lagao.)

-- FIX B — Agar koi trigger avatar_url ko REWRITE karta hai
-- (client console me "[DB:users.updateImage] DB trigger ne avatar_url
--  rewrite kar diya" dikhega) — wahi trigger galat hai:
--
--   DROP TRIGGER IF EXISTS <trigger_name> ON public.users;
--   DROP FUNCTION IF EXISTS <function_name>();

-- FIX C — Agar section 1 me avatar_url ka length bahut chhota hai
-- (i.ibb.co URLs ~45 chars; safe margin ke saath 500 rakho):
--
--   ALTER TABLE public.users
--     ALTER COLUMN avatar_url TYPE varchar(500);

-- FIX D — Agar section 3 me avatar_url pe koi CHECK constraint mila jo
-- external URLs rokta hai (purana sanitization rule):
--
--   ALTER TABLE public.users DROP CONSTRAINT IF EXISTS <constraint_name>;
-- ================================================================
