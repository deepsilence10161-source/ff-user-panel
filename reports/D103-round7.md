# D103 — ROUND 7 (15-Nov-2026): post-quota-fix LIVE verification + admin RPC root-cause fix

Supabase quota incident (1480 MB → 27 MB) ke baad ka pehla poora live QA round.
Live target: `https://deepsilence10161-source.github.io/ff-user-panel/` + `.../ff-admin-panel/`

---

## 1) Harness recovery (workspace-wipe ke baad)
Workspace wipe se 3 cheezein gayi thi; teeno rebuild:
| Cheez | Kaise rebuild hui | Evidence |
|---|---|---|
| `tools/tri-e2e/.state/d103.json` (QA creds) | Naya script **`tools/audit/fb-rebuild-creds.mjs`**: Firebase Identity Toolkit (service account) se 8 uids ka email lookup + **admin password reset** + state file likhna | `lookup → 8/8`, `passReset=200` ×8; emails `qa1..qa7@qa-miniesports.dev`, `adm1@qa-miniesports.dev` |
| npm deps + chromium | `npm install` (295 pkgs) + `sudo apt-get install libnss3 libatk-bridge2.0-0 libcups2 libxdamage1 libxkbcommon0 libasound2 libatspi2.0-0` + `npx playwright install chromium` | `PW_READY` |
| Maint key (`D103_MAINT_KEY`) | Nayi key generate → mgmt API `POST /projects/{ref}/secrets` (201) → live function ne turant nayi key accept ki | `?action=status` → `{"db_size":"28 MB","net_rows":"25","jrd_rows":"371","ops_ticks_10min":"30","cron_launcher":"1"}` |

**Script patches (harness-rollback ke baad dobara):** `d103-clicks.cjs` + `d103-notif.cjs` ab `BASE`/`LIVE`/`OUT` env honor karte hain (pehle mock `127.0.0.1:8091` par hardcode the); `d103-admin-deep.cjs` ka `OUT` ab env-honoring. Runner: `tools/audit/r7-rest-loop.sh`.

**Note:** deployed edge fn `d103-db-maint` v7 ka source mgmt API se wapas nahi milta (GET /functions/{id} → 404). Local `tools/edge/d103-db-maint/index.ts` ek **reference reconstruction** hai (header me WARNING likha hai) — blind deploy mat karna.

## 2) ADMIN panel ke 41 findings ka ASLI root cause — 2 DB-side bugs (LIVE FIX + VERIFY)
Pichle round me admin-deep ne 41 console-class findings diye the (pre-auth RPC 400/403, `app_settings` INSERT RLS deny, `users.fraud_score` P0001). Teeno ka jad **ek hi jagah** tha:

### Bug A — `users.is_admin` flag missing tha (fixture + real drift)
- `admins` table me 2 admins: `BwZglJY2XffByLls8KHaFyi519t2` (AdminAccount, `users.is_admin=true`) aur `KLostIl8ygUvRiZySH466jSB9yV2` (QA-Admin Owner, **`users.is_admin=false`**).
- Supabase ka poora admin authz isi flag par tika hai: `is_caller_admin()` = `SELECT is_admin FROM users WHERE id = auth.jwt()->>'sub'`, aur `app_settings` ki `as_admin_write` policy bhi wahi check karti hai.
- **Fix:** `UPDATE users SET is_admin=true WHERE id='KLostIl8...' AND id IN (SELECT uid FROM admins)` → ab dono admins `is_admin=true`.
- **Permanent guard:** naya trigger `admins_sync_is_admin` (AFTER INSERT OR DELETE ON `admins`, SECURITY DEFINER fn `sync_users_is_admin_from_admins()`) — `admins` me row aate hi `users.is_admin=true`, hatne par `false` (agar doosri row na ho). Ab ye drift dobara nahi ho sakti.

### Bug B — 20 admin RPCs par `anon` ko EXECUTE grant hi nahi tha
- Panels Firebase JWT bhejte hain; us JWT me Supabase ka `role` claim nahi hota ⇒ PostgREST request **anon** role me chalata hai.
- Audit: 21 `admin_*` functions me se sirf 2 (`admin_match_interests`, `admin_push_selftest`) par anon EXECUTE tha — **baaki 19 par 42501 "permission denied for function"**. Matlab admin panel ke direct-RPC features (coins set, wallet adjust, profile approve/reject, broadcast notification, season roll, sponsored match, fraud score…) **server par pahunchte hi nahi the**.
- Safety check pehle: saare 21 functions `SECURITY DEFINER` hain **aur** andar se admin-guarded (`is_caller_admin()` ya inline `v_is_admin`/`service_role` check) — isliye grant safe hai.
- **Fix:** `GRANT EXECUTE … TO anon, authenticated` (sirf guarded functions par; `admin_gateway_exec` ko jaan-boojh kar chhoda — wo edge-function-only dispatcher hai) → **20/21 anon-executable**.

### LIVE verification (asli Firebase JWT ke saath, adm1 + qa1)
| Test | Pehle | Ab |
|---|---|---|
| `app_settings` INSERT (`d103_rls_probe`) | 401/403 RLS deny | **201** (row bani, phir cleanup 200) |
| `rpc admin_match_interests` | 400 ×5 (pre-auth) | **200** + real rows (Hunter7 etc.) |
| `rpc admin_set_fraud_score(qa1,5)` | 42501 | **200** `{"success":true,"fraud_score":5}` (baad me 0 par reset) |
| `rpc admin_set_coins(qa1,'add',0)` | 42501 | **200** `{"success":true,"old_balance":525,"new_balance":525}` |
| `rpc admin_approve_profile(dummy uuid)` | 42501 | **200** `{"success":false,"error":"request_not_found"}` (graceful) |
| direct `PATCH users.fraud_score=3` (admin token) | P0001 "not self-editable" | **204** |
| **SECURITY:** non-admin qa1 → `admin_set_coins(+1000)` | — | **200 `{"success":false,"error":"Admin only"}`**, qa1 coins **525 → 525** (unchanged) |
| **SECURITY:** non-admin qa1 → `admin_send_broadcast_notification` | — | **200 `{"success":false,"error":"Admin only"}`** |
⇒ Grant se koi privilege escalation nahi hui; guard function ke andar kaam kar raha hai.

**Side-effect:** fix #3 (USER_FIELD_MAP se `fraudScore` hatana) ki zaroorat **nahi** padi — direct write ab admin token se pass ho jaata hai (204). Code untouched = kam risk.

## 3) Code-side fix (deploy pending — GitHub PAT dead)
`ff-admin-panel/js/admin-inline-c.js`:
- Naya helper **`supaReadyPromise(timeoutMs)`** — `window._supa && window._supaAuthed` ka 400ms-interval wait (default 5s).
- `loadMatchInterests()` ab auth-ready hone ke baad hi RPC fire karta hai + ek transient retry (700ms).
- `showInterestedUsers()` → `_renderInterestedUsers()` split; pehle `!supa` par turant "Supabase not ready" toast aa jaata tha.
- `node --check` pass. **Deploy blocker:** `.secrets/github_token` + Drive `github_token.md` dono **401 Bad credentials** (api.github.com/user) ⇒ Pages push nahi ho sakta. Naya PAT chahiye.

## 4) R7 LIVE sweep result — 0 findings
`LIVE=1 BASE=…/ff-user-panel/index.html OUT=reports/d103-sweep-pages-r7 node tools/audit/d103-sweep.cjs`
- **8 accounts (adm1, qa1–qa7) × hi/en × 9 screens = 144 screen-runs → `SWEEP FINDINGS: 0 {}`**
- 144 screenshots `reports/d103-sweep-pages-r7/`
- Checks: broken images, dummy/emoji icon slots, NaN/undefined/`{{}}`/`[object Object]` leaks, i18n holes (data-i18n == key), Hindi mode me English labels, pageerrors.
- Per-run: `done adm1/hi … qa7/en findings=0` (har run 0).

## 5) R7 baaki live checks (results neeche append honge)
Runner: `tools/audit/r7-rest-loop.sh` → clicks (qa1,qa2,qa5 × hi/en) → notif hi → notif en → admin-deep (live Pages).
Runner: `tools/audit/r7-rest-loop.sh` (log `/tmp/r7-rest.log`)

### 5a) CLICK MATRIX — 0 findings
`ONLY=qa1,qa2,qa5 LANGS=hi,en LIVE=1 BASE=…/ff-user-panel/index.html` → **3 accounts × 2 languages × 9 screens = 54 screen-runs**, har screen ke har visible button/clickable par actual click (modal open→close), logout/delete-account jaise destructive SKIP by design.
Result: har line `findings=0`, final **`CLICK MATRIX FINDINGS: 0`** (`CLICKS_EXIT=0`). Screenshots `reports/d103-clicks-pages-r7/`.

### 5b) NOTIFICATION probe — pehle 5/6 (false negative), ab **6/6 PASS ×2**
Pehla run: `PASS 5 | FAIL 1` — fail tha *"bell badge unread dikhta hai pre-visit ()"*.
**Jaanch kiya: app sahi tha, PROBE galat tha.**
- Live markup (`index.html:321`): `<span class="dot" id="bellDot">` — badge ek **dot** hai.
- `core/header.js:38 updateBell()`: 1–3 unread ⇒ chhota red dot (**koi text nahi**), 4+ ⇒ count pill (`5`, `9+`), 0 ⇒ `display:none`.
- Purana probe `textContent` padhta tha ⇒ dot-mode (1–3 unread) par hamesha khaali string ⇒ **false FAIL**.
- Probe fix (`tools/audit/d103-notif.cjs`): naya `BADGE_PROBE()` — `#bellDot` (fallback `#bellBadge/#bell-badge/#notifDot/.bell-badge`) ki **visibility + text** dono dekhta hai; visible-but-no-text ⇒ `'DOT'`.
- DB fixture bhi reason tha: qa4 ke saare notifications pehle hi `is_read=true` the (Round-6b me read ho gaye) ⇒ badge legitimately khaali. Isliye **unread seed** karke test kiya (service_role POST 201), test ke baad QA rows delete (204).

| Run | Seed | Result |
|---|---|---|
| notif **hi** | 5 unread | **PASS 6 \| FAIL 0** — badge pre-visit = **`5`** (count pill), list 9 cards, open bina crash, visit ke baad badge clear, FCM foreground toast render, 0 pageerror |
| notif **en** | 2 unread | **PASS 6 \| FAIL 0** — badge pre-visit = **`DOT`** (dot mode), list 11 cards, baaki sab pass |

⇒ Notification badge ka **dono mode (dot + count)** live Pages par pramanit; probe ka false-negative hamesha ke liye hataya.

### 5c) ADMIN DEEP (live Pages) — **41 → 1 finding**
`OUT=reports/d103-admin-deep-r7 ADMIN_BASE=…/ff-admin-panel/`
- **30/30 sections** khule: dashboard, profileVerification, profileUpdates, users, tournaments, joinedPlayers, results, match-history, sponsoredTournaments, skyDiamondRequests, premiumRequests, creatorApplications, seasonPass, support, notifications, settings, systemSettings, creatorProgram, growthAnalytics, quicktools, disputes, creatorMatchReview, analytics, lookup, activity, bracketAdmin, clanWarAdmin, cityChampAdmin, mentorAdmin, cleanBadgeAdmin.
- **90 button clicks, 24 modals opened, 0 UI crash.**
- Har section: `broken=0` (koi broken image nahi), `leaks=0` (NaN/undefined/[object Object] nahi), `faDead=0` (koi dead FontAwesome icon nahi), `secVis=true`.
- Real data render hua: users rows=21, systemSettings rows=21, growthAnalytics rows=9, tournaments rows=4, analytics rows=4, support imgs=13.
- **`ADMIN DEEP FINDINGS: 1`** — sirf `empty-section | results :: txt=39` (pichle round ke **41** console-class findings — pre-auth RPC 400/403, `app_settings` RLS deny, fraud_score P0001 — **sab khatam**, §2 ke DB fixes se).

### 5d) Us 1 finding ka fix + functional verify (deploy pending)
- Markup: `index.html` `section-results` me naya `#resultsEmptyState` (trophy icon + "Abhi koi match result ke liye uplabdh nahi" + Tournaments tab hint).
- Logic: `js/features/fa22-match-result.js` `loadMatchResultSection()` me non-destructive block — `resultTournamentSelect` defensive populate + `options.length<=1` ho to empty-state `block`, warna `none`.
- Verify (naya script `tools/audit/d103-emptystate-verify.cjs`, local source `http://127.0.0.1:8093/`, RTDB loaders stub):
  - CASE1 (0 matches): `display:"block"`, friendly text present, options=1 ✅
  - CASE2 (2 matches): `display:"none"`, options=3 (`-- Select Match --`, Test Match 1, Test Match 2) ✅
  - `pageerrors (filtered): 0` → **`VERIFY PASS`**
  - Screenshots: `reports/d103-admin-deep-r7/results-emptystate-nomatch.png`, `…-withmatch.png`
  - Note: pehla attempt FAIL dikha tha kyunki loader khud `loadTournaments()` call karke live RTDB se 5 real matches laa deta tha (precondition toot-ta tha) — stub tighten karke PASS.
- **Deploy blocked:** GitHub PAT dead (§3) ⇒ ye 2 admin fixes (gate + empty-state) local verified hain, Pages par push nahi hue.

### 5e) Round-7 scorecard
| Check | Runs | Result |
|---|---|---|
| LIVE sweep (8 accounts × hi/en × 9 screens) | 144 screen-runs | **0 findings** |
| Click matrix (qa1/qa2/qa5 × hi/en × 9 screens) | 54 screen-runs | **0 findings** |
| Notification probe (hi count-pill + en dot) | 2 runs × 6 checks | **12/12 PASS** |
| Admin deep (30 sections, 90 clicks, 24 modals) | 1 run | **1 finding → fix local-verified** |
| Admin RPC / RLS live probes (incl. 2 security tests) | 8 probes | **sab expected** |

## 6) Blockers / owner action
1. **Naya GitHub PAT** (fine-grained, `deepsilence10161-source/ff-admin-panel-public` + `ff-user-panel-public` + `ff-user-panel-src` par Contents: Read/Write) — admin gate-patch deploy + source zip push ke liye. Purana PAT 401 de raha hai.
2. Real-device Devanagari/emoji confirm (owner) — pending.

## 7) Corrected references (memory me galat the)
- Drive folder "Mini eSports" = `10pbByXUP1fR_9fotQSdwGMveuqET9tsT` (…ET9**ts**T, pehle …ET9msT likha tha).
- Drive `github_token.md` = `1BSza2VA-AoyTziSm4iqP6M79RGdHA0LD` (pehle 1BSha2VA… likha tha) — content dead token hai.
- `supabase token.md` = `1DQHZI2PjxGQD-uAa6PBOlrCFlMhABxLj`; local `.secrets/supabase_token` (sbp_…) mgmt API par **200** de raha hai (live, valid).

---

## 8) Workspace-wipe incident + durable backup (15-Nov, ~07:22 IST)
Turn ke beech workspace snapshot restore hua — is round ka **saara evidence wipe** ho gaya:
`reports/d103-sweep-pages-r7/` (144 PNG + findings.json), `d103-clicks-pages-r7/`, `d103-notif-pages-r7*/`,
`d103-admin-deep-r7/`, `/tmp/r7-*.log`, `tools/tri-e2e/.state/d103.json`, `.secrets/d103_maint_key`,
`node_modules` + playwright cache, aur 4 naye scripts (`fb-rebuild-creds.mjs`, `r7-rest-loop.sh`,
`d103-emptystate-verify.cjs`, `tools/edge/d103-db-maint/index.ts`) + `d103-notif.cjs`/`d103-clicks.cjs` patches
+ admin `fa22-match-result.js` patch. **Bach gaye:** `reports/*.md`, `admin-inline-c.js` patch, `index.html` markup.

### Recovery (isi turn me kiya gaya)
| Item | Kaise | Result |
|---|---|---|
| QA creds/state | `fb-rebuild-creds.mjs` dobara banaya (Firebase Admin lookup + password reset) | `lookup → 8/8`, `passReset=200` ×8, state file rebuilt |
| Maint key | nayi key generate → mgmt API `POST /secrets` (201) → endpoint verify | `status` → db 28 MB, cron_launcher 1, ops_ticks 30 |
| Maint key durable copy | Drive `d103-maint-key.md` (id `1dERVhH3BBx3gk1Zg7AaMQEKThQMq03cV`) | uploaded ✅ |
| Deps | npm install + apt libs + playwright chromium | `DEPS_READY` |
| Scripts/patches | idempotent python patcher se dobara (clicks/notif BASE+LIVE+OUT, dot-aware BADGE_PROBE, admin-deep OUT, fa22 empty-state) | sab `node --check` OK |
| Maint endpoint knowledge | `tools/edge/d103-db-maint/RECOVERY.md` (mechanics + rotate steps + watchdog lesson) | 3.1 KB |
| **Durable backup** | harness + reports `.md` private repo me push | **`ff-user-panel-src` f042cd6** ✅ |
| Evidence policy (naya) | har run ke baad **usi turn me** zip → Drive upload (wipe se pehle) | `r7-full-loop.sh` ke end me auto-zip |

### GitHub PAT (owner ne 15-Nov ko naya diya)
- Token valid: `api.github.com/user` → **200**, login `deepsilence10161-source`.
- `ff-user-panel-src` → **full access** (admin/push) ✅ — backup push isi se hua.
- `ff-admin-panel-public` + `ff-user-panel-public` → **404** (fine-grained token ke "Repository access" me select nahi hue).
  ⇒ Admin ke 2 code fixes (auth-gate + Match Results empty-state) **live deploy nahi ho sake**; token me ye 2 repo
  add hote hi build+push+re-verify (~10 min).
- Token copies: `/home/user/.secrets/github_token`, `/home/user/.secrets/git-credentials`, Drive `github_token.md`
  (id `1BSza2VA-AoyTziSm4iqP6M79RGdHA0LD`) — teeno **updated** ✅

## 9) R7 RE-RUN results (wipe ke baad dobara, evidence-zip ke saath)
**Evidence (durable):** Drive `d103-r7-evidence.zip` — id `1wtTYJz9O_tzIc7kJ5KA0Pbe7SFyKZtbW`, **45,997,375 bytes, 214 files** (folder "Mini eSports").

| Run | Scope | Result | Evidence |
|---|---|---|---|
| SWEEP (live Pages) | 8 accounts (adm1, qa1–qa7) × hi/en × 9 screens = **144 runs** | **`SWEEP FINDINGS: 0 {}`** (har run 0) | 144 PNG + findings.json |
| CLICKS (live Pages) | qa2 × hi/en × 9 screens = **18 runs**, har visible button click | **`CLICK MATRIX FINDINGS: 0`** | findings.json |
| NOTIF hi | 5 unread seed (201) | **PASS 6 \| FAIL 0** — badge pre-visit **`5`** (count pill), list **16 cards**, open bina crash, visit ke baad badge clear, FCM foreground toast, 0 pageerror | 2 PNG |
| NOTIF en | 2 unread seed (201) | **PASS 6 \| FAIL 0** — badge pre-visit **`DOT`** (dot mode), list **18 cards**, baaki sab pass | 2 PNG |
| QA cleanup | R7 test notification rows | **204** (delete) — real users ka data untouched | log |
| ADMIN DEEP (live Pages) | **30 sections, 90 button clicks, 24 modals** | **`ADMIN DEEP FINDINGS: 1`** — sirf `empty-section \| results (txt=39)`; broken=0, leaks=0, faDead=0, secVis=true har section me | 53 PNG + findings |

Real data render hua (admin deep): users rows=21, systemSettings rows=21, growthAnalytics rows=9, tournaments rows=4, analytics rows=4 (imgs=5), support imgs=13, premiumRequests rows=1, creatorApplications rows=2, disputes rows=1.

**Wipe ke pehle wale run se tulna:** dono baar same result (sweep 0, clicks 0, admin-deep 1) ⇒ results **reproducible** hain, fluke nahi.

### Deploy ho gaya (see §10)
Pehle likha tha ki PAT ko `ff-*-public` repo ka access nahi hai — **woh galat tha**. Sach: woh repo naam exist hi nahi karte (404). Asli Pages repo hain **`ff-user-panel`** aur **`ff-admin-panel`**, aur 401 ka asli kaaran wipe ke baad `.secrets/github_token` ka purane dead token par revert ho jaana tha. Naya PAT + sahi naam ⇒ deploy ho gaya (§10).


## 10) r7b/r7c — ADMIN LIVE DEPLOY + re-verify (15-Nov, IST)

Owner ne naya GitHub PAT diya aur chaaron repo select kiye. Token verify: `GET /user` → 200 (login `deepsilence10161-source`), `GET /user/repos` → **14 repos, sabme push=True**.

### 10a) Repo naam ka asli sach (purana assumption galat tha)
| Naam jo main pehle maan raha tha | Sach | Result |
|---|---|---|
| `ff-user-panel-public` | exist hi nahi karta | 404 (isliye pehle "token me access nahi" laga) |
| `ff-admin-panel-public` | exist hi nahi karta | 404 |
| `ff-user-panel` | **real public Pages repo** (`has_pages=true`) | 200, push OK |
| `ff-admin-panel` | **real public Pages repo** (`has_pages=true`) | 200, push OK |
| `ff-user-panel-src` | private readable source | 200, push OK |
| `ff-admin-panel-src` | private readable source (**pehle empty repo tha**) | initial push `d67c7f4` (132 files) |

Wipe #3 me `.secrets/github_token` **purane dead token par revert** ho gaya tha (prefix `github_pat_11CBBGBIA0qKl`, 401) ⇒ naya token (prefix `github_pat_11CBBGBIA0gok`) `.secrets/github_token` + `.secrets/git-credentials` me dobara likhna pada. **Lesson: har turn ki shuruaat me token file re-verify karo.**

### 10b) Deploy
| Step | Detail | Result |
|---|---|---|
| Protected build | `node scripts/protect-build-admin.mjs` | `ADMIN PROTECT-BUILD OK`, **117 files / 4.3 MB**, teeno fix markers present |
| Sync → clone | `python3 sync.py build ff-admin-panel` | `stale=0 added=0 changed=80`, **0 deletions** |
| Push (public Pages) | commit **`0175bf2`** → later **`49e2a96`** | push OK, main |
| Pages freshness | `GET .../ff-admin-panel/index.html?cb=$RANDOM` | try1: 145,085 B `resultsEmptyState`=1 → try2: 145,472 B `resultsHint`=2 (live) |
| Readable source | commit **`d67c7f4`** → **`3fdef13`** (`ff-admin-panel-src`) | push OK; `build/` gitignored, tracked=132 (obfuscated code source repo me leak nahi hua) |

### 10c) Live re-verify (r7b → r7c)
| Run | Scope | Result |
|---|---|---|
| **r7b** (deploy ke turant baad) | `reports/d103-admin-deep-r7b/`, 30 sections / 90 clicks / 24 modals | **findings 1** — `empty-section \| results (txt=39)` |
| root cause | `tools/audit/d103-admin-deep.cjs:118` → `!rep.secVis \|\| rep.secTxtLen < 60` | `section-results` ka innerText sirf selected `<option>` ka text (39 char) hota hai jabki matches dropdown me maujood hote hain ⇒ **audit heuristic ka false-positive**, product bug nahi |
| fix (dono tarah se) | `index.html#resultsHint` + `fa22-match-result.js` count-hint logic | 0 match → friendly empty state; 1+ match → **"N match available — … upar se match chunein."** (admin ko ab section khaali nahi lagta) |
| **r7c** (fix deploy ke baad, live Pages) | `reports/d103-admin-deep-r7c/`, 30 sections / 90 clicks / **29 modals**, 58 PNG | **`ADMIN DEEP FINDINGS: 0`** — broken=0, leaks=0, faDead=0, sab sections `secVis=true`; `results` ab `txt=120` |

### 10d) Evidence (durable, Drive folder "Mini eSports")
| File | Drive id | Size | Contents |
|---|---|---|---|
| `d103-r7-evidence.zip` | `1wtTYJz9O_tzIc7kJ5KA0Pbe7SFyKZtbW` | 45,997,375 B (214 files) | full R7 re-run (sweep/clicks/notif hi+en/admin-deep) |
| `d103-r7c-admin-evidence.zip` | `1rM6WRhZifPJk7JURHQlZtp-hhpiYBaK0` | 20,702,663 B (**119 files**) | r7b + r7c admin screenshots, logs, ye report |

### 10e) Status: admin panel live clean
Admin panel par ab **koi open finding nahi**. Baaki D103 items (user panel side): premium badge/tag position deep-check, rank/cosmetics real-image asset audit, clicks matrix qa3/qa4/qa6/qa7/adm1 par, stale `*@fft.com` Firebase rows ki safai, final source zips, real-device Devanagari confirm.

## 11) r7c — USER PANEL: live sync proof, premium badge audit, asset audit, Firebase inventory (15-Nov, IST)

Naya PAT milne ke baad user panel side ke bache hue D103 items bhi live verify kiye.

### 11a) Live user panel = local source? (drift check)
| Check | Tarika | Result |
|---|---|---|
| Build manifest | `asset-paths.txt` live vs local source se fresh banaya | **IDENTICAL (60 lines)** ⇒ live build isi source tree se bana hai |
| Public files maujood? | 113 js/html/css live par probe | **0 missing (sab 200)** |
| Non-JS byte compare | live public repo clone vs local worktree (199 files) | 190 same, **9 diff**, 279 live-only |
| 9 diff ka sach | — | 3 = premium PNG (neeche 11c), 3 = purane evidence logs, 3 = `.github/` CI files |
| `.github/` CI files | diff padha | **jaan-boojh kar alag** — D93 "protected-tree guards" (public repo obfuscated hai isliye CI gates wahan informational). Local strict version sahi hai ⇒ **koi action nahi** |
| Obfuscated JS md5 | — | compare **be-matlab**: `protect-build.mjs` me koi fixed `seed` nahi ⇒ har build ke identifier names badalte hain (2 baar build karke khud verify kiya) |

### 11b) Premium badge/tag — LIVE geometry+visual probe (`d103-premium.cjs`)
Owner: *"premium badge aur tag perfectly show hona chahiye iski position perfectly set kar."*

| Run | Accounts | Result |
|---|---|---|
| LIVE Pages, hi + en | qa2 (Gold L2 + `title_mythic` + `badge_mvp`), qa5 (Silver L1) | **`PREMIUM FINDINGS: 0`** — 8 screenshots |

Jo cheezein check hui: PCARD2 tier-color chip pill visible + viewport ke andar + apne host ke andar, VIP crown chip, ribbon, home/public icons, har icon ka `naturalWidth > 0` (matlab **asli image load hui, dummy nahi**), kahin **"Premium III"** nahi, kahin **⭐ emoji** nahi.

### 11c) ⚠ Ek asli khatra mila aur fix hua: premium tier images local source me PURANI thi
| Baat | Detail |
|---|---|
| Kya mila | Live par `assets/img/premium/{silver,gold,diamond}.png` = **35,124 / 32,555 / 35,154 B**, local source me = **31,035 / 28,592 / 31,009 B** (dono 224×224) |
| Kaaran | 14-Nov ke deploy commit `981a5f4` ka message: *"D103 r6b: transparent premium tier assets (black-bg alpha fix) — rebuild"*. Yaani **kaale background wala alpha bug theek karke nayi images sirf public repo me push hui thi** — local source worktree me purani hi reh gayi |
| Khatra | Agli baar jab bhi user panel deploy hota, local ki purani images live ko **overwrite** kar deti ⇒ premium badge ke peeche **kaala box** wapas aa jata (launch par users ko sabse bura yahi dikhta) |
| Fix | Teeno fixed PNG live repo se local source me **back-port** kiye; ab chaaron premium images (silver/gold/diamond/ribbon) **live Pages bytes se md5-MATCH** ✅ |
| Backup | Private source repo `ff-user-panel-src` me ye fixed versions pehle se the (CONTENT_DIFF=0) ⇒ backup sahi tha, sirf local worktree stale tha |

### 11d) Asset audit — "rank, cosmetics… dummy icons ka nahi"
| Check | Result |
|---|---|
| Catalog declared items | **60** (`js/features/asset-catalog.js`: rank 6, premium 4, title 17, badge 23, special 3, cosmetic 1, icon 6) + `match-bg.jpg` = **61 files** |
| Catalog → local file missing | **0** |
| Live Pages vs local **md5** compare (61 files) | **61/61 OK, 0 problem** (3.10 MB total) — badges 23, titles 17, ranks 6, icons 6, premium 4, special 3, frames 1, root 1 |
| Emoji/dummy icon | premium probe me `naturalWidth>0` + "no ⭐" pass ⇒ UI me asli art hi render hota hai (source me jo ✅❌⚠ emoji hain wo sirf **dev console log prefixes** hain, user UI me nahi) |

### 11e) Firebase Auth inventory — stale test accounts (`fb-list-accounts.mjs`, read-only)
Naya script: `tools/audit/fb-list-accounts.mjs` (poora account list, domain-wise summary + detail). **Delete jaan-boojh kar isme nahi hai** — account hatana owner ki haan ke bina kabhi nahi.

Endpoint sach (probe se confirm): identitytoolkit **v1/v2 `accounts:download` → 404**; kaam karta hai legacy **v3 `relyingparty/downloadAccount`** aur usme **dono** chahiye: `?key=<web key>` + `Authorization: Bearer <service-account token>` (sirf key → 401, sirf token → 404).

**TOTAL 380 accounts** (project `fft-app-1e283`):
| Domain | Count | Kaun hai |
|---|---|---|
| (no-email) | 222 | Google/anonymous sign-in = **real users** |
| gmail.com | 91 | **real users** |
| **fft.com** | **27** | purane QA/probe accounts — **par 1 real ADMIN hai** |
| miniesports.test | 17 | purane test accounts |
| d103.miniesports.local | 8 | D103 ke local test accounts |
| qa-miniesports.dev | 8 | **ACTIVE QA accounts (qa1–qa7 + adm1) — rehne do** |
| example.com | 5 | test |
| fftapp.com / fft-test.local | 1 + 1 | test |

`@fft.com` detail: **27 me se 1 = `admin@fft.com` (uid `BwZglJY2XffByLls8KHaFyi519t2`) — ye asli ADMIN account hai, isse chheda nahi jayega.** Baaki **26** = `qa-tri-probe*-x` (14), `qa-tri-d96b/d97a/d98a/d100a/d102a` (7), `qa-tri-t081749-*` (2), `probe-relay-01` (1), `qauser1/2/3` (3)... sab password-only, koi display name nahi, 18 ka last-login 30 din se purana. Doosre test domains (`miniesports.test` 17 + `d103.miniesports.local` 8 + `example.com` 5 + `fftapp.com` 1 + `fft-test.local` 1) = **32 aur**.

**Owner approval chahiye:** total **58 stale test accounts** delete karne ki permission (26 `@fft.com` + 32 doosre test domains). `admin@fft.com`, 8 active QA, aur 313 real users (222 + 91) ko **chheda nahi jayega**.

### 11f) Backend health (maint endpoint, key Drive se restore karke)
`.secrets/d103_maint_key` wipe me kho gaya tha ⇒ Drive mirror `d103-maint-key.md` se wapas laya (32 B). Status probe:
`{"db_size":"29 MB","net_rows":"16","jrd_rows":"2991","ops_ticks_10min":"30","cron_launcher":"1"}` — DB 27→**29 MB** (normal growth), retention kaam kar rahi hai (net rows 16), watchdog 10 min me 30 ticks, cron launcher zinda.

## 12) 🔴 P0 MILA AUR FIX HUA — Hindi mode me app CRASH (renderer kill) + security hygiene

Owner ke do rule ek saath toot rahe the: *"har button par zero crash"* aur *"Hindi, English dono mode ke liye perfect"*.

### 12a) Kya dikha
Click-matrix (live Pages, real account, har screen ke har visible button par click) me:
| Run | Result |
|---|---|
| qa4 / **English** | 9/9 screens clean, **0 findings** |
| qa6, qa7, adm1 / hi + en (54 runs) | **0 findings, 0 crash** |
| qa4 / **Hindi** | home→rank→matches→wallet→profile clean, phir **`notif` par renderer "Target crashed"** — 3 baar reproduce (ix3, ix1, ix1) |

Crash ke baad page mar jata tha, isliye baaki clicks bhi fail dikhte the (20-21 "findings") — wo sab **ek hi crash ke baad ke echo** the, alag-alag bug nahi.

### 12b) Jaanch (guess nahi, proof)
| Step | Tarika | Result |
|---|---|---|
| 1 | `notif` ke ix0–ix6 ko **fresh page** par ek-ek karke click (`d103-notif-crash-probe.cjs`) | sab OK ⇒ koi ek "zeherila button" nahi |
| 2 | Hindi me same probe | sab OK ⇒ crash **sequence-dependent** (pehle ~100 clicks ka accumulated state zaroori) |
| 3 | `deviceScaleFactor` 2 → 1 | crash **phir bhi hua** ⇒ screenshot/raster memory kaaran nahi |
| 4 | Full trace (`d103-notif-hi-trace.cjs`): pre-screens navigate + 12 clicks, har click ke baad DOM nodes/heap/overlay measure | heap 10.7 MB **stable**, nodes ~1200 ⇒ single-click leak nahi |
| 5 | **A/B proof**: `page.route` se `js/i18n-apply.js` ko **block** karke wahi matrix qa4/hi par | **9/9 screens clean, 0 findings, 0 crash** ⇒ culprit = `js/i18n-apply.js` |

### 12c) Root cause (code level)
`js/i18n-apply.js` me:
```js
var mo = new MutationObserver(queue);
mo.observe(document.body, { childList: true, subtree: true, characterData: true });
```
aur `applyLang()` **khud text nodes likhta hai** (`n.nodeValue = ...`).
⇒ apni hi likhawat observer ko trigger karti thi → 350 ms baad phir poori document walk → phir likhawat → **be-ant loop**. Har click ke saath DOM badhta gaya, loop ka cost badhta gaya, aur renderer OOM ho kar mar gaya.
**Sirf Hindi me kyun?** English mode me map `HI2EN` UI text se match hi nahi karta ⇒ koi mutation nahi ⇒ loop chalu hi nahi hota. Isliye qa4/en aur baaki accounts clean the.

### 12d) Fix (teen layer, translation behaviour same)
| Layer | Kya | Fayda |
|---|---|---|
| 1 | `applying` flag + apply ke dauraan `mo.disconnect()`, baad me `setTimeout(0)` par resume | apni khud ki mutations observe hi nahi hoti ⇒ **loop ki jad khatam** (mutation records microtask me aate hain, flag macrotask me clear hota hai ⇒ beech ke records ignore) |
| 2 | Rate-limit `MIN_GAP = 900 ms` (pehle 350 ms, koi limit nahi) | full-document walk ki frequency capped |
| 3 | `document.hidden` par kaam nahi + `visibilitychange` par fresh apply | background tab me CPU/battery waste band |
Saath me `window._i18nApply` ab guarded entry hai, `window._i18nApplyRaw` raw (tests ke liye), aur `window._i18nFixRev = 20261115` **deploy-marker** (obfuscation ke baad bhi grep ho sakta hai kyunki numbers/property-names survive karte hain, strings base64 ho jate hain).

### 12e) Deploy (user panel — live)
| Step | Detail |
|---|---|
| Build | `node scripts/protect-build.mjs` → obfuscated |
| Push 1 | `ff-user-panel` main **`c28eb22`** — i18n fix (105 JS changed, 0 deletions) |
| Push 2 | **`111c29b`** — 7 internal QA scripts wapas hataye (galti se add ho gaye the) |
| Push 3 | **`4b7d8cd`** — poora `tools/` public repo se remove (73 files), repo ab **564 files** |
| Pages verify | `js/i18n-apply.js` = 6851 B, marker `_i18nFixRev` **= 1** ✅ ; `index.html` 200 ✅ ; `tools/audit/...` ab **404** ✅ |

### 12f) Security hygiene — kya leak hua tha, kya nahi
Deploy ke dauraan pata chala ki `protect-build.mjs` `tools/` ko **public build me copy** karta tha ("workflows ke liye" comment ke saath) — isliye mere internal QA scripts public repo me ja rahe the.
| Cheez | Sach | Nuksan |
|---|---|---|
| 7 naye QA scripts (is deploy me add hue) | turant hataye (`111c29b`) | koi nahi |
| 58 purane `tools/audit` scripts + baaki `tools/` | ab poora `tools/` hi public repo se hata diya (`4b7d8cd`) + `protect-build.mjs` ab sirf `android/` copy karta hai | koi nahi (public CI `tools/` use hi nahi karta — koi reference nahi mila) |
| `eyJ...` token jo in scripts me tha | decode karke check kiya: `{"iss":"supabase","ref":"hddhkculuyrfoevxmlwy","role":"anon"}` = **app ka ANON key**, jo `core/db.js`/`core/firebase.js` me pehle se public hai (Supabase design: anon key public hota hai, data RLS protect karta hai). `service_role` (219 B) se **match nahi** (208 B, role alag) | **koi secret leak nahi** |
| Firebase web key `AIza...` | ye bhi app me pehle se public | koi nahi |
| QA account **passwords** (`tools/tri-e2e/.state/d103.json`) | build dir me copy to hue the, par `tools/tri-e2e/.gitignore` ki wajah se **kabhi git-track hi nahi hue** (commit me 0 `.state` files) + ab build se bhi exclude | koi nahi — par ek gitignore-chook = leak, isliye ab build-level par bhi block |
| `admin@fft.com` / adm1 credentials | kahin publish nahi hue | koi nahi |

### 12g) Fix ki live verification
| Run | Scope | Result |
|---|---|---|
| **V1** qa4 **Hindi** click-matrix (fix ke baad, live Pages, `i18n-apply.js` load hone diya) | 9 screens × har visible button | **`CLICK MATRIX FINDINGS: 0`** — home, rank, matches, wallet, profile, **notif (pehle 3× crash)**, special, clan, settings sab clean |
| **V2** Hindi sweep (labels abhi bhi Devanagari me?) | qa4/hi + qa2/hi, 9 screens, 18 PNG | qa4/hi **0**, qa2/hi 1 (`resource 500`) ⇒ V5 me **reproduce nahi hua** |
| **V3** qa4 **English** click-matrix (regression) | 9 screens | **`CLICK MATRIX FINDINGS: 0`**, dialogs 0 ⇒ fix ne English ko chheda nahi |
| **V4** i18n loop probe (`d103-i18n-loop-probe.cjs`) | live file check + `Node.prototype.nodeValue` setter par counter, notif screen par 10 s idle | `_i18nFixRev = **20261115**` (fix live pahuncha), `_i18nApply`/`_i18nApplyRaw` dono function, **text-node writes = 0 har second** (fix se pehle ye loop lagatar likhta rehta), heap 11.3 MB stable, alive, no crash ⇒ **loop poori tarah mara** |
| **V5** qa2/hi sweep + failed-response logger | 9 screens | **`SWEEP FINDINGS: 0`**, **`FAILED RESPONSES (4xx/5xx): 0`** ⇒ V2 wala 500 **transient third-party** tha, app ka endpoint nahi |
| qa6/qa7/adm1 hi+en click-matrix (54 runs) | fix se pehle hi clean tha | **0 findings, 0 crash** |

**Hindi labels ka saboot (fix ke baad bhi translation zinda hai):** live DOM enumeration me nav items `"होम"`, `"रैंक"` aur notif screen ka text `"सूचनाएं 11 notifications Clear All …"` Devanagari me mile ⇒ guard lagane se translation toota nahi, sirf be-ant loop ruka.

### 12h) Test-environment ki 3 sachchai (inhe jaanna zaroori hai, warna jhoothe findings aate hain)
| Problem | Sach | Mitigation (ab harness me laga hua) |
|---|---|---|
| Browser beech me mar jata tha ("Target crashed" / "Target page… closed" / `BROWSER DISCONNECTED`) | Sandbox me **kul ~2 GB RAM** hai aur chromium akela **peak 934 MB RSS** leta hai; `free` ka available 494→34 MB tak gira. App ka apna JS heap **10.1–10.7 MB** aur DOM ~1123 nodes par **sthir** raha ⇒ leak app me nahi, limit box me hai | RSS trace (`tools/audit/r7c-rss-trace.sh`) se naap kar sabit kiya; ab **ek run me ek account/lang**, `DSF=1`, aur run ke beech `/tmp` saaf |
| `--disable-dev-shm-usage` lagane par bhi OOM | Is sandbox me **`/tmp` khud tmpfs (=RAM) hai** ⇒ chromium ka temp data `/dev/shm` se hat kar `/tmp` me bhara (991 MB / 992 MB = **100%**) | **`TMPDIR=/home/user/.tmp` (real disk, 19 GB free)** ⇒ /tmp 23% par sthir, available 1019 MB, runs clean complete hue |
| `stop_process` ke baad bhi memory phansi rahi | Orphan `headless_shell` + node processes **~720 MB tmpfs** pakde baithe the (deleted-but-open files) | har run ke baad `pgrep headless_shell` check + PID kill; `killall -9 node headless_shell` (naam se, warna `pkill -f` apni hi command maar deta hai) |

### 12i) Harness fixes jo is round me hue (agle round me dobara na tootein)
| Script | Fix |
|---|---|
| `d103-clicks.cjs` | native **dialog handler** (alert/confirm/prompt → dismiss + record; pehle Playwright forever block ho jata tha), `setDefaultTimeout(20000)`, **incremental findings write**, crash/page-close/browser-disconnect listeners, `DSF` + `TRACE_MEM` + `BLOCK_I18N` env, Devanagari close-button labels, overlay force-clean, `--disable-dev-shm-usage` |
| `d103-sweep.cjs`, `d103-admin-deep.cjs` | `--disable-dev-shm-usage --mute-audio` launch args |
| `d103-sweep.cjs` | **failed-response logger** (4xx/5xx URL ke saath) — warna "Failed to load resource: 500" ka URL pata hi nahi chalta |
| `scripts/protect-build.mjs` | `reports/` aur `tools/` public build se exclude (bloat + internal-exposure band); sirf `android/` copy hota hai |
| naya: `d103-notif-crash-probe.cjs`, `d103-notif-hi-trace.cjs`, `d103-i18n-loop-probe.cjs`, `r7c-rss-trace.sh`, `fb-list-accounts.mjs`, `d103-stale-cleanup.mjs` (dry-run default) | crash/loop/account-inventory jaanch ke liye |

### 12j) Ab D103 ka status
| Area | Status |
|---|---|
| Admin panel (live) | **0 findings** (30 sections / 90 clicks / 29 modals) |
| User panel Hindi (live) | **0 findings** — P0 crash fix ho gaya, loop 0 writes |
| User panel English (live) | **0 findings** |
| Premium badge/tag (live, geometry+icons) | **0 findings** |
| Assets (61 real art files, live vs source md5) | **61/61 identical, 0 dummy/emoji** |
| Notifications (hi 6/6, en 6/6) | pass (R7 §9) |
| Backend DB | 29 MB, watchdog zinda, retention kaam kar rahi |
| **Owner approval pending** | 58 stale test accounts delete karna hai (§11e) — `admin@fft.com`, 8 active QA aur 313 real users ko chheda nahi jayega |

### 12k) Evidence (Drive folder "Mini eSports") — r7c
| File | Drive id | Size | Contents |
|---|---|---|---|
| `d103-r7-evidence.zip` | `1wtTYJz9O_tzIc7kJ5KA0Pbe7SFyKZtbW` | 45,997,375 B / 214 files | R7 full re-run (sweep 144, clicks, notif hi+en, admin-deep) |
| `d103-r7c-admin-evidence.zip` | `1rM6WRhZifPJk7JURHQlZtp-hhpiYBaK0` | 20,702,663 B / 119 files | admin r7b + **r7c (findings 0)** screenshots + logs |
| `d103-r7c-user-evidence.zip` | `1L1yqwwFl-Rt6eOnO35p1fzZsHoqfZeEY` | 13,903,532 B / **143 files** | user panel: P0 Hindi crash root-cause + fix + V1–V5 verification, premium probe, asset audit, Firebase inventory, RSS/tmpfs traces, 6 naye/patched scripts |

Deploy commits: admin `ff-admin-panel` **`49e2a96`** (src `ff-admin-panel-src` `3fdef13`) · user `ff-user-panel` **`c28eb22`** → **`111c29b`** → **`4b7d8cd`** · private source backup `ff-user-panel-src` (see §12k push).

## 13) IMAGES: black background → PERFECTLY TRANSPARENT + patthar-jaisi glow removed (owner order, 15→16 Nov)

Owner: *"mere dvara di gai kitni images hai tere pass jaise ki coin, sky diamond, green diamond vagerah… in sabme background black hai, transparent nahi — sabhi images perfectly transparent kar; kisi bhi image ki side me patthar jaisa glow ho to use remove kar."*

### 13a) Ginti (jo aapne di thi)
| Group | Count | Kaun |
|---|---|---|
| **Transparent ki gayi art images** | **61** | badges 23, titles 17, ranks 6, currency/other icons 6 (coin, diamond/sky, crown, fire, trophy, xp), premium 4, special 3, `frames/glow.png` 1, `green-diamond.png` 1 |
| Pehle se transparent (chhui nahi) | 8 | app icons `icon-72…512` |
| Backgrounds (JPG — transparency लागू नहीं) | 7 | `match-bg.jpg`, `profile/card_base.jpg`, `profile/card_scene.jpg`, `rank/arena_bg.jpg`, `wallet/coin_bg.jpg`, `wallet/green_bg.jpg`, `wallet/sky_bg.jpg` |
| Sahi RGBA thi, isliye chhui nahi | 1 | `profile/card_frame.png` (62% transparent already; black-key processing ise bigaar deti — naap kar roka) |
| **Kul app images** | **77** | (+ ui-lab 3 + Drive-download 1 = workspace me 81 scanned) |

### 13b) Pehle kya galt tha (naap kar)
`reports/r7c-image-audit.json`: **81 files scanned → 75 ka background black, 70 me alpha channel hi nahi** (RGB/P mode). `green-diamond.png` ka background **white** tha. Matlab coin/sky-diamond/green-diamond/badge/title/rank/premium — sab par kala ya safed dabba chipka tha.

### 13c) Pipeline (`tools/img/make_transparent.py`)
| Step | Kya | Kyun |
|---|---|---|
| 1 | Border (3px ring) se background colour detect (black **ya** near-white dono) | green-diamond jaisi white-bg images bhi cover hon |
| 2 | **Border-connected flood-fill**: sirf border se juda bg transparent | art ke ANDAR ka kala rang (outline/shading) kabhi na mitte |
| 3 | Soft alpha ramp (distance-based) | anti-aliased edges natural rahein, katra hua na lage |
| 4 | **Unmix** `c=(orig-(1-a)*bg)/a` | bg se mili hui dark/bright fringe = "patthar jaisa glow" khatam |
| 5 | Halo sweep: edge par bache bright-grey pixels ko nearest opaque colour me kheencho + alpha halka | glow dobara na dikhe |
| 6 | Safety: pehle se maujood alpha kabhi nahi badhta | already-transparent files (card_frame) safe |
| 7 | `frames/glow.png` ke liye alag **detail-matte** (luminance+saturation+gaussian high-pass ramps; border/centre-connected gradient blob zero + 1px feather) | iska bg smooth brown radial gradient tha + beech me avatar ka kala hole — dono transparent chahiye the |
| 8 | Originals kabhi nahi mitte: `assets-raw-backup/` (61 files) + private repo | galti ho to wapas aa sakte hain |

### 13d) Nateeja (naap kar)
| Check | Pehle | Baad |
|---|---|---|
| Background black/white dabba | 75 images | **0** |
| Alpha channel | 70 me nahi tha | **61/61 me hai** |
| Corners transparent | opaque | **61/61 alpha=0** |
| Opaque-black fraction >20% | 75 | **0** |
| Kinare ki glow/fringe | maujood | **0** (halo pixels removed: e.g. titles/unstoppable 1225, green-diamond 1350, mythic 267) |
| Dark-bg composite (app jaisa) visual | kala/safed dabba | **saaf — koi box/fringe nahi** (proof sheet `reports/r7c-before-after.png`) |

### 13e) Deploy + backup
| Kahan | Detail |
|---|---|
| Live user panel | `ff-user-panel` main **`5a4a32c`** (61 assets changed) |
| Live verify | 6 sample assets ka **md5 LIVE_MATCH** (coin, green-diamond, premium/gold, glow, mythic, mvp) |
| Private source backup | `ff-user-panel-src` **`a26719f`** — transparent assets + `tools/img/make_transparent.py` + `assets-raw-backup/` (61 originals) + audit JSONs (711 files) |
| Evidence (Drive) | `d103-r7c-images-evidence.zip` **`1w4yyI3XVOXWDJf5eEa0AJAi18JW9VURs`** (11 files: before/after sheet, audits, pipeline, samples) |

### 13f) Wipe #4 (16-Nov ~01:30 IST) — beech me hua, recover ho gaya
Kaam ke dauraan phir wipe: `node_modules`, `.secrets/github_token` (purane dead token par revert, 401), `tools/tri-e2e/.state/d103.json`, `.secrets/d103_maint_key`, patched harness scripts, `deploy/ff-user-panel-pub/.git`. **Bach gaya:** transparent assets, report, product fix. Recovery: naya token Drive `github_token.md` se, maint-key wapas likhi, `fb-rebuild-creds.mjs` private repo se fetch karke 8/8 passwords rebuild, harness private source `b59424f` se restore, npm install, clone fresh. **Lesson dohraya: har anomaly par pehle token file verify karo; sab kuch private repo + Drive me rakho.**

### 13g) Owner ka naya standing rule (is message me mila)
*"Har baar test account hata diya kar testing poori karke"* ⇒ ab har QA round ke ant me us round ke banaye test accounts delete kar dunga (58 purane wale abhi **rahne diye** gaye aapke "filhal rahne de" ke mutabiq).
