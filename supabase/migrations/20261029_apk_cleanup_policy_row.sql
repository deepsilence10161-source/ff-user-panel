-- ═══════════════════════════════════════════════════════════════
-- 20261029_apk_cleanup_policy_row.sql
-- ROOT-CAUSE (2026-10-29, E2E + live DB se prove): supabase/
-- apk-cleanup-policy.sql ka INSERT live DB par KABHI apply nahi hua
-- tha. app_settings me 'apk_cleanup' row hi nahi thi → device-
-- cleanup.js ko maybeSingle() se null mila → fail-safe return →
-- verdict "unknown" → post-update auto-delete kabhi nahi chala
-- (users ke phone me APK file bachi rahti thi).
--
-- Ye migration wahi policy row idempotent tarika se dalta hai
-- (ON CONFLICT DO NOTHING — admin ka Studio edit kabhi override
-- nahi hota). Scope: owner-safe exemptions ke saath app-private
-- safai sirf naye registrations par (2026-10-10 ke baad).
-- ═══════════════════════════════════════════════════════════════
INSERT INTO app_settings (key, value, updated_by, updated_at)
SELECT
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
    "note": "SAFE-CLEANER v5 — owner incident (2026-10-08) ke baad. Sabhi existing accounts/devices exempt (owner protection). Naye registrations (2026-10-10 ke baad) par update ke baad app-private safai hoti hai. Row 2026-10-29 ko migration se live hua (pehle missing tha — auto-delete isi se dead tha)."
  }'::jsonb,
  'engineering-agent',
  now()
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'apk_cleanup');
