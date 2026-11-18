# D103-UI Round — Final Status (17-Nov-2026)

Owner order: "testing + tagging lagatar, har chij par dhyan, UI focus, leaderboard double-rank, non-transparent images" + "bina ruke kaam karo, bina update diye".

## 1) Owner bugs — FIXED + LIVE-VERIFIED
| Bug | Root cause | Fix | Proof |
|---|---|---|---|
| Leaderboard rank double | (a) row chip me duplicate badge img; (b) arena_bg.jpg art me baked hanging medals (#2/#3) + pedestal numbers | (a) screens/rank.js dup img removed; (b) arena_bg.jpg PIL inpaint (curtain+strut), stamp 20261117f | reports/ui-rank-top.png / ui-rank-list.png (live shots) |
| Non-transparent PNGs | 60/62 assets RGB/P no-alpha | 61 RGBA restore (transparent-for-drive MAP), img tag 20261117g | live gold.png RGBA md5-match |

## 2) Regression incident (wipe #8 ke baad)
- Wipe #8 ne local assets (arena_bg + 60 PNGs) revert kiye; post-wipe sync ne revert LIVE push kar diya (commits 64bf701/b8ccecf window).
- Pakda: sweep screenshot me hanging medals wapas; md5 audit.
- Fix: srcfresh se assets restore + tag g/stamp f → pub 9eae629. Live md5 verify.
- Guard: tools/audit/wipe-guard.sh (drift checker) — recovery ke baad ALWAYS run.

## 3) Test gates (sab ZERO)
- Click matrix: qa1–qa7 × hi/en × 9 screens = 0 findings (local harness + mock-supa v4).
- Functional sweep: 8 accounts × hi/en = 0 findings (final build-k).
- Admin sweep 0 + admin deep 31 sections/90 clicks/23 modals = 0.
- Notif probes PASS 6/6. Boot avg 0.9–1.7s. EN-mode Devanagari leak 0. PWA offline shell OK. SW precache 62/62 present.
- Supabase health 8/8 services; data counts intact (users 22, commissions 7, payouts 1, notifs 31).

## 4) Hindi polish (i18n-apply.js, tag 20261117k)
- ~90 keys + composite swaps; DOM-probe precision method (dbg-wallet-nodes.cjs etc.).
- Counts: home 9, rank 20, wallet 31, matches 18, profile 37 Devanagari strings; special tabs+banner Hindi.
- EN direction reverse-swaps clean (leak probe 0).

## 5) APK (Drive: mini-esports-LATEST-debug.apk)
- v1.0.6-d103ui: WebView wrapper + spinner splash + dark startup theme + screenshot-upload chooser + geolocation grant + offline retry page. minSdk 24/target 34. Project: apk-webview/ (source repo).

## 6) Commits (is round ke)
- user pub: 64bf701, b8ccecf, 9eae629, 12d69fc, e120789, 621864c, fa035fb
- user src: 0cfa84e, 7a5ac5d, 9d432ca, e55262d, b63e938, 3c810f1, d905498, 4fd9685?, 44a035e, ce4f5b2, fa6f195, 8d4ba99, e5bfeb3, 3f79c91, 6c6baf3, cbcdd34, 6a868b8, a2a7f9b, 8ed4eae, 56ae5c0
- admin pub: 0e83490, 85bade7 | admin src: fc0f249
- Tags: user img 20261117g, arena 20261117f, i18n 20261117k, admin 20261117c

## 7) Drive snapshots
d103-ui-evidence.zip, -evidence2, -evidence3-final, -evidence4, -evidence5, -evidence6; mini-esports-LATEST-debug.apk (v1.0.6).

## 8) Baaki queue (agla stretch)
- APK phone-feedback polish (owner install ke baad).
- Real-device Devanagari/emoji confirm (APK se).
- Matrix combos complete (sab ho gaye qa1–7 hi/en).
- 58 stale test accounts — owner: "filhal rahne de".
- TDS automation — owner: "abhi nahi".

## 9) Stretch 17-Nov (post round-close): i18n deep-dive tags j→v
| Tag | Scope | Live proof |
|---|---|---|
| j/k | special tabs+banner, clan/notif keys | scr-hindi-special.png clean |
| l | home chips/cards + chat + months/slots composites | home leaves: sirf SOLO/DUO/SQUAD/Bermuda/dynamic |
| m | wd/add/shop/clan/notif modals | modals nodes [] |
| n | match-detail modal (showDet) | title मैच विवरण, nodes dynamic-only |
| o | check-in streak + user-search modals + streak composites | checkin title 📅 चेक-इन स्ट्रीक nodes [] |
| p | profile ~40 leaves + composites | profile nodes: sirf name/UID/city |
| q | long-string (>44 char) pass | tagline translated |
| r | premium trial modal + public profile + voucher btn | trial nodes [] |
| s | clan-create modal (qa2) | 🏰 क्लैन बनाओ nodes [] |
| t | join-flow literals (join.js) | gates 0 |
| u/v | attribute-level i18n (title/aria/placeholder) + icon arias | attr probe home [] |

Probes added: dbg-homechat-nodes, dbg-modals-nodes(+qa5), dbg-checkin-qa5, dbg-profile-nodes, dbg-deep2-nodes, dbg-clancreate-qa2, dbg-join-nodes, dbg-attrs-nodes, dbg-home-race, dbg-matchlist.
Method note: observer settle ~4s zaroori (dynamic renders); Pages lag 40–90s after sync — probe uske baad.
Gates is stretch me: full sweep ×4 (builds k,o,q,t,v... har tag par) sab 0; matrix qa1–7 hi/en combos 0; en-leak 0 har tag; ui-sweep broken [] pageErrors []; notif 6/0; wipe-guard 0.
Commits: pub …9725362(l), db6d30d(m), e61c3a5(n), bba5be1(o), 192fec6(p), 8f9eb4e(q), a2e4762(r), 3035705(s), 23ec5f1(t), d9b0a91(u), 1b69ae5(v); src …43ba72f, 8ccc3ca, 832b870, c21e83d, d256d8d, 6fa6156, 4ae4333, 6b29ca8, b1bde9e, 447fd8d, e01b94e.
Drive: evidence7 1uweJPURbE4q72j7NivOfkyKUTxNYhBgh, evidence8 1dsNmp-1_KBPLmq3dOHGMeh0zkxGOKweY, evidence9 1snXMxfSs9wnfIRsw5qFMuhFGAurv4jIb, evidence10 1XUpUinxMPP-SZQ0UUuXluDiyS5CGA7DV.

## 10) Stretch 2 (tags w→z1): login/earn/maintenance/verify + dict-placement fix
- polish-12 keys galati se ATTR_HI me ghusi thi → EN2HI me move (tag x); comma-miss syntax fix same tag par.
- polish-13: earn-modal (Coins Kaise Kamao) leaves; polish-14: maintenance overlay + verify banner; z1: 47-char maintenance fragment LONG pass me.
- Live proof (dbg-tutorial-nodes qa6): login screen Hindi, earn modal Hindi, maintenance Hindi, verify banner Hindi; bache: brand ticker words + FF terms + dynamic identity only.
- Gates: en-leak 0 (text+attrs), ui-sweep broken [] pageErrors [], matrix qa4/en+qa5/en+qa2/hi 0, full sweep build-v 0 & build-z1 0, notif 6/0.
- Commits pub: 573b3dd(w), c48b1c1(x), cd1cd44(y), bd4bf25(z), e060f4e(z1); src: 5acc2d6, b0965b0, d7342d9, 2c8f5e0, 1fb01c7.

## 11) Stretch 3 (tags z2→z5): status chips, result/room/compliance/checkout i18n
- z2: match status chips (✅ पूर्ण/🔴 लाइव/🚫 रद्द) + empty states; z3: result-page + features-user labels/badges/toasts; z4: room-reveal; z5: compliance form, paytm checkout, clan-war, notif toasts + state names.
- Hindi coverage counts (dbg-hi-screens, tag z3): wallet 61 / matches 41 / profile 141 (pehle 33/20/141... wallet/matches badhe).
- Result-page deep flow state-dependent (completed matches chahiye) — literals source-scan se translate (join.js pattern).
- Gates z3–z5: en-leak 0, ui-sweep clean, matrix regressions (qa6/en, qa1/en) 0, notif 6/0, FULL SWEEP build-z4 = 0.
- Commits pub: 8fc78c4(z2), c5e3cf7(z3), 725bd45(z4), eb5880a(z5); src: a0277bb, 87efccd, 790b5c8, 8643d13.

## 12) Stretch 4 (tags z6→z7): timer/push/security keys; final gates
- z6 tag-only push (edit-chain miss); z7 me polish-19 keys live: Cancelled/Ended timer labels, push permission toast, security toasts (Suspicious login/UTR/No file).
- Gates z7: en-leak 0, ui-sweep clean+pageErrors [], matrix qa2/en 0, FULL SWEEP 0.
- Supabase 4/4 ACTIVE_HEALTHY (realtime db_connected true).
- Commits pub: a2be66e(z6 tag-only), 54a9170(z7); src: 7041ac7, eeccaea.

## 13) Stretch 5 (tags z8→z9): EN "days left", lang-thrash stability, final sweep
- z8: 'din baaki'→'दिन बाकी' (HI); z9: EN mode me source-Hinglish 'din baaki'→'days left' (rank shot crop se verified).
- dbg-langthrash: hi→en→hi ×3 → wallet Devanagari 30→30→(en)0→30 — koi stuck/mixed state nahi.
- FULL SWEEP build-z9 = 0; wipe-guard 0; rank shot pageerrors 0.
- Commits pub: 3f5d855(z8), 9c09abd(z9); src: 93ff967, 005eea0, 81ccc7f(probe).

## 14) Hindi coverage matrix (live, tags z3–z9)
| Screen/Area | Devanagari strings | Bache English leaves (by design) |
|---|---|---|
| Home | chips/cards Hindi | SOLO/DUO/SQUAD, Bermuda, dynamic match titles, brand ticker |
| Matches | 41 | status chips Hindi; empty states Hindi |
| Rank | 79 | tier art (image), formula Hindi |
| Wallet | 61 | — |
| Profile | 141 | name/UID/city (dynamic identity) |
| Notif | empty-state Hindi | — |
| Special | tabs+banner Hindi | — |
| Support chat | [] leaves | — |
| Modals (wd/add/shop/clan/create/trial/checkin/search/result/room) | titles+nodes Hindi | dynamic values |
| Attributes (title/aria/placeholder) | [] English leaves (hi) / [] Devanagari (en) | — |
| Login/earn/maintenance/verify | Hindi | brand words |
| Toggle thrash hi↔en ×3 | stable 30→30→0→30 | — |

## 15) Stretch 6 (tags z10→z13): 17-modal inventory sweep (dbg-allmodals)
- dbg-allmodals.cjs: QR/rules/recent-joins/winners/refer/report/dispute/season/bio/txn/views/clanLB/join-by-code/clan-chat/cert/calendar/feed — sab dump.
- polish-20: 17 modals ke ~60 keys; polish-21: rules lines + 🏆 Clan Leaderboard title + ' Player' composite; z13: 49-char rules line LONG pass me (z12 tag-only tha, edit-chain miss dohra).
- Live proof: allmodals re-run → sirf dynamic/UID/AFK/clan-names bache; QuickRules nodes [].
- Gates z13: en-leak 0, ui-sweep clean, matrix qa3/en 0, FULL SWEEP 0.
- Commits pub: eb06e3f(z10), e221abb(z11), e09cfe2(z12 tag-only), 9052ee1(z13); src: 7fdb463, 83d5f5e, 4400f6d, 0536d39.

## 16) Stretch 7 (tag z14): dispute/refund keys; gates
- polish-22: 'Report Dispute' title + dispute/refund toasts. Certificate canvas strings English by design (download-image official style); showMatchCalendar removed per user request (code comment).
- Gates z14: en-leak 0, matrix qa4/hi 0, notif 6/0, wipe-guard 0, FULL SWEEP 0.
- Commits pub 470292a(z14); src 4ba3f91.

## 17) Stretch 8 (tags z15→z16): Hinglish toast translation batches
- polish-23: 55 toasts + 8 LONG; polish-24: 52 toasts + 8 LONG (source-scan: toast(/showToast(/dispMsg( literals).
- Trailing-space toast keys trim-fix; suffix composites (Interest save/Challenge bhej/Clan full).
- Gates z16: en-leak 0, ui-sweep clean, matrix qa5/hi 0, FULL SWEEP 0.
- Commits pub 9afe62d(z15), c61b450(z16); src 546965b, ee272cc.

## 18) Stretch 9 (tags z17→z18): toast batch-3 + emoji key fix
- polish-25: 40 toasts + 20 LONG (emoji-prefixed success/error toasts); z18: '🆕 New app update...' key emoji fix.
- Gates z18: en-leak 0, lang-thrash 30→30→0→30, ui-sweep clean, matrix qa6/hi 0, FULL SWEEP 0.
- Commits pub f6bbd6d(z17), ebf0671(z17b tag-only), cd6f88c(z18); src 48a6a60, 1c28526.
- Hinglish jo by-design bacha: welcome sheet, brand ticker, legal long-form, certificate canvas.

## 19) Stretch 10 (tags z19→z21): cache-bust fix + marquee/countdown
- z19: tag-only cache-bust (z18 sed index.html miss gaya tha — live z17 par atka tha; ab har bump ke baad local+live tag verify karna zaroori).
- z20: tag-only (python edit AssertionError — heredoc+newline chain hazard #4; edit alag step me redo).
- z21: marquee LONG pair dono directions + countdown composite regexes ((\d+)d (\d+)h → $1 दिन $2 घंटे etc.).
- Commits pub c9fcb2d(z19), 74a2c89(z20), 4e10459(z21); src 5b53b15, d8a4895, f9886f8.
- **Layout/position/size audit (owner order: "bariki se")**: naya probe `tools/audit/dbg-hi-layout.cjs` (390×844, hi, qa1; 7 screens + 4 modals; in-flow-only overflow logic — absolute/fixed decorative children skip). Verdict: **ZERO real overflow/clip/off-viewport defects**. By-design hits: rank `.rn` names ellipsis (text-overflow), home absolute radial-glow div, profile badge-tile blur circle (false-positive). Shots `reports/ui-sweep/hi-layout-*.png`.
- Sandbox fonts: Devanagari install kiya (`/home/user/.fonts/NotoSansDevanagari.ttf` + fc-cache) → screenshots me ab Hindi render hoti hai; emoji tofu = sandbox-only artifact (device par theek).

## 20) Stretch 10b (tag z22): baked-English IMAGE assets → Hindi variants
- Discovery: wallet card titles ("SKY DIAMOND BALANCE"/"COINS"/"GREEN DIAMOND" + 4 bullets) aur profile-card stat labels (Matches/Kills/Wins/K/M/Win Rate) DOM me NAHI — ye text assets ke andar baked tha: `assets/wallet/{sky,coin,green}_bg.jpg` + `assets/profile/card_frame.png` (canvas frame layer).
- Pipeline (`/tmp/mkhi2.py`, `/tmp/mkhi3.py`): bright-text cluster detect → edge-gradient clean-fill (feathered) / median-15 erase → Noto Sans Devanagari se Hindi redraw (color sampled from original glyphs). Outputs: `sky_bg_hi.jpg`, `coin_bg_hi.jpg`, `green_bg_hi.jpg`, `card_frame_hi.png` (alpha intact).
- Wiring: i18n-apply `swapBakedAssets(lang)` — inline-style bg swap + `img[data-pc2frame]` src swap; profile-card2-core `frameAsset()` lang-aware; ticker DB-text ke liye `window._i18nTick` (multi-occurrence split/join — duplicated ticker node ab poora Hindi).
- Live verify (z22 shots `reports/ui-sweep/z22-*.png`): wallet teeno cards + bullets Hindi; profile card labels मैचेस/किल्स/विंस/K/M/विन रेट; ticker "mini eSports में स्वागत — मैच खेलो, Coins & Diamonds जीतो ! • …".
- Commits pub 3967199; src 247ed1e.

## 21) Stretch 10c (tags z23–z24): async-render i18n leak fix
- Bug: home match-cards DB listener ke BAAD render hote hain → applyLang miss → card leaves English ("Entry Fee", "1st PRIZE", "View Only", "0/25 Slots (0% Full)", "07 Jan 2027").
- z23: childList-only MutationObserver + 260ms debounce (characterData observe NAHI — purana P0 loop wahin se aata tha; existing observer infra ke applying-flag/disconnect ke saath co-exists). EN chain me prize reverse ('पहला इनाम'→'1st PRIZE' etc.).
- z24: render-hook `window._i18nApply()` home.js:690 + matches.js:160 ke turant baad → ~1s English flash bhi khatam.
- Live verify z24 home shot: poora match card Hindi (एंट्री फीस / प्रति किल / शुरू का समय / पहला इनाम… / 0/25 स्लॉट (0% भरा) / केवल देखें / 07 जन 2027 / 1195 घंटे 24 मिनट).
- Gates z24: wipe-guard drift 0; en-leak {wallet:0,matches:0,rank:0,profile:0}; lang-thrash 30→30→0→30; qa4/hi 7-screen crash-probe 0 errors.
- By-design English (owner-approved): welcome sheet Hinglish, certificate canvas, brand/legal ticker, dynamic identity (IGN/UID/clan/city/match-titles), map/mode names (Bermuda, SOLO/DUO/SQUAD).
- Commits pub 220049a(z23), 3511a39(z24); src da00485, b19df95.

## 22) Stretch 10d (tags z25–z26): comps-on-long refactor + shop/wd Hinglish polish
- Structural: composite replace-chains ab `compHi(v)/compEn(v)` functions me; 44+ char text nodes par bhi lagti hain (pehle `length>44 continue` se skip hoti thin — isliye ⏳ special-line, check-in cycle line, shop banner adhoore translate hote the).
- LONG exact pairs (walker priority): WD email-verify body, shop banner "✅ Coins kharidne ki zaroorat nahi…".
- Check-in cycle dynamic string ke liye regex: /Day (\d+) par itne coins/ ↔ /दिन (\d+) पर इतने सिक्के/ + '7-din cycle'↔'7-दिन साइकल'.
- Live verify z26 shots (`reports/ui-sweep/z25-{shop,wd,special}.png`): shop modal poora Hindi (banner, cycle, tiles, footer); WD modal body Hindi; special ⏳ line Hindi.
- Gates z26: lang-thrash 30→30→0→30; en-leak 0; FULL SWEEP (z24 live) 14/14 keys findings=0 (adm1+qa1–qa6 × hi/en); wipe-guard 0.
- Commits pub d2ed8e4(z25), ff5593f(z26); src a3606a0, 6999764.

## 23) Stretch 10e (tags z27–z29): final polish + rank-row layout fix
- z27: search placeholder ATTR pair ('IGN ya FF UID search karo...' ↔ 'IGN या FF UID खोजें...').
- z28: rank top-10 tier titles (🔱 वारलॉर्ड/⚔️ स्लेयर/💫 एलीट/🎯 स्नाइपर/🔥 ब्लेज़/🌟 स्टार/🎖️ नाइट), wallet history chips (💎 स्काई/📉 आउट/📈 इन/🪙 कॉइन), rank formula comps ('Rank = '→'रैंक = ', 'Matches×1'→'मैचेस×1').
- Broad HI-Latin dump probe (`tools/audit/dbg-hi-latin-dump.cjs`, z28): home/matches/profile/notif/special + 4 modals = ZERO Latin leaves; rank me sirf player names (dynamic identity), wallet me ☪️ HALAL badge + UPI line (proper nouns) — sab by-design.
- z29 LAYOUT FIX (owner "bariki se" order): rank list row me tier chip `.rn` ke ellipsis me kat raha tha → `.rn` ab flex (name span ellipsis + chips flex-shrink:0). Final layout audit z29 (390×844, hi, qa1, 7 screens + 4 modals): home 1 (decorative glow, by-design), rank 1 (English name ellipsis, by-design), baaki SAB 0.
- Gates: FULL SWEEP 14/14 findings=0 (z24); CLICK MATRIX 18 combos findings=0 (z26); lang-thrash 33→33→0→33; en-leak 0; wipe-guard 0.
- Commits pub 1398e16(z27), 8b0736b(z28), dc8f2d9(z29); src 4ce8957, 1f58be5, b8f4ba5.
- Evidence v20 Drive: 1GeZTmOZkOc3FYUeCmoyQJul8QHUB95H8.
- Gates z29 addendum: boot local avg 802 ms (3 runs); NOTIF probe PASS 6/0; EN-mode rank shot clean (flex fix se EN par koi asar nahi); EN labels/podium ellipsis unchanged.
- Evidence v21 Drive: 15UTWANwZn0F_iLjNNMbZYEYS-jCC_9yr (z29 layout shots + EN rank + logs + report).
- LIVE TAG: 20261117z29 (pub dc8f2d9, src b8f4ba5). APK v1.0.6 WebView → auto-live.

## 24) Stretch 10f (tags z30–z31): toast/verify-nudge polish + AGENT PING CHANNEL
- z30: 'Copied! ✅'→'कॉपी हो गया! ✅', 'Copy failed'→'कॉपी विफल' (+EN reverse).
- z31: verify-nudge sheet body LONG pair ("Verified profile se match rewards…" ↔ Hindi).
- Match-detail sheet HI verify (shot `reports/ui-sweep/z30-hi-matchdet.png`): मैच विवरण/खेल रहे हैं/मैच का नाम/मोड/मैप/शुरू का समय/एंट्री फीस/स्लॉट्स/इनाम विवरण सब Hindi; date "07 जन 2027" ✅.
- **AGENT→OWNER PING CHANNEL (owner order 18-Nov):** turn ke end me Supabase `admin_activity_log` me row insert karo: admin_uid='arena-agent', action_type='agent_update', details={"reason":"<message>"}, note='<message>', status='info'. Admin panel ka Activity Log section Supabase table se load hota hai (details.reason render hota hai) → owner ko phone par turant dikhta hai. First ping bheja gaya 18-Nov (z30 status). Har turn-end par yeh ping ab STANDING PROTOCOL hai.
- Commits pub da23c83(z30), 2e1ba71(z31); src 309f961, 56ccc1c.
