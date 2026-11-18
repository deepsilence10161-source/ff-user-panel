# D101 RELEASE REPORT — 09-Nov-2026

**Release:** v1.0.589 · stamp `20261109l` · source commits `708db48` + `f31c85e`
**APK SHA-256:** `903a888e150a1ba4dec2558b5d01e80c92cc19848876c10d0d7042fa6a960445` (MATCH, zip-integrity OK, 504 entries)
**CI:** Build Mini eSports APK SUCCESS (run 42598755114) · E2E Emulator SUCCESS (run 42599316405) · real-app screens 8 files (`reports/release-evidence/20261109-1009/`)

## Owner order (5 points) — sab LIVE verified

### 1) Location OFF → user se ON karvao (fail-loop khatam)
- Android: `MainActivity.isLocationEnabled()` (GPS‖NETWORK; unknown→true) + `openLocationSettings()` (ACTION_LOCATION_SOURCE_SETTINGS) — dono `@JavascriptInterface`, D99 master-gate `bridgeAllowed()` ke andar.
- Web/modal: naya guide-modal `_locOffGuide()` — "📍 Location ON karo / Phone ki Location OFF hai" + blue **Location Settings Kholo** + **Retry — maine ON kar diya** (`window._openLocSettings`, `window._locOffGuide`).
- Pre-checks: detect-click (`_doAutoSetLocation`), geolocation `err.code===2` (POSITION_UNAVAILABLE), aur boot auto-city (`_autoCityAndroid` GPS-OFF par skip, agle boot retry).
- Live proof: shot `04-loc-off-guide.png` (modal live render).

### 2) "Premium III" khatam
- `screens/home.js` pc2 premium chip: purana `'⭐ Premium III/II/I'` literal → `premTierIcon` img + `premTierName`.
- TEST 39b: home.js me `Premium III` string zero. Live DOM assert pass.

### 3) Medal sweep (🥇🥈 → asli assets)
- Naya helper `window.tierIconHtml(name,size)` (core/utils.js) → `assets/img/ranks/{bronze,silver,gold,platinum,diamond,legend}.png`.
- ~50 sites patched, 30 files: rank podium/chips, matches, join, profile, free-trial, seasonal-league, creator-match-host, battle-pass, clan-war, skill-matchmaking, match-history, bundle-offers, growth, friends, mentor, squad-finder, squad-bank, city-championship, india-map, premium, player-card, features-user, match-result-detail, custom-dropdown, rank-system (RANK_TIERS emoji khali).
- TEST 39c2: screens/features/js/core me non-comment medal emoji = **0**. Live: leaderboard par 30/30 rank images loaded, body-text me emoji zero.

### 4) Screenshot-WALI screens dobara verify
- Live web probe `tools/audit/d101-live-shots.cjs` → **PASS 9 | FAIL 0** + shots `20261109-d101/live-web-shots/01–04` (profile title-center, home chip, leaderboard medals, loc-guide) — charon manually dekhe.
- CI real-app (asli APK + emulator) 8 screenshots — login-gate tak (CI ki known limit); logged-in proof live web probe se.

### 5) Purchased title CENTER (right-side complaint)
- Pixel-probe (card_frame.png, title-plate x436–904 → center≈664): `js/profile-card2-core.js` `title.cx 722 → 664`, `cy 528`.
- Live DOM measure: purchased title "BEAST MODE" (₹-free, 30 SD me live kharida + equip) ka center = **50.2%** (plate zone center 50.0%) → `01-profile-title-center.png`.

## Gates
| Gate | Result |
|---|---|
| smoke (TEST 1–39) | PASS 347 / FAIL 0 |
| asset-e2e / screen-e2e | PASS / PASS |
| fresh-boot (D92) | crash NONE |
| obfuscated build | PROTECT-BUILD OK — 433 files |
| CI APK + E2E emulator | SUCCESS / SUCCESS |
| SHA-256 + zip-integrity | MATCH / OK |
| live probe | PASS 9 / FAIL 0 |

## Housekeeping
- Source zip Drive `user panel/project11` me replace: naya id `1-34rp_trGVmg0Eeqf-Mhzb1Op_ullwL9` (89,001,595 B), purana `1OsLf-…` delete.
- QA account d101a: create → verify → **cleanup** (Supabase residue `[]`, 3 Firebase accounts deleted).
- Chat Doc §68 appended.
- Note: workspace rollback #2 is turn me detect+recover hua (Drive zip se 167 files restore); sab D100 markers + D101 edits intact verify kiye.
