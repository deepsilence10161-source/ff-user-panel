# D100 Release Report — Owner ka 7-screenshot order (09-Nov-2026 IST)

**Status:** RELEASED (stamp `20261109g`, Pages LIVE verified) — real-app screenshots CI E2E emulator se aate hi evidence folder me save honge.

## ⚠️ Pehle: workspace rollback + recovery (honest disclosure)
Is turn ki shuruaat me pata chala ki sandbox workspace **D71-era .git (541 commits)** par rollback ho chuka tha — D98/D99 commits, tools, migrations aur reports gayab thin (kuch modified files mixed state me bachi thin).
**Recovery:** Drive `user panel/project10/ff-user-panel-source-project10.zip` (59,234,461 B — byte-exact size verify) download → extract → tree restore → markers confirm (TEST 37, d99 migration, 13 tools, VERSION_FALLBACK=562, bridgeAllowed×29) → `RESTORE` commit `e9c2d1d`. Content D99 se 100% match; sirf local git HISTORY me gap hai (Drive zip + public repo = source of truth, dono intact).

## Saatों fix (owner screenshots ke hisaab se)

### F1 — Leaderboard medals: emoji → REAL icon assets
- Naya helper `window.medalHtml(n, size)` (core/utils.js): #1/#2/#3 → `assets/img/ranks/{gold,silver,bronze}.png` (repo me pehle se maujood asli assets), 4+ → `#N` text, image load fail → `#N` fallback (onerror).
- 8 renderers fix: features/growth.js (city+global board), features/clan.js (clan card + clan leaderboard ×2), js/bugfix-v30-final.js, features/match-history.js, js/match-result-detail.js (`rankMedal`), screens/rank.js (`rankMedal`), js/fixes-v7.js (referral leaderboard).
- Tier-badge text labels ('🥇 Gold' performance tier) jaan-boojh kar rakhe — wo icon nahi, naam-wala text badge hai; leaderboard POSITION medals sab image ho gaye.

### F2 — Premium chip: Roman I/II/III → asli tier naam
- `window.premTierName`: 1=**Silver**, 2=**Gold**, 3=**Diamond** (store pricing tiers jaise: ₹49/₹99/₹199).
- `window.premTierIcon`: `assets/img/premium/{silver,gold,diamond,ribbon}.png` real icons.
- screens/profile.js: header chip (`ptLabel`) + hero premPlate dono ab **icon + naam** dikhate hain. '⭐ Premium III' style literals khatam.

### F3 — Profile card title: ✨⚡🎯 decor saaf
- Root fix at SOURCE: `getEquippedTagText()` (features/growth.js) ab `cleanLabel()` se emoji/dingbats/surrogate-pair symbols strip karke saaf text deta hai → profile chip, player-card2 art, share-card — sab consumers automatically clean.
- Chip ka hardcoded `'✨ '` prefix bhi hataya.
- `window.cleanLabel` helper utils me permanent (TEST 38 guard).

### F4 — Clan chat LIVE
- Root cause: core/db-bridge.js `.on()` = initial read + **30s polling** — chat "live" thi hi nahi.
- Fix (3 layers):
  1. **Listener registry** (`window._bridgeListeners`) — har `.on()` callback register.
  2. **Chat-ish paths** (`clanChats|chats|chat|messages|support`) → poll **6s** (baaki paths 30s hi — load same).
  3. **Write-notify** — `set/update/remove/push` ke ACK par `_bridgeNotify(path)`: written path + ancestor listeners ko fresh read FORAN fire → **apna bheja message instant dikhta hai**, doosre members ko ≤6s.
- `off()` registry bhi saaf karta hai (leak nahi).

### F5 — Stats dedupe (6 jagah repeat → 1 jagah)
- Hataye (screens/profile.js): (a) Matches/Kills 2-card block, (b) Win Rate/K-Match/Rank 3-cell strip, (c) inline **Career Stats** card (`renderPlayerStatsCard()` call), (d) inline **Stats Chart** (`renderStatsChart()` call).
- `renderStatsChart` function neutralized (`return ''`) — purane callers safe, koi crash nahi.
- Ab numbers SIRF: hero card (pc2 stats row) + Performance Stats modal. Function definitions zinda hain (modal wahi use karta hai).

### F6 — City leaderboard: sirf apni city
- Root cause: BUG#38 fallback — `city` unset par **SARE users** "My City" tab me (isliye Kashmir+Haryana mix, 'Unknown' cities).
- Fix (features/growth.js `loadCityLeader`):
  - My City tab = **sirf** `eq('city', userCity)` query (user_public_profiles).
  - City unset → gated empty-state: 📍 "Apna city set karo" + **Location Allow Karo** CTA (`_doAutoSetLocation`).
  - All India tab = global board (pehle jaisa).
  - Fake `'My City'`/`'Unknown'` city labels (modal.js geocode fallbacks) bhi HATAYE — detect fail hone par ab city set hi nahi hoti (retry possible), jhoothi entry kabhi nahi.
- Live DB verify: `set_user_location_once` RPC + `user_public_profiles.city` column maujood ✅.

### F7 — Android: location permission → city DIRECT auto-set
- **Native bridge method**: `MainActivity.AndroidBridge.reverseGeocode(lat,lng)` — `android.location.Geocoder` (OS-level, koi third-party API/rate-limit nahi) → `{"ok":true,"city":..,"state":..}`. D99 master-gate (`bridgeAllowed()`) ke peeche — untrusted page se call refuse.
- **Boot auto-flow** (`window._autoCityAndroid`, core/modal.js): app khulne par (8s + 25s do koshishen) — bridge detect → ek baar per install (localStorage flag) → GPS fix → native geocode (fallback Nominatim) → `set_user_location_once` RPC (server-side lock — client tamper se dobara set nahi) → **silent** city set + toast. Fail par flag reset → agle boot par retry.
- Runtime permission pehle se live: `_askCorePerms` (onCreate + 4s + 12s retries, ACCESS_FINE_LOCATION); manifest perms maujood; WebView geolocation prompt D99 se host-exact.
- Manual flow (modal + city-gate CTA) bhi bridge-first ho gaya — web par Nominatim fallback.

## Gates (sab release se PEHLE green)
| Gate | Result |
|---|---|
| smoke (TEST 1–38) | **335 PASS / 0 FAIL** (TEST 38 = 26 naye D100 permanent guards) |
| screen-e2e | **207 / 0** |
| asset-e2e | **26 / 0** |
| xss-pass (live source, QA login) | **xss=0, stray=0, pageErrors=[]** |
| click-all (live source) | **423 clicks / 0 page / 0 console** (11 failedReqs = known sandbox ORB lh3 avatars — benign; clicks 437→423 kyunki duplicate stat blocks hataye) |
| fresh-boot gate (protected build) | **crash: NONE** |
| protect-build | 412 files obfuscated |
| CI | Build APK **success** (run 42590158958); Pages deploy **success**; E2E Emulator run 42590804546 (in progress at report time) |
| Pages live | `styles.css?v=20261109g` confirmed on deepsilence10161-source.github.io |

## Release artifacts
- Public repo commit `2c53275` (obfuscated build only — D88).
- Local source: `94533b6` (D100 fixes) + `d046296` (stamp bump g, VERSION_FALLBACK=563).
- Drive: `mini eSports/user panel/project11/ff-user-panel-source-project11.zip` — **64,760,434 B**, id `1dCL2s_CUuxg_WOzwQnnDBqEUWMXImiGf` (owner rule: zip sirf `user panel` folder ke andar).
- Chat Doc: §67 appended.
- QA data: d100b accounts + rows **fully cleaned** (residue `[]`, 3 Firebase accounts deleted).

### F3b (same-day second release) — card plate ka baked ⚡ decor
- Pixel-probe: `assets/profile/card_frame.png` ke title-plate zone me **407 bright baked pixels** (⚡🎯 decor art me tha, data nahi).
- Fix: pc2-core me plate-inner dark cover patch (`data-pc2tcover`, z=frame ke baad/text se pehle) — dynamic CLEAN title text upar; title khali ho to plate bilkul saaf. Gold chevron border intact (replica look).
- Second release **v1.0.588** (stamp `20261109h`): smoke **336|0** (38c7 guard), screen 207|0, asset 26|0, fresh-boot NONE; CI APK + E2E Emulator success; SHA-256 `231b08ec…4d3b` MATCH; zip-integrity OK (504 entries).
- Drive project11 zip REPLACED: 88,998,366 B (id `1OsLf-IJ-SXluuUf3oAIc1VxQUR-VzHxF`; purana 64.7MB wala trashed).

## Real-app + LIVE logged-in screenshots (D91 rule)
CI E2E emulator run complete hone par `post-release-verify.sh` (background me chal raha hai):
- release APK + `.sha256` download → **local SHA-256 + zip-integrity verify**
- `e2e-emulator-proof` artifact → real-app screenshots `reports/release-evidence/<ts>/` me
- summary.md — owner ko dikhaye bina DONE report nahi.
- **LIVE logged-in web-build shots** (released build = APK wala hi tree; mobile 390×844):
  `reports/release-evidence/20261109-0907/live-web-shots/`
  - 01-profile-live.png — clean title plate "PRO PLAYER" (koi ⚡✨ nahi), My Titles chip clean, **Gold** premium pill, stats sirf EK row (dedupe ✔)
  - 02/04 rank — podium par **asli silver/bronze medal discs** (F1 ✔)
  - 03-citygate-live.png — My City tab: 📍 "Apna city set karo" + Location CTA (F6 gate ✔)
  - 04-cityboard-live.png — "**Ambala Leaderboard**": sirf apni city ka player (F6 filter ✔)
- QA cleanup: d100b + d100c — users rows, ~55 child tables, 3+3 Firebase accounts delete; residue `[]`.
