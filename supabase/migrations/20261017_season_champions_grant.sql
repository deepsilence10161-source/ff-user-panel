/* ══════════════════════════════════════════════════════════════════════════
   ASLI BUG FIX (2026-10-17): season_champions par client ko SELECT grant hi
   nahi tha — is liye "Season Champion ka bada ailaan" banner kabhi dikh hi
   nahi sakta tha (har user ke liye, production me bhi).

   Kaise pakda gaya (TRI run 38991450631, live APK + web):
     • H15 ne asli row banayi (banner_until = now() + 1 hour) — DB me ✔
     • web par `#seasonChampionBanner` element mila par KHAALI (data-mine=null)
     • yaani app ka `_scLoad()` (features/seasonal-league.js) ko jawab nahi
       mila. DB jaanch: table par RLS policy `season_champions_read USING (true)`
       maujood hai, par table-level GRANT sirf `postgres` ke paas tha —
       anon/authenticated ke liye koi SELECT grant nahi → PostgREST
       "permission denied for table season_champions" deta hai.
       (RLS policy tabhi kaam karti hai jab table-level grant pehle ho.)

   Niym: sirf PADHNE ki ijazat — likhna aaj bhi sirf SECURITY DEFINER function
   (`declare_season_champion`) se hota hai, is liye koi bhi user khud ko
   champion nahi bana sakta. RLS read policy waise hi sabko dikhati hai
   (bada ailaan = sabko dikhna chahiye), write policy admin-only hi rehti hai.
   ══════════════════════════════════════════════════════════════════════════ */

GRANT SELECT ON public.season_champions TO anon, authenticated;

/* service_role (server-side tasks) ke liye bhi — pehle se nahi tha */
GRANT SELECT, INSERT, UPDATE ON public.season_champions TO service_role;

NOTIFY pgrst, 'reload schema';
