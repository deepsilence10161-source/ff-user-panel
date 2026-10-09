-- ═══════════════════════════════════════════════════════════════════
-- SAFE-CLEANER v5 — SERVER-SIDE CLEANUP POLICY (2026-10-09)
-- ═══════════════════════════════════════════════════════════════════
--
-- Incident (2026-10-08): device-wide OldApkCleaner ne owner ke device se
-- bhi files delete kar di thin. Uske baad poora cleanup system redesign:
--
--   * FAISLA SIRF IS TABLE SE (app_settings.key='apk_cleanup') —
--     client/native policy ke bina KUCH delete nahi karta (fail-safe).
--   * OWNER PROTECTION: exemptUids / exemptDeviceFps /
--     exemptRegisteredBefore — inme jo user/device hai, us par EK file
--     bhi delete nahi hoti.
--   * SCOPE: sirf app-private storage (old update-APKs, WebView code
--     cache, cache) + tracked own downloads. User ki personal files
--     (photos/documents/downloads) kabhi nahi — na koi naam-scan.
--   * ZERO PERMISSION: file-access ki koi permission/picker nahi.
--
-- Policy shape (JSONB value):
-- {
--   "enabled": true,                  -- master switch
--   "onUpdateWipe": true,             -- update par app-private full wipe
--   "mode": "app_owned_only",         -- hamesha yehi (documented invariant)
--   "exemptUids": [...],              -- ye users kabhi clean nahi honge
--   "exemptDeviceFps": [...],         -- ye devices kabhi clean nahi honge
--   "exemptRegisteredBefore": "2026-10-10", -- is date se pehle banaye
--                                       -- accounts bhi exempt (owner safety)
--   "updatedAt": "...",
--   "note": "..."
-- }
--
-- Admin: is row ko edit karke feature on/off ya exemption badal sakte hain
-- (Supabase Studio → app_settings → apk_cleanup). Client ko sirf READ
-- chahiye (RLS waisa hi hai jaisa live_config ke liye).
-- ═══════════════════════════════════════════════════════════════════

INSERT INTO app_settings (key, value, updated_by, updated_at)
VALUES (
  'apk_cleanup',
  '{
    "enabled": true,
    "onUpdateWipe": true,
    "mode": "app_owned_only",
    "exemptUids": [
      "BwZglJY2XffByLls8KHaFyi519t2",
      "TyHtzFOnggMxWbEdTnTdEl2j7oF3",
      "MjGRBJLOBvN03FHQKeFaEtO9mSp1",
      "kVe8v7poEyPj6tqFiWU3fKSyX122",
      "Griksf534UX89tDOfrWIix7Ml5p1"
    ],
    "exemptDeviceFps": [
      "DFP_28E171637733264D3659",
      "DFP_65D74BC2889DD12708F3",
      "DFP_FA8A535FB56D34A2EBE1"
    ],
    "exemptRegisteredBefore": "2026-10-10",
    "note": "SAFE-CLEANER v5 — owner incident (2026-10-08) ke baad. Sabhi existing accounts/devices exempt (owner protection). Naye registrations (2026-10-10 ke baad) par update ke baad app-private safai hoti hai. Exemption hatane ke liye uid/fp list se hatao."
  }'::jsonb,
  'engineering-agent',
  now()
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_by = EXCLUDED.updated_by,
  updated_at = EXCLUDED.updated_at;
