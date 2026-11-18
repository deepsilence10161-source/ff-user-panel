# D97 FULL AUDIT REPORT — user panel code line-by-line + live click-all testing
**Date:** 09-Nov-2026 IST · **Source:** 6b3ab77 (mirrored) · **Public protected:** 4984185 · **Smoke:** 255/255

## Scope & method (owner order: "ek ek line padh, har tarah se click, DB, UI, kuch miss nahi")
1. **Static:** 111 runtime files (44,522 lines) inventory (reports/audit-d97/files.txt); 326 sink-line pattern scan (innerHTML/eval/document.write/location); XSS sink isolation matrix (bio/ign/stream_title × renderProfile/Home/Rank).
2. **Live click-all:** tools/audit/click-all.cjs — 8 screens (home, rank, matches, wallet, profile, notif, chat, special) + modals: **429 programmatic clicks**, 24 modals open/close, chat+search input pass; pageerror/console/failed-request capture; screenshots per screen+modal (reports/audit-d97/shots/).
3. **Stored-XSS pass:** tools/audit/xss-pass.cjs + sink-iso.cjs — payload `<img src=x onerror>`/`<svg onload>` bio/ign/chat me; DOM-exec + stray-element check.
4. **DB/RLS:** anon-key probe (users/profile_requests = 0 rows anon ✔, app_settings public by design ✔, withdrawals/transactions/match_players exposed nahi ✔); wallet money-path read (startWd = email-verified + sirf sponsored_winnings ✔ HALAL).
5. **Probe-window:** 24s console capture (20s poll cycle cover).

## FINDINGS
| # | Severity | Finding | Status |
|---|----------|---------|--------|
| F1 | MED | offline-handler probe: bina apikey header (401) + `np=` nonce PostgREST filter-parse (400) → har 20s console-error spam | **FIXED+guard 34a** — live 0 bad events |
| F2 | MED-HIGH | Stored-XSS sinks: profile.js pending IGN/UID rows RAW innerHTML; puIgn/puUid/puPhone + ui-fixes value-attributes RAW (attr-breakout `" onfocus=…` 20-char ign me possible) | **FIXED+guards 34c-e** — payload matrix 6/6 found:false |
| F3 | COSMETIC | "Unverified — tap to verify" chip marquee ticker text ke upar overlap | owner-decision pending (fix nahi — "kuch add mat kar") |
| F4 | COPY/COMPLIANCE | Ticker "Join Match earn Money!" + wallet "Sirf Paid Matches" wording vs halal/no-cash stance | owner-decision pending |
| F5 | INFO | Emulator e2e shots me known Pixel-Launcher ANR flake dialog (app clean; login screen visible behind) | known flake, app-side nahi |

## CLEAN results (koi bug nahi mila in areas me)
- 429 clicks me **0 page-errors**; sirf F1 wale 401/400 console errors the (ab 0).
- XSS: bio/ign/chat/share-canvas sab escaped (escHtml) — sirf F2 wale 2 sinks the.
- RLS: anon se users/profile_requests read = 0 rows; money tables exposed nahi.
- Wallet: withdrawal = email-verify gate + sirf sponsored_winnings (HALAL ✔); add-money = UTR cosmetic purchase flow.
- D96 fixes live intact: banner window-clip, gold premium pill + VIP chip (shots/scr-profile.png).

## Release trail
smoke 255/255 (TEST 34a–e) → release-protected green (fresh-boot gate pass) → mirror push 6b3ab77 → public 4984185 → Pages post-verify: probe-window 0 bad events + XSS matrix 6/6 false → CI pages+APK+E2E-emulator success → Drive project8 (1AZ9CuE90AESjX6itdR5wQ7jZEWAAexYz, zip 1qqtgwcmmPrQ_szF9copNVLwZWi_WkE-T, counter user=8) → Doc §64 → QA d97a cleanup (claims→users 204×2, Firebase delete 200×2, state removed).

## Evidence paths
- reports/audit-d97/live-click.json (429 clicks, modals, errors)
- reports/audit-d97/shots/*.png (per-screen + modal screenshots, live build)
- reports/audit-d97/xss-flagged.txt, files.txt
- reports/release-evidence/20261109-d97/screenshots/ (CI real-app/emulator set)
- tools/audit/{click-all.cjs, xss-pass.cjs, sink-iso.cjs, probe-check.cjs} (repeatable harness)

---
# D98 ADDENDUM — owner order: "sabhi bugs fix, kuch bhi galat nahi bachna chahiye"
Pending F3/F4 + regression sweep, sab fix + released:
| # | Bug | Root-cause | Fix | Proof |
|---|-----|-----------|-----|-------|
| F3 | verify-chip ticker text ke upar overlap | chip fixed top-right; ticker full-width scroll | body.vn-chip-on class toggle + `.ticker-wrap{padding-right:min(48%,344px) !important}` (style.css ke `!important` shorthand ko beat karna tha) | live pad=187.188px (390px viewport), shot shots-d98b/final-home-ticker.png |
| F4a | ticker "Join Match earn Money!" (halal stance violation) | TEEN setters: fix5 LM.once, listeners cfg.ticker, **features-user updateTicker (asli raw setter, RTDB .on)** | window.compliantTicker normalizer (core/utils.js) teeno par | live ticker = "…Join Match Coins & Diamonds jeeto !…" deployed Pages par |
| F4b | GD card art me baked "Sirf Paid Matches…uese karo" (wording + typo) | text asset green_bg.jpg me baked tha | asset regenerate: "Sirf Entry Matches…use karo" + v-stamp d | shot shots-d98b/final-wallet-gd.png |
Gates: smoke 262/262 (TEST 35a-f, 35f dynamic stamp), click-all regression 429 clicks 0/0/0 errors, probe 0, XSS 6/6 false, fresh-boot gate pass, release green, source d2083ce→8f5a64a mirrored, public head 24bb4185? (24bbf3a), CI pages+APK+E2E success, Pages post-verify numeric+visual.
Records: Drive project9 (counter user=9), Doc §65, QA d98a cleanup (claims→users 204×2, fb 200×2).
