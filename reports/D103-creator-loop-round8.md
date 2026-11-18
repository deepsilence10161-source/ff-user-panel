# D103 Round-8 — Creator loop end-to-end band (16-Nov-2026)

Owner order: "TDS abhi karna hi nahi hai, baaki kaam continue karta rah."

## 1) Referral engine entry fix (P0 bug)
- **Bug:** `apply_referral_code` RPC sirf `users.referral_code` dekhta tha; creator promo codes `creator_codes`/`users.creator_code` me hain (qa2 ka referral_code NULL tha) → creator ka code "Invalid referral code" deta tha → referral commission stream entry par dead.
- **Fix (migration `d103_referral_code_creator_bridge`):** lookup chain = creator_codes.code → users.creator_code → legacy users.referral_code. `referred_by` canonical = referrer UID.
- **Bug 2:** `js/fixes-v7.js` ka ?ref auto-apply ek hi attempt karta tha; bearer-token sync 1-2s late ho to "Not authenticated" chup-chaap swallow ho jata → attribution dead. **Fix:** transient errors par retry (60 ticks), terminal par hi stop.
- **E2E proof:** naya seed account `crseed1@qa-miniesports.dev` (uid `eu0fvprowtXrCOaeCfPVhgu943a2`, IGN "QA RefSeed") `?ref=CRQA2DEV` link se signup → referred_by = qa2 ✅ → premium request approve simulate → trigger → **₹9.70 referral commission LOCKED** (99×0.98×10%) ✅.

## 2) Referred-users list fix
- **Bug:** dashboard refs query `users.referred_by = code` use karti thi (referred_by uid hota hai), aur users RLS (`users_select_own`) dusre users padhne hi nahi deti → REF USERS hamesha 0.
- **Fix:** migration `d103_creator_referred_users_rpc` = security-definer RPC jo sirf auth.uid() ke referred users lautata hai, **IGN masked** (pehle 2 char + ***); grant migration `d103_referred_users_grant_anon` (Firebase JWT par role anon hota hai); label polish `d103_referred_users_ign_label` (IGN null → "naya user").
- Dashboard v2 ab `s.rpc('creator_referred_users')` use karta hai. Proof: REF USERS: 1 chip + "QA*** · 2026-11-16 · FREE" row (screenshot bottom).

## 3) Creator notifications (migration `d103_creator_wallet_notifications`)
- `trg_creator_commission_notify`: commission insert hote hi creator ko in-app notification ("💰 Commission LOCKED: ₹X — stream, rate, hold note").
- `trg_creator_payout_notify`: payout status change par notification (PAID / rejected / pending).
- Proof: bell screenshot `reports/creator-notif-bell.png` me "Commission LOCKED: ₹0.10" card; payout loop ke baad "✅ Payout PAID: ₹1.00" row DB me.

## 4) Admin panel — Creator Wallet v2 (naya section)
- File: `ff-admin-panel-src/js/fa23-creator-wallet-admin.js` (+ index.html script tag `?v=20261116a`); pub `0e7c6ec`, src `c563653`.
- Teen tables: **Wallet Overview** (creator_wallet view: locked/available/paid/reversed + rating + status; total chip), **Payout Queue** (pending badge + Mark PAID / Reject buttons), **Recent Commissions** (last 50: stream/amount/rate/state).
- Purana Creator Program payout queue Firebase RTDB par tha — naye Supabase wallet engine ke payouts wahan kabhi nahi dikhte the; ye panel wo gap band karta hai.
- Screenshot: `reports/admin-creator-wallet.png` (QA-Two Premium ₹101.10 locked / 7 rows; commissions list poori).

## 5) Payout approval loop proof
- Test payout ₹1 pending insert (id `7e754479…`) → admin UI se "Mark PAID" click (confirm-dialog accept) → DB status **paid** + trigger notification "✅ Payout PAID: ₹1.00" ✅. Ye ₹1 paid row ab seed demo hai (dashboard Payouts section me dikhta hai).

## 6) Wipe #6 recovery (turn ke beech)
- Gaya: pub/srcfresh/admin clones ke .git, node_modules, chromium, QA state, kuch tools scripts, token revert.
- Recovery: token rewrite (API 200), `fb-rebuild-creds.mjs` src-raw se refetch + state rebuild (8 accounts + refseed entry), npm install 237, chromium+libs reinstall, clones re-clone (pub/src/admin-pub/admin-src).

## 7) Commits (is round)
- user pub: `5bffe30` (refs fix+tag d) → `9167f87` (fixes-v7 retry+tag e) → `e6ca019` (refs RPC+tag f)
- user src: `0490d5b` → tag-e commit → `…` (refs RPC source)
- admin pub: `0e7c6ec`; admin src: `c563653`
- DB migrations: `d103_referral_code_creator_bridge`, `d103_creator_referred_users_rpc`, `d103_referred_users_grant_anon`, `d103_referred_users_ign_label`, `d103_creator_wallet_notifications`

## 8) Screenshots (reports/)
- `creator-studio-v2-top.png` (₹101.00 / 6 rows / REF USERS: 1 / nayi ₹9.70 row)
- `creator-studio-v2-bottom.png` (masked QA*** ref row, payout button, promo kit)
- `creator-notif-bell.png` (commission notification card)
- `admin-creator-wallet.png` (wallet overview + payout queue + commissions)

## 9) Aage bacha hua (plan v3, TDS ke alawa)
- Gifts 70/30 + GD sinks + sponsor flow (P2/P3)
- Naya APK build + real-device Devanagari/emoji check
- 58 stale test accounts (owner: "filhal rahne de")
- Payout queue ka asli first payout (≥₹500 available) hone par owner-side UPI flow dry-run
