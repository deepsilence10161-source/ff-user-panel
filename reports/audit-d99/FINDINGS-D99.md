# D99 — Third-Party Audit: Poora Fix + Sachhi Report (09-Nov-2026)

Owner ka audit report `ff-user-panel-src-main.zip` par aaya tha. Ye zip **PRE-D98 snapshot**
tha (us waqt smoke 255/255, screen-e2e 207/207) aur analysis **static-only** thi (live
Supabase/Firebase ke bina). Isliye kuch findings HEAD par pehle se fixed nikli, kai asli
nikli, aur mere apne live gates ne 2 **naye** critical issues bhi pakde jo audit me nahi the.
Neeche har finding ka LIVE/current-source par verify kiya gaya status hai — koi over-claim nahi.

---

## A) Audit findings jo HEAD par PEHLE SE fixed the (live verify kiya, kuch nahi karna pada)

| Finding (audit) | Status @ HEAD (pre-D99) |
|---|---|
| Withdrawal "Amount refunded" wording confusion (F3-class) | D98 me wording + ticker semantics fix; D99 me client-side fake-refund code bhi hataya |
| GD = points semantics / entry-fee wording | D87 + D98 guards se covered (smoke 34x/35x) |
| Offline probe spam | D97 F1 fix (smoke 34a) |
| Stored-XSS profile bio/ign | D97 F2 fix (smoke 34c–e) + sink-iso clean |

## B) Audit findings jo IS release me FIX hue (sab live DB/source par pehle confirm kiye)

### B1. SQL — `supabase/migrations/20261109_d99_audit_fixes.sql` (LIVE APPLY + COMMIT, 14 functions)
Rollback safety: purane live defs `reports/audit-d99/live-defs/*.sql` (11 files) me committed.

1. **gift_match_entry currency bug (P1, money)** — live `matches.entry_type` distinct =
   `'coins'` (4 rows) tha, purana function har gift par **Sky Diamonds** kaat raha tha.
   Ab `norm_entry_type()` + `wallet_col_for_entry_type()` helpers se sahi wallet
   (coins / sky_diamonds / green_diamonds / none); GD-entry match par gift **reject** (D87).
2. **gift joinability (P1, money)** — pehle paisa kat-ta tha, entry baad me (ya kabhi nahi).
   Ab debit se PEHLE pre-flight: match `upcoming` ho, recipient pehle se registered na ho,
   `filled_slots < max_slots` (warna "Match full hai"); phir debit + join_request insert
   (`entry_fee_paid=0`) + `filled_slots` bump + `gift_tickets.status='delivered'`.
3. **join_match_team GD parity (P2)** — `greendiamond` entry par `v_server_fee := 0`,
   `v_fee_mode := 'free'` (D87: GD se fee kabhi nahi).
4. **cancel_match_with_refunds (P1, money)** — gift dene wale (`from_uid`) ka refund pehle
   nahi hota tha. Ab `gift_tickets` (delivered, fee>0, FOR UPDATE) loop → helper column se
   refund, ledger `match_cancelled_gift_refund`, ticket → `refunded`; RETURN me
   `gift_refund_count`.
5. **admin_confirm_creator_cheat (P1)** — helper column se 3-way refund; ledger row SIRF jab
   balance asli me credit ho; `status NOT IN ('refunded','cancelled')` guard → coin/paid/sky
   par jhoothe "credit" ledger rows band.
6. **admin_dismiss_creator_flag / creator_publish_result (P2)** — prize wallet 3-way
   (coins / green_diamonds / warna sky with forced label); ledger currency = jo wallet asli
   credit hua (pehle raw entry_type likha jata tha, e.g. 'sky_diamond').
7. **claim_ad_reward origin (P1, anti-fraud)** — purani check `origin NOT LIKE '%github.io%'`
   thi → `https://evil.x/deepsilence10161-source.github.io` pass ho jata tha. Ab EXACT host
   allowlist (github.io + workers.dev, trailing-slash variants).
8. **claim_watch_earn_reward (P1)** — isi class ka guard pehli baar laga (pehle bilkul nahi tha).
9. **ad_watch_start stacking (P2)** — naya session se PEHLE purane open sessions `consumed=true`
   → ek waqt me ek hi open session (daily-cap stack karke reward-farming band).
10. **sponsored withdrawals parity (P2)** — `submit/resolve_sponsored_withdrawal` live committed;
    reject branch sachha `sponsored_winnings` balance read karta hai (submit par deduction hota
    hi nahi → `refund_required=false`, `balance_deducted_at_submit=false`).
11. **No-fix-needed verify kiya:** `publish_match_results` / `correct_match_result` (prize kabhi
    Sky nahi), `claim_match_refund(_inner)`, cancel ka coin/GD mapping — sab sahi.

### B2. Android — `MainActivity.java` (javalang parse OK; asli compile = public-repo CI ✔)
- `AndroidBridge.bridgeAllowed()` master-gate **27/29** `@JavascriptInterface` methods par;
  reject par `Log.w("⛔ Android bridge call REFUSED …")`.
- `TRUSTED_APP_HOSTS` / `TRUSTED_GOOGLE_HOST_SUFFIXES` + `hostOf()/isTrustedAppHost()/
  isTrustedNavHost()` — saari `.contains()` substring checks hata kar **Uri-host exact match**.
- WebView hardening: file/content/fileURL access off, `savePassword` off,
  `MIXED_CONTENT_NEVER_ALLOW`, `setSupportMultipleWindows(false)`.
- APK update/install: `isAllowedUpdateUrl()` host-allowlist (≥4 trusted sites) se gated;
  `downloadAndInstallApk` → `downloadAndInstallTrusted(..., bridgeAllowed() && urlOk)`.
- Geolocation prompt gated.

### B3. Client (web/APK dono)
- `js/fix5-listener-manager.js`: withdrawal-reject par client-side **fake credit** + jhootha
  "Amount refunded" toast HATAYA (submit par paisa kata hi nahi hota) → sachha message:
  "❌ Withdrawal rejected — amount aapke balance me hi hai (kata nahi gaya tha)."
- `core/db-bridge.js`: blocked money/premium/ledger paths ab `Promise.reject(new Error('BLOCKED: …'))`
  + `window.__bridgeBlocked` counter (pehle fake-success `{error:null}` resolve hota tha).
- `firebase-security-rules.json`: `_STATUS: LEGACY / DO-NOT-TRUST` marker (file deployed nahi hai).
- `package.json`: `npm test` = smoke suite (+ `test:smoke/screen/asset`).

### B4. Build/zip (audit: "zip se build nahi hota")
- `android/gradlew`, `gradlew.bat`, `gradle/wrapper/*` (Gradle 8.2) committed.
- `build.gradle` `gitCommitCount()` fallback → root `VERSION_FALLBACK`; release script step **4b**
  har release par ise `git rev-list --count HEAD` se refresh karta hai (ab 561).
- versionCode self-consistent: CI-built APK `versionName 1.0.586 / versionCode 586` (pichhla 585 → bump ✔).

## C) MERE LIVE GATES NE PAKDE NAYE ISSUES (audit me nahi the)

### C1. D99-F1 — stored-XSS sink sweep (P1)
`tools/audit/xss-pass.cjs` + naya `tools/audit/stray-where.cjs` chalane par **chat screen par
2 ZINDA payload nodes** mile: `#chatMsgs` ke andar `<img src=x onerror=…>` aur `<svg onload=…>`
(stray=2, xss=0 — handler is sandbox me ORB/load-timing se nahi chale, lekin DOM injection asli thi).
Wajah: `screens/support.js renderChatList()` message text ko RAW `innerHTML` me daalta tha
(admin reply ya koi stored message HTML chala sakta tha). Fix + poora sweep:

| Sink | Fix |
|---|---|
| support-chat bubble text (admin+user) | `escHtml` |
| toast — `core/utils.js` **aur** `js/fix9-toast-queue.js` (active `window.toast` sink) | `escHtml(msg)` |
| matchFeed event text (`js/features-user.js`) | `escHtml` |
| clan name/tag/emblem, clan-war apna+opponent name | `escHtml` |
| duel/challenge IGN, friends/mentor IGN, auto-squad IGN+rank_tier, bracket tournament/round name | `escHtml` |
| duo/squad-mate partner names (`core/utils.js`) | `escHtml` |
| inline `onclick="fn('<val>')"` contexts (ign/clan-name me `"` se attribute breakout; DB CHECK sirf `< >` rokta hai) | **naya `window.escAttrJs`** (JS-escape ke baad escHtml) |

Ab: xss-pass `xss=0, stray=0` (chat + share-card samet); sink-iso clean; smoke **TEST 37** guards
(+ 37g saved live evidence padhta hai). Static scanner `tools/audit/html-sink-scan.cjs` committed,
baseline `reports/audit-d99/html-sink-scan.txt`.

### C2. D99-F3 — `scripts/post-release-verify.sh` ke 2 FALSE-ALARM bugs
- Release-asset download bina `Accept: application/octet-stream` ke **JSON metadata** lauta deta
  tha → uska hash nikalta tha → jhootha "❌ SHA-256 MISMATCH" (asset sahi tha: manual verify
  `8c7e36fb…40d2` = `.sha256` asset).
- `urllib` redirect par `Authorization` header Azure blob ko bhi bhejta tha → HTTP 401 →
  real-app screenshots download hi nahi hote the.
- Fix: `curl_bin()` (curl cross-host redirect par auth khud strip karta hai). Ab verify poora green.

### C3. D99-N1 (observation, fix nahi kiya — owner decision)
Sandbox Chromium me `lh3.googleusercontent.com` avatars `ERR_BLOCKED_BY_ORB` hote hain (isolated
bare-`<img>` test se prove — environmental). Real browsers par Google avatars normal load hote hain,
lekin app me koi avatar `onerror` fallback NAHI hai → CDN/ORB hiccup par toota hua image dikhega.
Bolenge to agle pass me central fallback laga dunga.

## D) Owner decision points (documented, implemented nahi)
- **AdMob SSV:** server-side verification sirf AdMob/APK surface cover karti hai; wahi
  `claim_ad_reward` web ad providers ko bhi serve karta hai → global `adSsvRequired` flag web
  rewards tod dega; client-supplied platform claim attacker-controlled hai. Asli answer =
  **Play Integrity attestation** (Google Cloud console + owner action). Current live hardening
  (exact Origin allowlist, single open session, 4–150s window, 15s rate-limit + daily caps,
  `FOR UPDATE`) hi abhi ki mitigation hai.

## E) Verification matrix (is release ke numbers)

| Gate | Result |
|---|---|
| smoke suite | **309/309** (TEST 36 D99 guards + TEST 37 XSS guards) |
| screen-e2e | **207/207** |
| asset-e2e | **26/26** |
| click-all (live, QA login) | **437 clicks, 0 pageErrors, 0 consoleErrors** (84 failedReqs = sandbox ORB, C3) |
| xss-pass / stray-where | **xss=0, stray=0** har screen |
| probe-check / sink-iso | 0 bad events / clean |
| **live gift E2E** (`tools/audit/d99-gift-verify.mjs`) | **17/17** + QA residue 0 (Supabase+Firebase+RTDB) |
| fresh-boot gate (D89) | crash: NONE |
| CI (public repo) | Build APK **success** (pehla run Gradle-download 504 infra-flake → rerun), Pages **success**, **E2E Emulator success** (real APK install, 5 screens ✓, ASSET-E2E 60/60, SCREEN-E2E 100/111 = protected-build wiring expectation, logcat: koi app crash nahi, 0 bridge-refusals) |
| post-release-verify | REAL-APP screenshots **8** + SHA-256 **MATCH** + zip-integrity OK |
| Pages live content | `index v=20261109f`; `escAttrJs`, support/toast escaping live present |
| SQL live proof | `d99_proof` 16/16 green + independent `sqlq.mjs` read-path all-1 |

## F) Drive perfect-organise (owner rule 09-Nov-2026)
- Root me ab **sirf 7 category folders**; 26 scattered items nest kiye, kuch delete nahi.
- Naya snapshot: `mini eSports/user panel/project10/ff-user-panel-source-project10.zip` (59.2 MB).
- Purana loose D88 zip → `user panel/project0 (D88 legacy)/`.
- Counter: `reports/drive-project-counter.json` → `user: 10`.
- Chat Doc §66 likha gaya (poora record + ye report ka saar).

## G) Evidence paths
- `reports/release-evidence/20261109-0629/` — 8 real-app screenshots + summary.md + APK hash proof
- `reports/audit-d99/` — `xss-d99.json`, `live-click-d99.json`, `html-sink-scan.txt`, `live-defs/`, `live-all-fns.json`
- `tools/audit/d99-gift-verify.mjs`, `tools/audit/fb-admin.mjs`, `tools/audit/html-sink-scan.cjs`, `tools/audit/stray-where.cjs`
- Commits: `2bb8172` (fixes) → `4267c10` (release stamp); public `d64fc9b`.
