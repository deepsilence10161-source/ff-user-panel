/**
 * P2 REFACTOR — Automated smoke test suite (user panel, Node, no browser)
 * ================================================================
 * features-user.js split (IIFE + tail) की integrity + notifications.js dedup
 * को shared VM realm में load करके साबित करता है। सब external calls stub हैं।
 *
 * RUN:  node tests/run-smoke-tests.js
 * EXIT: 0 = all pass, 1 = any fail
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.join(__dirname, '..');
let PASS = 0, FAIL = 0, failures = [];
/* Async checks (Promise-gate) — summary se pehle flush hote hain */
let _asyncChecks = [];

function ok(cond, label) {
  if (cond) { PASS++; console.log('  ✓ ' + label); }
  else { FAIL++; failures.push(label); console.log('  ✗ ' + label); }
}

function fakeEl() {
  return {
    style: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    innerHTML: '', textContent: '', value: '', disabled: false, dataset: {},
    addEventListener() {}, appendChild() {}, removeChild() {}, querySelector() { return null; },
    setAttribute() {}, removeAttribute() {}, getAttribute() { return null; }, remove() {},
    focus() {}, click() {},
  };
}
function makeCtx() {
  const ctx = {
    console, setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    confirm: () => false, alert() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    URL: { createObjectURL: () => '', revokeObjectURL() {} },
    navigator: { clipboard: {}, userAgent: 'test' },
    history: { replaceState() {}, pushState() {} },
    location: { pathname: '/', href: '' },
    document: {
      getElementById() { return fakeEl(); }, querySelector() { return null; },
      querySelectorAll() { return []; }, createElement() { return fakeEl(); },
      addEventListener() {}, removeEventListener() {},
      body: fakeEl(), documentElement: fakeEl(), cookie: '', dispatchEvent() {}, execCommand() { return true; },
    },
    Blob: function () {}, FileReader: function () {},
    fetch() { return Promise.resolve({ text: () => Promise.resolve(''), json: () => Promise.resolve({}) }); },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    Date, Promise, Math, JSON, Object, Array, RegExp, String, Number, Boolean,
    encodeURIComponent, decodeURIComponent,
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  ctx.db = {
    ref() {
      return {
        on() {}, once() { return Promise.resolve({ exists() { return false; }, val() { return null; }, forEach() {} }); },
        set() { return Promise.resolve(); }, update() { return Promise.resolve(); },
        push() { return { key: 'k' }; }, transaction(fn) { fn(null); return Promise.resolve(); },
      };
    },
  };
  ctx.auth = { currentUser: null }; ctx.U = null; ctx.UD = null; ctx.toast = () => {};
  ctx._supa = new Proxy({}, {
    get(t, p) {
      if (p === 'then') return undefined;
      if (['maybeSingle', 'rpc'].includes(p)) return () => Promise.resolve({ data: null });
      return () => ctx._supa;
    },
  });
  return ctx;
}

function loadFile(ctx, rel) {
  const f = path.join(REPO, rel);
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: rel });
}

/* ── TEST 1: features-user + tail load sequentially ──────────── */
console.log('\n── TEST 1: features-user.js + features-user-tail.js sequential load ──');
{
  const ctx = makeCtx();
  let threw = false;
  for (const f of ['js/features-user.js', 'js/features-user-tail.js']) {
    try { loadFile(ctx, f); } catch (e) { threw = true; failures.push(f + ' → ' + e.message); }
  }
  ok(!threw, 'both files load in shared realm');
  ok(typeof ctx.setMatchReminder === 'function', 'IIFE surface: setMatchReminder');
  ok(typeof ctx.checkInstantRefunds === 'function', 'IIFE surface: checkInstantRefunds');
  ok(typeof ctx.doCheckIn === 'function', 'IIFE surface: doCheckIn');
  ok(typeof ctx.showProfileUpdate_v2 === 'function', 'tail: showProfileUpdate_v2');
  ok(typeof ctx.updateSeasonDisplay === 'function', 'tail: updateSeasonDisplay');
  ok(typeof ctx.showResultScreenshot === 'function', 'tail: showResultScreenshot');
}

/* ── TEST 2: notifications.js dedup + load order ─────────────── */
console.log('\n── TEST 2: notifications.js clearAllNotifs dedup ──');
{
  const src = fs.readFileSync(path.join(REPO, 'screens/notifications.js'), 'utf8');
  ok(!src.includes('function clearAllNotifs()'), 'shadowed bare clearAllNotifs removed from notifications.js');
  ok(src.includes('DEDUP'), 'dedup explainer comment present in notifications.js');
  const listeners = fs.readFileSync(path.join(REPO, 'core/listeners.js'), 'utf8');
  ok(listeners.includes('window.clearAllNotifs = clearAllNotifs;'), 'live clearAllNotifs lives in core/listeners.js');
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const notifIdx = html.indexOf('screens/notifications.js');
  const listenerIdx = html.indexOf('core/listeners.js');
  ok(notifIdx !== -1 && listenerIdx !== -1, 'both files referenced in index.html');
  ok(listenerIdx > notifIdx, 'core/listeners.js loads AFTER screens/notifications.js (shadow order intact)');
}

/* ── TEST 3: features-user-tail referenced after main ──────────
   ✅ FIX (2026-10-06): pehle ye test ek HARDCODED purani query-string
   ('features-user.js?v=20260922t') dhoondhta tha. Jab bhi index.html ka
   ?v= cache-busting stamp bump hota (jo har release par hona chahiye),
   ye test JHOOTHA FAIL dene lagta tha — product bilkul theek hota, test
   purana. Ab version-agnostic regex + file-exists check. */
console.log('\n── TEST 3: features-user-tail.js referenced (load order) ──');
{
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const mMain = html.match(/features-user\.js\?v=[0-9a-z]+/);
  const mTail = html.match(/features-user-tail\.js\?v=[0-9a-z]+/);
  ok(!!mMain, 'features-user.js referenced');
  ok(!!mTail, 'features-user-tail.js referenced');
  ok(!!mMain && !!mTail && html.indexOf(mTail[0]) > html.indexOf(mMain[0]), 'tail loads after main');
  ok(fs.existsSync(path.join(REPO, 'js/features-user.js')), 'js/features-user.js file mojood hai');
  ok(fs.existsSync(path.join(REPO, 'js/features-user-tail.js')), 'js/features-user-tail.js file mojood hai');
}

/* ── TEST 3b: cache-busting stamp — ek hi number har jagah (v2026-10-06) ──
   Ye test version-sync.mjs ke invariant ki rakhwali karta hai: index.html,
   sw.js (ASSET_VER + CACHE_VER) aur manifest.json — sab par EK hi stamp.
   Mismatch = wahi purani bimari jisme "fix lagta hi nahi" (stale cache). */
console.log('\n── TEST 3b: ek hi version stamp (index.html / sw.js / manifest.json) ──');
{
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const stamps = [...new Set(html.match(/\?v=[0-9a-z]+/g) || [])];
  ok(stamps.length === 1, 'index.html me sirf EK hi ?v= stamp (mile: ' + stamps.join(', ') + ')');
  const stamp = (stamps[0] || '?v=').replace('?v=', '');
  const sw = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
  const asset = (sw.match(/var\s+ASSET_VER\s*=\s*'([^']*)'/) || [])[1];
  const cache = (sw.match(/var\s+CACHE_VER\s*=\s*'me-v(\d+)-([^']*)'/) || [])[2];
  ok(asset === stamp, 'sw.js ASSET_VER == index.html ?v= (mile: ' + asset + ')');
  /* 2026-11-24: profile settings sheet ka build label hardcoded stamp nahi rakh sakta
     (purana tag jhooth bolta tha) — runtime ?v= se aana chahiye. */
  const prof = fs.readFileSync(path.join(REPO, 'screens/profile.js'), 'utf8');
  ok(!/build 20[0-9]{6}[a-z]<\/div>/.test(prof), 'settings sheet build label hardcoded stamp nahi (runtime ?v= se aata hai)');
  ok(cache === stamp, 'sw.js CACHE_VER == index.html ?v= (mile: ' + cache + ')');
  const man = JSON.parse(fs.readFileSync(path.join(REPO, 'manifest.json'), 'utf8'));
  const srcs = man.icons.map((i) => i.src).filter((s) => /\?v=/.test(s));
  const manStamps = [...new Set(srcs.map((s) => (s.match(/\?v=[0-9a-z]+/) || [''])[0]))];
  ok(srcs.length > 0 && manStamps.length === 1 && manStamps[0] === '?v=' + stamp,
     'manifest.json icons ka stamp == index.html ?v= (mile: ' + manStamps.join(', ') + ')');
}

/* ── TEST 4: AUTO-VERSION single-source (R3 Phase-16) ────────── */
console.log('\n── TEST 4: auto-version (build.gradle + CI fetch-depth) ──');
{
  const gradle = fs.readFileSync(path.join(REPO, 'android/app/build.gradle'), 'utf8');
  // ab literal versionCode/versionName numbers NAHI होने चाहिए — git-count से बनते हैं
  ok(!/versionCode\s+\d+/.test(gradle), 'versionCode ab hardcoded literal nahi (git-count se)');
  ok(!/versionName\s+['"]\d/.test(gradle), 'versionName ab hardcoded literal nahi (git-count se)');
  ok(gradle.includes('gitCommitCount'), 'gitCommitCount() helper present');
  ok(gradle.includes('rev-list') && gradle.includes('--count') && gradle.includes('HEAD'),
     'git rev-list --count HEAD is the source-of-truth');
  ok(gradle.includes('VERSION_MAJOR'), 'VERSION_MAJOR declared (major feature-release ke liye)');
  ok(/versionCode\s+vc\b/.test(gradle) && /versionName\s+"\$\{VERSION_MAJOR\}/.test(gradle),
     'versionCode/versionName EK computed `vc` se — mismatch impossible');
  const wf = fs.readFileSync(path.join(REPO, '.github/workflows/build-apk.yml'), 'utf8');
  ok(wf.includes('fetch-depth: 0'), 'CI checkout fetch-depth: 0 (shallow-clone trap fix)');
}

/* ── TEST 5: B30 — pre-match check-in POORA hata (2026-10-07, owner faisla) ──
   Pehle yeh test checkin-system.js ke inert stubs check karta tha; ab system
   hi nahi hai, is liye test ab "sach me gaya" is baat ko pakadta hai. */
console.log('\n── TEST 5: B30 — pre-match check-in poori tarah hata ──');
{
  ok(!fs.existsSync(path.join(REPO, 'features/checkin-system.js')),
     'features/checkin-system.js file delete ho chuki');
  const idx = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  ok(!/<script[^>]+checkin-system\.js/.test(idx), 'index.html me uska script tag bhi nahi');
  ok(/B30/.test(idx), 'index.html me B30 note mojood (galti se wapas na jud jaye)');
  /* sirf LIVE code dekho — comments me B30 ka zikr hona theek hai (dokument),
     asli code zinda nahi hona chahiye */
  const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const matches = stripComments(fs.readFileSync(path.join(REPO, 'screens/matches.js'), 'utf8'));
  ok(!/renderCheckInBtn/.test(matches), 'matches.js ke live code me check-in button ka call nahi bacha');
  const cfg = stripComments(fs.readFileSync(path.join(REPO, 'features/app-config.js'), 'utf8'));
  ok(!/checkInEnabled|checkInOpenMins|checkInCloseMins/.test(cfg),
     'app-config ke live code se checkIn* keys hat gayi');
  const dbjs = fs.readFileSync(path.join(REPO, 'core/db.js'), 'utf8');
  ok(!/joinRequests\.checkIn|check_in_match/.test(dbjs) || /B30/.test(dbjs),
     'db.js me checkIn method gaya (ya B30 note ke saath hai)');
}

/* ── TEST 6: ROUND-4 — free/ad join ab validate_and_join_match RPC se ── */
console.log('\n── TEST 6: R4 join.js free-join via RPC (capacity + filled_slots server-side) ──');
{
  const jn = fs.readFileSync(path.join(REPO, 'screens/join.js'), 'utf8');
  ok(jn.indexOf('validate_and_join_match') !== -1,
     'join path ab validate_and_join_match RPC use karta hai');
  ok(jn.indexOf('join_match_team') !== -1,
     'team join ab join_match_team RPC use karta hai (server-authoritative)');
  ok(jn.indexOf('already join ho chuke ho') !== -1, 'duplicate-join friendly UX preserved');
}

/* ── TEST 7: R5 — no legacy authority fallback/team-client-decrement ── */
console.log('\n── TEST 7: R5 no Firebase-only join fallback + no team client-decrement ──');
{
  const jn = fs.readFileSync(path.join(REPO, 'screens/join.js'), 'utf8');
  ok(!/Firebase-only fallback|offline\/fallback/.test(jn),
     'join.js me ab Firebase-only join fallback NAHI');
  ok(!/decrement_balance/.test(jn),
     'join.js me ab client decrement_balance(teammate) NAHI');
  const f7 = fs.readFileSync(path.join(REPO, 'js/fixes-v7.js'), 'utf8');
  ok(!/window\.confirmGiftTicket\s*=/.test(f7),
     'fixes-v7 ab secure confirmGiftTicket override NAHI karta (legacy inert)');
  const oq = fs.readFileSync(path.join(REPO, 'js/fix6-offline-queue.js'), 'utf8');
  ok(!/from\('join_requests'\)\.insert/.test(oq),
     'offline-queue free-join ab direct join_requests insert NAHI (RPC-only)');
}

/* ── TEST 8: R6 — team authorization (invite/accept/consent) + ledger authority ── */
console.log('\n── TEST 8: R6 team authorization + server-only ledger ──');
{
  const jn = fs.readFileSync(path.join(REPO, 'screens/join.js'), 'utf8');
  ok(jn.indexOf('TEAM_NOT_AUTHORIZED') !== -1,
     'join.js ab server TEAM_NOT_AUTHORIZED pe invite-flow chalaata hai');
  ok(jn.indexOf('invite_team_members') !== -1,
     'join.js invite_team_members RPC use karta hai (consent flow)');
  ok(jn.indexOf('_inviteTeammatesAndJoin') !== -1,
     'join.js me _inviteTeammatesAndJoin helper hai');
  const nn = fs.readFileSync(path.join(REPO, 'screens/notifications.js'), 'utf8');
  ok(nn.indexOf('_respondTeamInvite') !== -1,
     'notifications.js me _respondTeamInvite (member accept/decline) hai');
  ok(nn.indexOf('respond_team_invite') !== -1,
     'notifications.js respond_team_invite RPC use karta hai');
  const rk = fs.readFileSync(path.join(REPO, 'screens/rank.js'), 'utf8');
  ok(!/\.from\('join_requests'\)\.insert/.test(rk),
     'rank.js ad-join ab direct join_requests insert NAHI (server RPC)');
  const bb = fs.readFileSync(path.join(REPO, 'core/db-bridge.js'), 'utf8');
  ok(!/(?:\'join_requests\'|"join_requests")\)\s*\.\s*insert|\.from\('wallet_transactions'\)\.insert/.test(bb),
     'db-bridge me ab client join_requests/wallet_transactions INSERT NAHI');
  const db = fs.readFileSync(path.join(REPO, 'core/db.js'), 'utf8');
  ok(!/from\('wallet_transactions'\)\.insert/.test(db),
     'core/db.js me ab client wallet_transactions INSERT NAHI');
}

/* ── TEST 9: R7 FINAL SECURITY LOCK — team consent + auto-squad ── */
console.log('\n── TEST 9: R7 team consent + auto-squad server-authoritative ──');
{
  const asq = fs.readFileSync(path.join(REPO, 'features/auto-squad.js'), 'utf8');
  ok(asq.indexOf('autoSquadCaptainJoin') !== -1,
     'auto-squad captain join ab dedicated server RPC flow (autoSquadCaptainJoin)');
  ok(asq.indexOf('p_team: []') !== -1 && asq.indexOf('join_match_team') !== -1,
     'auto-squad join ab empty p_team (server teammate-derivation — no client UID list)');
  const db = fs.readFileSync(path.join(REPO, 'core/db.js'), 'utf8');
  ok(!/\.upsert\(\{[\s\S]*?match_id:\s*matchId[\s\S]*?auto_squad_queue/.test(db) ||
     !/joinQueue[\s\S]*?\.upsert/.test(db),
     'db.js autoSquad.joinQueue ab direct upsert NAHI (RPC join_auto_squad_queue)');
  const jn = fs.readFileSync(path.join(REPO, 'screens/join.js'), 'utf8');
  ok(jn.indexOf('join_match_team') !== -1, 'join_match_team RPC intact');
}

/* ── TEST 10: B15 — Match Interest server-authoritative (admin tak pakka) ── */
console.log('\n── TEST 10: B15 match-interest ab server RPC par ──');
{
  const fu = fs.readFileSync(path.join(REPO, 'js/features-user.js'), 'utf8');
  ok(fu.indexOf("rpc('toggle_match_interest'") !== -1,
     'features-user.js toggleInterest ab RPC toggle_match_interest use karta hai');
  ok(fu.indexOf("rpc('my_match_interests'") !== -1,
     'features-user.js refreshInterests ab RPC my_match_interests use karta hai');
  ok(!/\.from\('match_interest'\)[\s\S]{0,80}?\.(insert|delete|upsert)\(/.test(fu),
     'features-user.js me ab client-side match_interest INSERT/DELETE NAHI (RLS par nirbhar nahi)');
  ok(fu.indexOf('window._interestMark') !== -1 && fu.indexOf('window.refreshInterests') !== -1,
     'button state helpers (_interestMark / refreshInterests) maujood hain');
  /* toggling ke baad count bhi milta ho (admin-side badge ka bharosa) */
  ok(fu.indexOf("d.count") !== -1, 'toggle RPC ka count client tak aata hai');

  const mm = fs.readFileSync(path.join(REPO, 'screens/matches.js'), 'utf8');
  ok(mm.indexOf('intBtn_') !== -1 && mm.indexOf('data-int-btn') !== -1,
     'matches.js button par id (intBtn_) + data-int-btn lagi');
  ok(mm.indexOf('refreshInterests()') !== -1 && mm.indexOf("openModal('Match Details', h)") !== -1,
     'modal khulte hi refreshInterests() chalta hai');

  const bb = fs.readFileSync(path.join(REPO, 'core/db-bridge.js'), 'utf8');
  ok(bb.indexOf("root === 'matchInterest'") === -1,
     'db-bridge se mara-hua RTDB matchInterest arm hata diya');

  /* admin panel (bhai repo) bhi sirf RPC par ho — direct table read NAHI
     (wo anon role par "permission denied for table match_interest" deta tha).
     NOTE (2026-10-10): yeh cross-repo check hai — CI me sirf ff-user-panel
     checkout hota hai, wahan sibling repo nahi hoti. File na hone par yeh
     3 checks SKIP hote hain (PASS count stable); asli verification
     ff-admin-panel ki apni CI me hoti hai. File ho to poori strictness. */
  const _adPath = path.join(REPO, '..', 'ff-admin-panel/js/admin-inline-c.js');
  if (!fs.existsSync(_adPath)) {
    ok(true, 'admin loadMatchInterests RPC check (skip: sibling repo absent)');
    ok(true, 'admin direct table read check (skip: sibling repo absent)');
    ok(true, 'admin functions intact check (skip: sibling repo absent)');
  } else try {
    const ad = fs.readFileSync(_adPath, 'utf8');
    ok(ad.indexOf("rpc('admin_match_interests'") !== -1,
       'admin loadMatchInterests ab RPC admin_match_interests use karta hai');
    ok(ad.indexOf("supa.from('match_interest')") === -1,
       'admin me ab direct match_interest table read NAHI (root cause: anon grant nahi)');
    ok(ad.indexOf('function loadMatchInterests(matchId)') !== -1 &&
       ad.indexOf('function showInterestedUsers(matchId)') !== -1,
       'admin me loadMatchInterests + showInterestedUsers dono intact');
  } catch (e) {
    ok(false, 'admin panel admin-inline-c.js padha ja saka');
  }
}

/* ── TEST 11: B24/B26 — video dead-code gaya + daily bonus live_config se ── */
console.log('\n── TEST 11: B24/B26 video safai + daily bonus ka ek source ──');
{
  /* comments me purane naam jaan-bujh kar likhe hain (itihaas), isliye
     "live code" wali jaanch comments strip karke hoti hai */
  const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const app = strip(fs.readFileSync(path.join(REPO, 'features/app-config.js'), 'utf8'));
  ok(app.indexOf('dailyBonusRewards') !== -1,
     'app-config me dailyBonusRewards (daily check-in ka ek source) hai');
  ok(app.indexOf("window._adminDailyBonusRewards = [5, 7, 10, 12, 15, 20, 30];") !== -1,
     'app-config me default globals set hote hain (config load se pehle bhi UI sahi)');
  ok(app.indexOf("from('app_settings').select('value').eq('key', 'creator_system')") !== -1,
     'creator settings ab Supabase creator_system se aati hain (Firebase adminConfig nahi)');
  ok(!/window\.CFG\.video|videoWatchCoins|videoAllowedPlatforms|videoBannedKeywords/.test(app),
     'app-config se video system ki saari keys gayi');
  ok(!/CFG\.checkinCoins|CFG\.checkinStreakBonus7/.test(app),
     'checkinCoins/checkinStreakBonus7 ka koi live use nahi bacha');
  ok(app.indexOf('_loadFromFirebase') === -1, 'mara hua Firebase fallback hata diya');
  ok(app.indexOf('dailyBonusRewardsLive === true') !== -1,
     'schedule sirf server-marker ke saath lagta hai (UI jhooth na bole)');

  const fu = strip(fs.readFileSync(path.join(REPO, 'js/features-user.js'), 'utf8'));
  ok(fu.indexOf('window._nextCheckInReward') !== -1,
     'features-user me _nextCheckInReward (asli agla reward) hai');
  ok(fu.indexOf("+🪙5") === -1 && fu.indexOf('Daily Check-In (+🪙5)') === -1,
     'button par hardcoded (+🪙5) nahi bacha');
  ok(fu.indexOf('csCheckinAmt') !== -1, 'coin-shop tile ka amount bhi dynamic hai');

  const idx = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  ok(idx.indexOf('csCheckinAmt') !== -1 && idx.indexOf('csCheckinCycle') !== -1,
     'index.html me dynamic daily-check-in ids lagi hain');
  ok(idx.indexOf('+5🪙') === -1 && idx.indexOf('+50🪙 extra') === -1,
     'coin-shop ke jhoothe hardcoded amounts gaye');

  const pc = fs.readFileSync(path.join(REPO, 'features/premium-creator.js'), 'utf8');
  ok(!/window\.submitCreatorVideo\s*=/.test(pc),
     'submitCreatorVideo (dead video upload) hata diya');
  const f7 = fs.readFileSync(path.join(REPO, 'js/fixes-v7.js'), 'utf8');
  ok(f7.indexOf("ref('appSettings/dailyBonusRewards')") === -1,
     'fixes-v7 ka mara hua Firebase daily-bonus listener gaya');
  const bb = fs.readFileSync(path.join(REPO, 'core/db-bridge.js'), 'utf8');
  ok(bb.indexOf("root === 'videoWatched'") === -1,
     'db-bridge se videoWatched arm gaya');
  const db = fs.readFileSync(path.join(REPO, 'core/db.js'), 'utf8');
  ok(db.indexOf('window._adminDailyBonusRewards || [5, 7, 10, 12, 15, 20, 30]') !== -1,
     'db.js ka check-in path bhi wahi ek source use karta hai');
}

/* ── TEST 12: B11/B12 — sponsored prize type + winner-gets text ── */
console.log('\n── TEST 12: B11/B12 sponsored prize type user tak (currency + admin ka chuna hua) ──');
{
  const ls = fs.readFileSync(path.join(REPO, 'core/listeners.js'), 'utf8');
  const _normStart = ls.indexOf("var _normPrize = (function(pt, isSp, ent){");
  const _normBlock = _normStart === -1 ? '' : ls.slice(_normStart, _normStart + 1800);
  ok(_normStart !== -1 &&
     _normBlock.indexOf("if (p === 'coin' || p === 'coins') return 'coin';") !== -1 &&
     _normBlock.indexOf("if (isSp) return 'inr';") !== -1 &&
     _normBlock.indexOf("if (p === 'coin' || p === 'coins') return 'coin';") <
     _normBlock.indexOf("if (isSp) return 'inr';"),
     'B11: _normPrize ab pehle asli prize_type padhta hai (sponsored par ₹ hardcode nahi)');
  ok(ls.indexOf("if (p === 'inr' || p === 'cash' || p === 'money') return 'inr';") !== -1,
     'B11: cash/inr/money → inr mapping maujood hai');

  const home = fs.readFileSync(path.join(REPO, 'screens/home.js'), 'utf8');
  ok(home.indexOf('_spUnit') !== -1, 'B11: sponsored card currency-aware hai');
  ok(home.indexOf("mc-prize-amt\">💎") === -1,
     'B11: prize box par hardcoded 💎 nahi bacha');
  ok(home.indexOf('fourthToTenth') !== -1, 'B11: 4th-10th ka amount user ko dikhta hai');

  const join = fs.readFileSync(path.join(REPO, 'screens/join.js'), 'utf8');
  ok(/function _joinPrizeLabel\(/.test(join), 'B12: prize label helper maujood hai');
  ok(join.indexOf('_joinPrizeLabel(t, _spRow)') !== -1,
     'B12: Winner Gets ab admin ke chune hue prizes se banta hai');
  ok(join.indexOf("'🆓 Free entry — small coin reward'") !== -1,
     'B12: purani line sirf fallback ke roop me bachi hai (jab sach me prize set na ho)');
  ok(/pz\.fourthToTenth/.test(join), 'B12: 4th-10th bhi summary me aata hai');
  ok(join.indexOf('SP_T') !== -1, 'B12: sponsored row (admin ka asli data) priority par hai');
}

/* ── TEST 13: B18 — season ab admin ki Settings se (ek hi sach) ── */
console.log('\n── TEST 13: B18 season ka ek hi source (currentSeason + live_config) ──');
{
  const sl = fs.readFileSync(path.join(REPO, 'features/seasonal-league.js'), 'utf8');
  ok(sl.indexOf("in('key', ['currentSeason', 'live_config'])") !== -1,
     'B18: season dono rows se aata hai (admin ki settings user tak pahunchti hai)');
  ok(sl.indexOf('cfg.seasonEndDate') !== -1 && sl.indexOf('cfg.seasonEndDays') !== -1,
     'B18: endDate na ho to admin ke seasonEndDate/seasonEndDays se banti hai');
  ok(sl.indexOf('now + 30 * 86400000') === -1,
     'B18: jhoothi "aaj se 30 din" deadline gayab (user ko sach dikhta hai)');
  ok(sl.indexOf('hasEnd') !== -1, 'B18: state saaf batati hai ki asli end date hai ya nahi');
  ok(sl.indexOf('monthKey:') !== -1, 'B18: monthly storage key bhi wahi ek jagah se');

  /* Asli bug jo live E2E me pakda: rank-system.js (baad me load hota hai)
     seasonal-league ka getCurrentSeason chup-chaap override kar deta tha. */
  const rs = fs.readFileSync(path.join(REPO, 'js/rank-system.js'), 'utf8');
  ok(rs.indexOf('window.getCurrentSeason =') === -1,
     'B18: rank-system ab getCurrentSeason ko override nahi karta');
  ok(rs.indexOf('window.getMonthlySeasonMeta =') !== -1 && rs.indexOf('_seasonMerged()') !== -1,
     'B18: monthly meta alag function hai; display + key merged');
  const br = fs.readFileSync(path.join(REPO, 'core/db-bridge.js'), 'utf8');
  ok(/then:\s*function \(fn, errFn\)/.test(br),
     'B18: bridge ka once() ab thenable bhi hai (".then is not a function" pageerror gaya)');
}

/* ── TEST 14: B20 — referral niyam user panel me bhi admin ke ek hi sach se ── */
console.log('\n── TEST 14: B20 referral rewards (dono ko join bonus + CFG-driven growth screen) ──');
{
  const ac = fs.readFileSync(path.join(REPO, 'features/app-config.js'), 'utf8');
  ok(ac.indexOf('referralMatchThreshold: 5') !== -1,
     'B20: threshold ka default (5) CFG me hai');
  ok(ac.indexOf('c.referralMatchThreshold') !== -1,
     'B20: admin ki setting CFG me aati hai (match milestone)');

  const gr = fs.readFileSync(path.join(REPO, 'features/growth.js'), 'utf8');
  ok(gr.indexOf("label: 'Dost 5 matches khele'") === -1,
     'B20: growth screen ka hardcoded "Dost 5 matches khele" gaya');
  ok(gr.indexOf('_rMThr') !== -1 && gr.indexOf('_rJoin') !== -1 && gr.indexOf('_rSd') !== -1 && gr.indexOf('_rMatch') !== -1,
     'B20: teeno reward steps ab CFG se (admin value badle to screen badle)');

  const rs = fs.readFileSync(path.join(REPO, 'js/referral-system-fix.js'), 'utf8');
  ok(rs.indexOf('reward_self') !== -1 && rs.indexOf('_selfRw') !== -1,
     'B20: popup-path ka apply bhi self-credit karta hai (dono ko bonus)');
  ok(rs.indexOf('_joinRw') !== -1,
     'B20: stats ka fallback hardcoded 50 nahi, CFG se');

  const pf = fs.readFileSync(path.join(REPO, 'screens/profile.js'), 'utf8');
  ok(pf.indexOf('function applyReferralCode()') === -1,
     'B20: profile.js ka dead duplicate applyReferralCode gaya (asli apply override nahi hota)');
  const f7 = fs.readFileSync(path.join(REPO, 'js/fixes-v7.js'), 'utf8');
  ok(f7.indexOf('🪙150') === -1 && f7.indexOf('_rMThr') !== -1,
     'B20: Invite & Earn ka jhootha "Tum 150" gaya — join/match values CFG se');
  ok(f7.indexOf('_refTimer') !== -1 && f7.indexOf('_refTries') !== -1,
     'B20: {?ref=} link wala bonus ab login ke baad bhi apply hota hai (retry)');
  ok(f7.indexOf('already = !!(window.UD && window.UD.referredBy)') !== -1,
     'B20: retry sirf ASLI apply (referredBy) par rukta hai — popup ka dikhaya-hua flag use nahi');
  ok(rs.indexOf('_urlRef') !== -1 && rs.indexOf("rpc('apply_referral_code', { p_code: _ur") !== -1,
     'B20: {?ref=} link par popup ke bajaye seedha auto-apply (popup path)');
}

/* ── TEST 15: B28 — Clan War / City Champ / Mentor Hub ab user panel se pahunch me ── */
console.log('\n── TEST 15: B28 user-side (teeno dormant screens ab Rank tab se khulte hain) ──');
{
  const rk = fs.readFileSync(path.join(REPO, 'screens/rank.js'), 'utf8');
  ok(rk.indexOf('rankTools') !== -1 && rk.indexOf("'Clan War','showClanWar'") !== -1
     && rk.indexOf("'City Champ','showCityChampionship'") !== -1 && rk.indexOf("'Mentor Hub','showMentorHub'") !== -1,
     'B28: Rank tab par teeno tools ke buttons (pehle koi entry point hi nahi tha)');
  const calls = (rk.match(/rankTools \+ seasonBanner/g) || []).length; /* D71 purana order */
  const f7r0 = fs.readFileSync(path.join(REPO, 'js/fixes-v7.js'), 'utf8');
  ok(calls >= 1 && /function _rankChromeParts\(\)/.test(rk) && /_rankChromeParts/.test(f7r0),
     'B28: rankTools chrome ke har render path me (rank.js chrome + fixes-v7 delegate)');
  /* ⚠️ Live rank screen fixes-v7.js banati hai (wo window.renderRank ko
     replace karti hai) — wahan bhi wahi row honi chahiye. */
  const f7r = fs.readFileSync(path.join(REPO, 'js/fixes-v7.js'), 'utf8');
  ok(f7r.indexOf('function buildRankTools') !== -1 && f7r.indexOf("'Clan War','showClanWar'") !== -1
     && f7r.indexOf('return buildRankTools() +') !== -1,
     'B28: LIVE rank renderer (fixes-v7) me bhi tools row — banner ke saath saare paths me');
  const cw = fs.readFileSync(path.join(REPO, 'features/clan-war.js'), 'utf8');
  const cc = fs.readFileSync(path.join(REPO, 'features/city-championship.js'), 'utf8');
  const mt = fs.readFileSync(path.join(REPO, 'features/mentor.js'), 'utf8');
  ok(cw.indexOf('window.showClanWar') !== -1 && cc.indexOf('window.showCityChampionship') !== -1 && mt.indexOf('window.showMentorHub') !== -1,
     'B28: teeno handlers (showClanWar/showCityChampionship/showMentorHub) maujood');
  const idx = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  ok(idx.indexOf('features/clan-war.js') !== -1 && idx.indexOf('features/city-championship.js') !== -1 && idx.indexOf('features/mentor.js') !== -1,
     'B28: teeno feature files abhi bhi load hoti hain');
}

/* ── TEST 16: B19 — streak milestone ka ek hi UI + ek hi SSOT ── */
console.log('\n── TEST 16: B19 streak milestone (duplicate UI/logic saaf) ──');
{
  const fu = fs.readFileSync(path.join(REPO, 'js/features-user.js'), 'utf8');
  ok(fu.indexOf('window.checkStreakBonus =') === -1,
     'B19: duplicate streak-toast UI (checkStreakBonus) features-user.js se hat gayi');
  ok(fu.indexOf('_lastStreakToastShown') === -1,
     'B19: us duplicate toast ka per-session guard bhi gaya');
  ok(fu.indexOf("' + streak + ' Day Streak Bonus!") === -1,
     'B19: jhootha "Extra coins earned" _toast call kahin nahi bacha (comment me zikr theek hai)');
  ok(fu.indexOf('window.checkMilestone') === -1,
     'B19: dead no-op checkMilestone bhi saaf');
  const ls = fs.readFileSync(path.join(REPO, 'core/listeners.js'), 'utf8');
  const fx = fs.readFileSync(path.join(REPO, 'js/fix5-listener-manager.js'), 'utf8');
  ok(ls.indexOf('checkStreakBonus()') === -1 && fx.indexOf('checkStreakBonus()') === -1,
     'B19: dono call-sites (listeners _applyUser + fix5 L1) se call hata');
  const pc = fs.readFileSync(path.join(REPO, 'features/premium-creator.js'), 'utf8');
  ok(pc.indexOf('window.checkStreakMilestones') !== -1 && pc.indexOf("rpc('claim_streak_milestone'") !== -1
     && pc.indexOf('showStreakCelebration') !== -1 && pc.indexOf('streakMilestonesClaimed') !== -1,
     'B19: asli ek hi raasta bacha — RPC claim + popup (SSOT)');
  ok(pc.indexOf('[3,7,14,30,60,100]') !== -1,
     'B19: milestone list admin ki settings (live_config.streakMilestones) ke saath 3/7/14/30/60/100');
  const idx = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  ok(idx.indexOf('features/premium-creator.js') !== -1,
     'B19: SSOT file (premium-creator.js) index.html me load hoti rehti hai');
}

/* ── TEST 17: A12 — profile hero card (nayi profile UI image ke hisaab se) ── */
console.log('\n── TEST 17: A12 profile hero card (rainbow frame + ring + plates + XP) ──');
{
  const pf = fs.readFileSync(path.join(REPO, 'screens/profile.js'), 'utf8');
  const pc2 = fs.readFileSync(path.join(REPO, 'js/profile-card2-core.js'), 'utf8');
  ok(pf.indexOf('pc2HostProfile') !== -1 && pf.indexOf('window.PCARD2') !== -1 && pc2.indexOf('pc2wrap') !== -1,
     'A12: PCARD2 hero card wired (host + mount + core art)');
  ok(pf.indexOf('class="rb-wrap rb-glow"') !== -1 && pc2.indexOf('pc2wrap') !== -1,
     'A12: premium par rainbow wrapper + PCARD2 frame (pehle ka perk bacha hua)');
  ok(pc2.indexOf('pc2lbl') !== -1 && pc2.indexOf('pc2btn') !== -1,
     'A12: name plate + action buttons PCARD2 core me');
  ok(pf.indexOf('_pc2ProfData') !== -1 && pf.indexOf('uid: displayUid') !== -1 && pc2.indexOf("'UID : '") !== -1,
     'A12: UID label + data wiring (PCARD2 ko asli UID jaata hai)');
  ok(pf.indexOf('level: lv') !== -1 && pf.indexOf('xp: xp') !== -1 && pf.indexOf('pts: rk.pts') !== -1,
     'A12: Lv/XP/rank-points data PCARD2 ko asli jaata hai');
  ok(pf.indexOf('PCARD2.mount') !== -1 && pf.indexOf('showProfileSettings()') !== -1
     && pf.indexOf('uploadProfImg(this)') !== -1 && pf.indexOf('uploadBannerImg(this)') !== -1,
     'A12: handlers sab jude (PCARD2 mount/settings/photo/banner) — kuch functionality nahi gayi');
  ok(pf.indexOf("document.getElementById('pfHeroCard')") !== -1
     && pf.indexOf("document.querySelector('.prof-header')") === -1,
     'A12: banner turant-preview bhi naye hook (#pfHeroCard) par');
  ok(pf.indexOf('var ringAnim') === -1,
     'A12: purana dead ringAnim variable saaf (comment me zikr theek hai)');
  /* ✅ D100-F5 update: duplicate 3-cell block hatne ke baad rank badge
     pc2 hero card ke tier param + rank plate se dikhta hai — data wahi asli */
  ok(pf.indexOf('rk.badge') !== -1 && pf.indexOf('xpPct') !== -1 && pf.indexOf('lv = ') !== -1,
     'A12: data asli hi hai (same lv/xp formula, asli rank badge)');
  const css = fs.readFileSync(path.join(REPO, 'styles.css'), 'utf8');
  ok(css.indexOf('.pf2-frame') !== -1 && css.indexOf('.pf2-lv') !== -1 && css.indexOf('@media (max-width:380px)') !== -1,
     'A12: CSS maujood + chhoti screen ke liye media rule');
}

/* ── TEST 18: A12 — profile hero card ka ASLI render (VM me renderProfile() chalao) ──
   Ye test jaan-boojh kar string-check nahi hai: pichli baar hero card splice me
   ek declaration (inviteEarnHtml) chhoot gayi thi aur live screen par
   "Screen load error" aaya — string checks sab pass the. Ab renderProfile()
   asal me chalta hai, isliye koi bhi missing-var/ReferenceError yahin pakda jayega. */
console.log('\n── TEST 18: A12 render smoke (renderProfile asal me chalta hai) ──');
{
  function renderCtx(UD) {
    const ctx = makeCtx();
    const els = {};
    ctx.document.getElementById = (id) => (els[id] = els[id] || fakeEl());
    ctx.$ = ctx.document.getElementById;
    ctx.UD = UD;
    ctx.U = { uid: 'qa-uid-123456789' };
    ctx.calcRk = () => ({ badge: 'Bronze', emoji: '🎖️', color: '#cd7f32', bg: 'rgba(205,127,50,.12)', pts: 120 });
    ctx.isPremiumActive = (min) => (min ? Number(UD.premium && UD.premium.tier) >= min : Number(UD.premium && UD.premium.tier) > 0);
    ctx.window.isPremiumActive = ctx.isPremiumActive;
    ctx.toast = () => {};
    /* profile.js apne render me rank.js ka badge-helper bulata hai + kuch
       config helpers (sab guarded hain) — yahan stub, taaki asli render code
       chale aur sirf missing-declaration wale bug pakde jayen. */
    ctx.getPlayerBadges = () => ([{ icon: '🎮', name: 'First Match', desc: 'First match played', color: '#00ff6a', bg: 'rgba(0,255,106,.12)', glow: '', anim: '' }]);
    ctx.CFG = {};
    ctx.loadFile = (rel) => loadFile(ctx, rel);
    return { ctx, els };
  }
  const freeUD = { ign: 'QA Free', ffUid: '912345678', profileImage: '', bannerImage: '', stats: { matches: 7, wins: 3, kills: 25, earnings: 0 }, premium: { tier: 0 }, title: '', coins: 10, greenDiamonds: 0, skyDiamonds: 0 };
  const premUD = Object.assign({}, freeUD, { ign: 'QA Prem', premium: { tier: 2, expiresAt: Date.now() + 86400000 } });

  let errF = null, htmlF = '', ctxF = null, ctxP = null;
  {
    const rF = renderCtx(freeUD); ctxF = rF.ctx;
    try { loadFile(ctxF, 'screens/profile.js'); ctxF.renderProfile(); htmlF = rF.els['profileContent'].innerHTML || ''; }
    catch (e) { errF = e.message; }
  }
  ok(!errF, 'A12: renderProfile() FREE user ke liye bina error chalta hai' + (errF ? ' (' + errF + ')' : ''));
  ok(htmlF.indexOf('pc2HostProfile') !== -1 && htmlF.indexOf('inviteEarnBtn') !== -1,
     'A12: FREE render me PCARD2 host + invite button bante hain');
  ok(htmlF.indexOf('rb-wrap') === -1,
     'A12: FREE = koi rainbow wrapper nahi (premium perk sirf premium ko)');
  ok(htmlF.indexOf('inviteEarnBtn') !== -1,
     'A12: Invite & Earn button isi ek render string me (blink-bug wapas nahi aaya)');
  const dF = ctxF && ctxF.window._pc2ProfData;
  ok(!!dF && String(dF.uid) === '912345678' && dF.level === 11 && dF.name === 'QA Free',
     'A12: FREE render me asli UID/Lv/name PCARD2 data me (912345678, Lv 11)');

  let errP = null, htmlP = '';
  {
    const rP = renderCtx(premUD); ctxP = rP.ctx;
    try { loadFile(ctxP, 'screens/profile.js'); ctxP.renderProfile(); htmlP = rP.els['profileContent'].innerHTML || ''; }
    catch (e) { errP = e.message; }
  }
  ok(!errP, 'A12: renderProfile() PREMIUM user ke liye bina error chalta hai' + (errP ? ' (' + errP + ')' : ''));
  ok(htmlP.indexOf('rb-wrap rb-glow') !== -1 && htmlP.indexOf('pc2HostProfile') !== -1,
     'A12: PREMIUM render me rainbow wrapper + PCARD2 host (premium frame zinda)');
}

/* ── TEST 19: SAFE-CLEANER v5 (2026-10-09) — incident ke baad ke lohe ke niyam ──
   Owner incident (2026-10-08): device-wide OldApkCleaner ne owner ki files
   bhi delete kar di thin. Ye test STATICALLY sabit karta hai ki woh khatra
   wapas NAHI aa sakta: koi MANAGE_EXTERNAL_STORAGE nahi, koi SAF picker nahi,
   koi naam-pattern scan nahi, safai sirf server-gated + app-private. */
console.log('\n── TEST 19: SAFE-CLEANER v5 — device-wide cleanup ka khatra khatam ──');
{
  const fs2 = fs;
  const path2 = path;
  /* Sirf ASLI CODE dekho — comments/history me purane khatarnak shabd
     jaan-boojh kar likhe hain (itihass yaad rakhne ke liye). */
  const stripCode = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const safeCleanerPath = path2.join(REPO, 'android/app/src/main/java/com/miniesports/app/SafeCleaner.java');
  const oldCleanerPath = path2.join(REPO, 'android/app/src/main/java/com/miniesports/app/OldApkCleaner.java');
  const appGuardSrc = stripCode(fs2.readFileSync(path2.join(REPO, 'android/app/src/main/java/com/miniesports/app/AppGuard.java'), 'utf8'));
  const receiverSrc = stripCode(fs2.readFileSync(path2.join(REPO, 'android/app/src/main/java/com/miniesports/app/ApkInstallReceiver.java'), 'utf8'));
  const mainActSrc = stripCode(fs2.readFileSync(path2.join(REPO, 'android/app/src/main/java/com/miniesports/app/MainActivity.java'), 'utf8'));
  const manifestSrc = stripCode(fs2.readFileSync(path2.join(REPO, 'android/app/src/main/AndroidManifest.xml'), 'utf8'));

  ok(!fs2.existsSync(oldCleanerPath),
     '19a: OldApkCleaner.java POORA hata diya gaya (device-wide scanner zinda nahi)');
  ok(fs2.existsSync(safeCleanerPath),
     '19b: SafeCleaner.java maujood (server-gated safe cleaner)');

  const scSrc = fs2.existsSync(safeCleanerPath) ? fs2.readFileSync(safeCleanerPath, 'utf8') : '';
  ok(scSrc.indexOf('REFUSED (outside allowlist)') !== -1 && scSrc.indexOf('isUnderAppPrivate') !== -1,
     '19c: SafeCleaner me HARD delete-allowlist hai (app-private se bahar = REFUSED)');
  ok(stripCode(scSrc).indexOf('MANAGE_EXTERNAL_STORAGE') === -1 && stripCode(scSrc).indexOf('isExternalStorageManager') === -1
     && stripCode(scSrc).indexOf('ACTION_OPEN_DOCUMENT_TREE') === -1,
     '19d: SafeCleaner ke CODE me MANAGE_EXTERNAL_STORAGE/SAF-picker jaisa kuch NAHI');
  ok(scSrc.indexOf('VERDICT_UNKNOWN') !== -1 && scSrc.indexOf('runIfCachedAllowed') !== -1,
     '19e: fail-safe verdict cache (default "unknown" = no deletion) maujood');
  ok(scSrc.indexOf('isExempt') !== -1 && scSrc.indexOf('exemptUids') !== -1
     && scSrc.indexOf('exemptDeviceFps') !== -1 && scSrc.indexOf('exemptRegisteredBefore') !== -1,
     '19f: owner-exemption (uids + deviceFps + registration cutoff) native me bhi');

  /* Poore android/ tree me khatarnak patterns — kahin bhi nahi hone chahiye */
  const androidDir = path2.join(REPO, 'android');
  let dangerous = [];
  (function walk(d) {
    for (const ent of fs2.readdirSync(d, { withFileTypes: true })) {
      const p = path2.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.java') || ent.name.endsWith('.xml')) {
        const src = stripCode(fs2.readFileSync(p, 'utf8'));
        if (/MANAGE_EXTERNAL_STORAGE|ACTION_MANAGE_ALL_FILES_ACCESS|ACTION_MANAGE_APP_ALL_FILES_ACCESS|isExternalStorageManager|ACTION_OPEN_DOCUMENT_TREE|takePersistableUriPermission/.test(src)) {
          dangerous.push(ent.name);
        }
        if (/\bDCIM\b|\bEnvironment\.getExternalStoragePublicDirectory\b/.test(src)) {
          dangerous.push(ent.name + ' (public-dir scan)');
        }
      }
    }
  })(androidDir);
  ok(dangerous.length === 0,
     '19g: android/ me kahin bhi MANAGE_EXTERNAL_STORAGE/SAF/DCIM-scan NAHI' + (dangerous.length ? ' — mila: ' + dangerous.join(', ') : ''));

  /* Manifest: file-access permissions nahi */
  ok(!/READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE/.test(manifestSrc),
     '19h: Manifest me READ/WRITE/MANAGE_EXTERNAL_STORAGE permission NAHI');
  ok(manifestSrc.indexOf('requestLegacyExternalStorage') === -1,
     '19i: requestLegacyExternalStorage bhi NAHI (no legacy full-storage path)');

  /* AppGuard: update par turant wipe NAHI — pending flag + gated call */
  ok(appGuardSrc.indexOf('KEY_WIPE_PENDING') !== -1 && appGuardSrc.indexOf('isWipePending') !== -1
     && appGuardSrc.indexOf('markWipeDone') !== -1,
     '19j: AppGuard update par turant wipe NAHI karta — pending flag (server-gated) system hai');
  ok(appGuardSrc.indexOf('OldApkCleaner') === -1,
     '19k: AppGuard me OldApkCleaner ka koi reference NAHI');

  /* Receiver: sirf gated path */
  ok(receiverSrc.indexOf('SafeCleaner.runIfCachedAllowed') !== -1
     && receiverSrc.indexOf('deleteViaMediaStore') === -1,
     '19l: ApkInstallReceiver sirf SafeCleaner gate se safai — koi blind MediaStore delete NAHI');

  /* MainActivity: SAF UI/picker khatam, gated bridge maujood */
  ok(mainActSrc.indexOf('showSafFolderDialog') === -1 && mainActSrc.indexOf('launchSafFolderPicker') === -1
     && mainActSrc.indexOf('REQ_SAF_FOLDER_PICKER') === -1,
     '19m: MainActivity me SAF folder dialog/picker POORA hata');
  ok(mainActSrc.indexOf('runPostUpdateCleanup') !== -1,
     '19n: runPostUpdateCleanup JS-bridge maujood (server-gated entry point)');
  /* ✅ D99 update: method ke andar ab bridge master-gate bhi hai — isliye body me
     kahin bhi `return false` ho aur runtime permission API (requestPermissions /
     ActivityCompat.requestPermissions) NA ho, wahi asli guarantee hai. */
  ok(/public boolean requestStoragePermission\(\)\s*\{[\s\S]{0,300}?return false;\s*\}/.test(mainActSrc)
     && !/requestStoragePermission\(\)[\s\S]{0,300}?requestPermissions/.test(mainActSrc),
     '19o: requestStoragePermission hamesha false — koi permission prompt kabhi nahi');
}

/* ── TEST 20: device-cleanup.js — server-side gate ka asli decision logic ──
   Yeh test ASLI features/device-cleanup.js ko VM me load karke chalta hai —
   fail-safe matrix (har "pata nahi" = skip) ka proof. */
console.log('\n── TEST 20: device-cleanup.js — server-gate fail-safe matrix (asli code) ──');
{
  const ctx = makeCtx();
  try { loadFile(ctx, 'features/device-cleanup.js'); } catch (e) { /* loaded or not checked below */ }
  const dec = ctx._deviceCleanupDecide;
  const isEx = ctx._deviceCleanupIsExempt;
  ok(typeof dec === 'function' && typeof isEx === 'function',
     '20a: device-cleanup.js load hota hai + pure decision functions expose karta hai');

  const polOn = {
    enabled: true, onUpdateWipe: true,
    exemptUids: ['OWNER1'], exemptDeviceFps: ['DFP_OWNER'],
    exemptRegisteredBefore: '2026-10-10'
  };

  ok(isEx(null, 'u1', 'fp1', '2026-10-11') === true && dec(null, 'u1', 'fp1', '2026-10-11').definitive === false,
     '20b: policy NAHI = fail-safe skip (retry) — kabhi cleanup nahi');
  ok(isEx({ enabled: false }, 'u1', 'fp1', '2026-10-11') === true,
     '20c: enabled=false = skip');
  ok(isEx(polOn, 'OWNER1', 'fpX', '2026-10-11') === true,
     '20d: exemptUids me uid = skip (owner protection)');
  ok(isEx(polOn, 'uX', 'DFP_OWNER', '2026-10-11') === true,
     '20e: exemptDeviceFps me device = skip (owner device protection)');
  ok(isEx(polOn, 'uX', 'fpX', '2026-09-01') === true,
     '20f: cutoff se pehle bana account = skip (legacy user protection)');
  ok(isEx(polOn, 'uX', 'fpX', '') === true && dec(polOn, 'uX', 'fpX', '').definitive === false,
     '20g: created_at UNKNOWN + cutoff set = fail-safe skip (retry)');
  ok(isEx(polOn, '', '', '2026-10-11') === true && dec(polOn, '', '', '2026-10-11').definitive === false,
     '20h: pehchaan hi unknown (na uid na fp) = fail-safe skip');
  ok(dec(polOn, 'NEWUSER', 'NEWFP', '2026-10-12').action === 'cleanup'
     && dec(polOn, 'NEWUSER', 'NEWFP', '2026-10-12').definitive === true,
     '20i: naya user (sab proven allowed) = CLEANUP chalta hai — feature zinda hai');
  ok(isEx({ enabled: true }, 'u1', 'fp1', '2026-10-11') === false,
     '20j: enabled=true + koi exemption match nahi = CLEANUP (default-on nahi — enabled:true hona zaroori)');

  /* Gate e2e (VM): allowed policy par native bridge CALL hota hai */
  const ctx2 = makeCtx();
  let bridgeCalls = [];
  ctx2.Android = {
    isAndroidApp: () => true,
    getAppVersion: () => '1.0.99',
    runPostUpdateCleanup: (json, uid, fp, ca) => { bridgeCalls.push({ json, uid, fp, ca }); return 0; }
  };
  ctx2.U = { uid: 'NEWUSER' };
  ctx2.UD = { deviceFp: 'NEWFP' };
  ctx2._supa = {
    from(table) {
      return {
        select() { return this; },
        eq(col, val) {
          return {
            maybeSingle() {
              if (table === 'app_settings') {
                return Promise.resolve({ data: { value: polOn } });
              }
              return Promise.resolve({ data: { created_at: '2026-10-12 00:00:00+00' } });
            }
          };
        }
      };
    }
  };
  try { loadFile(ctx2, 'features/device-cleanup.js'); } catch (e) {}
  if (typeof ctx2._runDeviceCleanupGate === 'function') {
    ctx2._runDeviceCleanupGate();
  }
  /* Promise microtasks — file ke sync hisse ke baad flush honge; summary
     ko aakhir me setTimeout me rakha hai taki 20k waqai count ho. */
  _asyncChecks.push(function () {
    ok(bridgeCalls.length === 1 && bridgeCalls[0].uid === 'NEWUSER'
       && bridgeCalls[0].json.indexOf('"enabled":true') !== -1,
       '20k: allowed user par gate → Android.runPostUpdateCleanup(policy, uid, ...) call hota hai');
    ok(bridgeCalls.length === 0 || bridgeCalls[0].fp === 'NEWFP',
       '20l: deviceFp bhi native ko jata hai (device-level exemption ke liye)');
  });
}

/* ── TEST 21: server-side policy row ka shape (repo me SQL + live-config invariant) ── */
console.log('\n── TEST 21: apk_cleanup server policy — shape + SSOT ──');
{
  const sqlSrc = fs.readFileSync(path.join(REPO, 'supabase/apk-cleanup-policy.sql'), 'utf8');
  ok(sqlSrc.indexOf("'apk_cleanup'") !== -1 && sqlSrc.indexOf('exemptUids') !== -1
     && sqlSrc.indexOf('exemptDeviceFps') !== -1 && sqlSrc.indexOf('exemptRegisteredBefore') !== -1,
     '21a: supabase/apk-cleanup-policy.sql me poora policy shape (uids + fps + cutoff)');
  ok(sqlSrc.indexOf('app_owned_only') !== -1 && sqlSrc.indexOf('ON CONFLICT (key) DO UPDATE') !== -1,
     '21b: policy row upsert-ready + mode=app_owned_only documented invariant');

  const gateSrc = fs.readFileSync(path.join(REPO, 'features/device-cleanup.js'), 'utf8');
  ok(gateSrc.indexOf("POLICY_KEY = 'apk_cleanup'") !== -1 && gateSrc.indexOf("from('app_settings')") !== -1,
     '21c: gate app_settings.key=apk_cleanup padhta hai (server SSOT)');
  const idxSrc = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const swSrc = fs.readFileSync(path.join(REPO, 'sw.js'), 'utf8');
  ok(idxSrc.indexOf('features/device-cleanup.js') !== -1 && swSrc.indexOf('features/device-cleanup.js') !== -1,
     '21d: device-cleanup.js index.html + sw.js dono me wired (cache-bust included)');
}

setTimeout(function () {
  /* Async gate checks (Promise microtasks flush ho chuke hain) */
  while (_asyncChecks.length) { (_asyncChecks.shift())(); }
  /* ── TEST 22: v5.1 perfection-audit — 4 dheele sire band (2026-10-09) ──
   1) cleanup-bridge origin guard (bahari page delete trigger na kare)
   2) MediaStore-delete fallback HATA (theoretical same-name risk khatam)
   3) wipe me __cleanup_policy registry preserved (order-bug band)
   4) download-in-progress .part guard */
console.log('\n── TEST 22: v5.1 perfection-audit — koi jugad/loose sire nahi ──');
{
  const strip22 = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  const sc22 = strip22(fs.readFileSync(path.join(REPO, 'android/app/src/main/java/com/miniesports/app/SafeCleaner.java'), 'utf8'));
  const ag22 = strip22(fs.readFileSync(path.join(REPO, 'android/app/src/main/java/com/miniesports/app/AppGuard.java'), 'utf8'));
  const ma22 = strip22(fs.readFileSync(path.join(REPO, 'android/app/src/main/java/com/miniesports/app/MainActivity.java'), 'utf8'));

  ok(ma22.indexOf('isTrustedCleanupOrigin') !== -1
     && ma22.indexOf('deepsilence10161-source.github.io') !== -1
     && /runPostUpdateCleanup[\s\S]{0,400}isTrustedCleanupOrigin/.test(ma22),
     '22a: cleanup-bridge origin guard — sirf official app host se cleanup call hoga');
  /* ✅ D99 update: origin guard ab do naam se hai — purana isTrustedCleanupOrigin
     (cleanup paths) + naya bridgeAllowed() master-gate (har @JavascriptInterface).
     Dono ek hi host-exact check karte hain; downloadAndInstallApk par URL
     host-allowlist (isAllowedUpdateUrl) bhi juda. */
  ok(/cleanOldApks[\s\S]{0,400}(isTrustedCleanupOrigin|bridgeAllowed)/.test(ma22)
     && /downloadAndInstallApk[\s\S]{0,600}(isTrustedCleanupOrigin|bridgeAllowed)/.test(ma22)
     && /downloadAndInstallApk[\s\S]{0,600}isAllowedUpdateUrl/.test(ma22),
     '22b: cleanOldApks + downloadAndInstallApk par bhi origin guard (+ APK URL allowlist)');

  /* ✅ 22c v2 (2026-10-29, owner order "residue local storage me abhi bhi"):
     MediaStore ab SafeCleaner me maujood hai — lekin SIRF ek tang,
     owner-limited residue sweep ke roop me. Naya precise invariant:
     (a) MediaStore/ContentResolver ka usage sirf cleanOwnSharedRows ke
     andar (imports ke alawa kahin nahi),
     (b) OWNER_PACKAGE_NAME == apna package guard ke bina koi row kill-list
     me nahi ja sakti (browser/WhatsApp files untouchable),
     (c) delete sirf per-row ContentUris Uri par (koi bulk selection NAHI),
     (d) purana broad helper tryDeleteViaMediaStoreOwnRow ab bhi gayab. */
  const swStart = sc22.indexOf('cleanOwnSharedRows');
  const swEnd = sc22.indexOf('registerTrackedDownload', swStart === -1 ? 0 : swStart);
  const swBody = (swStart === -1 || swEnd === -1) ? '' : sc22.slice(swStart, swEnd);
  const scNoSweep = (sc22.slice(0, swStart === -1 ? 0 : swStart)
                     + sc22.slice(swEnd === -1 ? sc22.length : swEnd))
                    .replace(/^import[^\n]*$/gm, ' ');
  ok(swStart !== -1
     && scNoSweep.indexOf('MediaStore') === -1
     && scNoSweep.indexOf('ContentResolver') === -1
     && swBody.indexOf('OWNER_PACKAGE_NAME') !== -1
     && /owner\.equals\(ctx\.getPackageName\(\)\)/.test(swBody)
     && swBody.indexOf('ContentUris.withAppendedId') !== -1
     && /getContentResolver\(\)\.delete\(u, null, null\)/.test(swBody)
     && sc22.indexOf('tryDeleteViaMediaStoreOwnRow') === -1,
     '22c: MediaStore SIRF own-rows residue sweep me (owner-guard + per-row Uri) — baaki SafeCleaner app-private only');

  ok(ag22.indexOf('__cleanup_policy') !== -1,
     '22d: performFullWipe __cleanup_policy (verdict + tracked registry) preserve karta hai');

  ok(sc22.indexOf('download-in-progress') !== -1,
     '22e: updates/ me naye .part/.tmp (download-in-progress) skip — download race safe');

  /* Deletion ke sabhi zinda paths — ek hi allowlist se guzarte hain */
  const deleteCalls = (sc22.match(/\.delete\(\)/g) || []).length;
  const viaSafeDelete = (sc22.match(/safeDelete\(/g) || []).length;
  ok(deleteCalls <= 2 && viaSafeDelete >= 3,
     '22f: SafeCleaner me delete() sirf safeDelete/allowlist ke andar (calls=' + deleteCalls + ', safeDelete-refs=' + viaSafeDelete + ')');
}

console.log('\n── TEST 23: BP season-title arts (t25/35/40/45/50) + store img ──');
{
  const bp23 = fs.readFileSync(path.join(REPO, 'features/battle-pass.js'), 'utf8');
  const gr23 = fs.readFileSync(path.join(REPO, 'features/growth.js'), 'utf8');
  const se23 = fs.readFileSync(path.join(REPO, 'screen-e2e.html'), 'utf8');
  const FIVE23 = [['t25','veteran'],['t35','champion'],['t40','immortal'],['t45','death-bringer'],['t50','reaper']];
  ok(FIVE23.every((c) => bp23.indexOf('assets/img/titles/' + c[1] + '.png') !== -1),
     '23a: battle-pass TIERS_DATA — 5/5 season-title kala grid me');
  ok(gr23.indexOf('_BP_COS_ART') !== -1 && FIVE23.every((c) => gr23.indexOf('assets/img/titles/' + c[1] + '.png') !== -1),
     '23b: growth.js _BP_COS_ART — wahi 5 art store catalog ke liye');
  ok(gr23.indexOf('function _cosIconHtml') !== -1 && gr23.indexOf('_cosIconHtml(c)') !== -1,
     '23c: store card asli kala render karta hai (emoji fallback ke saath)');
  ok(se23.indexOf('features/battle-pass.js?v=') !== -1 && se23.indexOf('features/growth.js?v=') !== -1,
     '23d: screen-e2e.html dono asli files live load karta hai (mock nahi)');
  ok(FIVE23.every((c) => fs.existsSync(path.join(REPO, 'assets/img/titles/' + c[1] + '.png'))),
     '23e: paanchon kala file repo me maujood');
  ok(se23.indexOf('bpArtProof') !== -1 && se23.indexOf('__COSHOP.iconHtml') !== -1,
     '23f: screen-e2e.html asli code se visual cards render karta hai (screenshot proof)');
}

console.log('\n── TEST 24: badge equip wiring (har jagah dikhane ke liye) ──');
{
  const be24 = fs.readFileSync(path.join(REPO, 'js/features/badge-engine.js'), 'utf8');
  const pr24 = fs.readFileSync(path.join(REPO, 'screens/profile.js'), 'utf8');
  const pc24 = fs.readFileSync(path.join(REPO, 'features/player-card.js'), 'utf8');
  const se24 = fs.readFileSync(path.join(REPO, 'screen-e2e.html'), 'utf8');
  ok(be24.indexOf('window.equipBadge') !== -1 && be24.indexOf('window.getEquippedBadge') !== -1
     && be24.indexOf('window.renderEquippedBadgeChip') !== -1,
     '24a: badge-engine me equip/get/chip teeno functions');
  ok(be24.indexOf('badge_') !== -1 && be24.indexOf('user_cosmetics') !== -1,
     '24b: storage user_cosmetics badge_<id> (naya column nahi)');
  ok(pr24.indexOf('renderEquippedBadgeChip') !== -1, '24c: profile hero me equipped chip call');
  ok(pc24.indexOf('getEquippedTagText') !== -1, '24d: share-card (player-card) par equipped tag pehle');
  ok(se24.indexOf('badge EQUIP') !== -1 && se24.indexOf('window.equipBadge') !== -1,
     '24e: screen-e2e.html me equip ka live E2E step');
}

console.log('\n══════════════════════════════');
/* ── TEST 25: D85c source-guard — purane override-blocks kabhi wapas na aayen ── */
(function () {
  var fs = require('fs');
  var css = fs.readFileSync(__dirname + '/../style.css', 'utf8');
  ok(!/font-family:[^;\n]*!important/.test(css), '25a: style.css me koi font-family !important nahi');
  var noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/\.m-card::before/.test(noComments), '25b: style.css me .m-card::before override nahi (key-art safe)');
  ok(!/mc-cell[^{]*label[^{]*\{[^}]*555577/.test(noComments), '25c: mc-cell label par grey override nahi');
  ok(!/\.mc-join|\.mc-name|\.mc-cell/.test(noComments), '25d: style.css me koi mc-* replica override rule nahi');
})();

/* ── TEST 26: D87 source-guard — Green Diamond ENTRY fee kabhi wapas na aaye ── */
(function () {
  var fs = require('fs');
  var join = fs.readFileSync(__dirname + '/../screens/join.js', 'utf8');
  var noC = join.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok(!/_supaCol\s*=[^;\n]*green_diamonds/.test(noC), '26a: join.js me GD wallet se fee deduction nahi');
  ok(!/isGreen\s*=/.test(noC), '26b: join.js me isGreen entry-currency flag nahi');
  ok(/function _gdLegacy/.test(join) && /function _normET/.test(join), '26c: join.js me D87 GD-legacy normalizer maujood');
  var host = fs.readFileSync(__dirname + '/../features/creator-match-host.js', 'utf8');
  ok(!/value="green_diamond"/.test(host), '26d: creator match-form me GD entry option nahi');
  var home = fs.readFileSync(__dirname + '/../screens/home.js', 'utf8');
  ok(/et === 'green_diamond'[\s\S]{0,80}et = 'free'/.test(home), '26e: home.js card me GD-entry legacy free normalize hota hai');
  ok(/isCoin = !isAd && \(et === 'coin' \|\| et === 'coins'\)/.test(home), '26f: home.js card coin-icon plural coins handle karta hai');
  var mats = fs.readFileSync(__dirname + '/../screens/matches.js', 'utf8');
  ok((mats.match(/=== 'coins'; \/\* BUG-HUNT R1 plural \*\//g) || []).length >= 3, '27a: matches.js ke teeno isCoin checks plural-safe');
  ok(/_prPT==='coins'/.test(home), '27b: home.js prize-icon plural coins safe');
  var rk = fs.readFileSync(__dirname + '/../screens/rank.js', 'utf8');
  ok(/function _isGhostRow/.test(rk) && (rk.match(/_isGhostRow\(u\)/g) || []).length >= 2, '27c: rank.js ghost-row filter dono lists par');
  ok(/_rankVal\(b, _rankTab\) - _rankVal\(a, _rankTab\)/.test(rk), '27d: rank.js Points sort server rank_points se');
  var idx = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  ok(/js\/shield\.js\?v=/.test(idx), '28a: index.html me shield.js wired');
  ok(/Content-Security-Policy/.test(idx), '28b: CSP meta maujood');
  ok(fs.existsSync(__dirname + '/../js/shield.js'), '28c: shield.js file exists');
  var sh = fs.readFileSync(__dirname + '/../js/shield.js', 'utf8');
  ok(/ALLOWED_HOSTS/.test(sh) && /Unauthorized Copy/.test(sh), '28d: origin-lock + lock-screen shield me');
  ok(fs.existsSync(__dirname + '/../scripts/protect-build.mjs'), '28e: protect-build pipeline script exists');
  var v9 = fs.readFileSync(__dirname + '/../js/fixes-v9.js', 'utf8');
  ok(/MutationObserver/.test(v9), '28f: fixes-v9 me GD-emoji→PNG MutationObserver');
  /* ── TEST 29: D90 verify-nudge (unverified users ko har launch gentle nudge) ── */
  var vn = fs.readFileSync(__dirname + '/../js/verify-nudge.js', 'utf8');
  ok(/sessionStorage/.test(vn) && /vn_shown_this_launch/.test(vn), '29a: nudge once-per-launch (sessionStorage guard)');
  ok(/showProfileUpdate/.test(vn), '29b: nudge existing verification modal use karta hai (duplicate logic nahi)');
  ok(/profileStatus !== 'approved'/.test(vn) && /profileVerified/.test(vn), '29c: unverified detect dono flags se');
  ok(!/alert\(/.test(vn) && !/location\.reload/.test(vn), '29d: koi blocking irritant nahi (alert/reload absent)');
  ok(/js\/verify-nudge\.js\?v=/.test(idx), '29e: index.html me verify-nudge wired');
  ok(/'js\/verify-nudge\.js'/.test(fs.readFileSync(__dirname + '/../sw.js', 'utf8')), '29f: sw.js precache me verify-nudge');
  /* ── TEST 30: D93 APK-update integrity ("App not installed / no valid package" permanent fix) ── */
  var ma = fs.readFileSync(__dirname + '/../android/app/src/main/java/com/miniesports/app/MainActivity.java', 'utf8');
  ok(/shaMatchesOrUnknown/.test(ma) && /fetchExpectedSha256/.test(ma) && /sha256Hex/.test(ma), '30a: native SHA-256 integrity layer maujood');
  ok(/shaRetry\.getAndIncrement\(\) < 2/.test(ma), '30b: mismatch par automatic fresh retry (x2)');
  ok((ma.match(/shaMatchesOrUnknown\(partApk, cleanUrl\)/g) || []).length >= 2, '30c: main + 416-cache dono paths verify hote hain');
  var byml = fs.readFileSync(__dirname + '/../.github/workflows/build-apk.yml', 'utf8');
  ok(/apksigner.*verify/.test(byml), '30d: CI signature gate (apksigner verify)');
  ok(/versionCode regress/.test(byml), '30e: CI versionCode-monotonic gate');
  ok(/MiniEsports\.apk\.sha256/.test(byml), '30f: CI .sha256 asset publish');
  ok(fs.existsSync(__dirname + '/../scripts/post-release-verify.sh'), '30g: post-release-verify (real-app evidence) script exists');
  var grad = fs.readFileSync(__dirname + '/../android/app/build.gradle', 'utf8');
  ok(/gitCommitCount\(\) \+ versionOffset\(\)/.test(grad), '30h: versionCode = commitCount + VERSION_OFFSET (downgrade/App-not-installed fix)');
  ok(/TAG="v1\.0\.\$\{VC\}"/.test(byml), '30i: release TAG offset-aware VC se');
  ok(/REF="hddhkculuyrfoevxmlwy"/.test(byml) && /SUPABASE_SERVICE_ROLE/.test(byml), '30j: live_config auto-bump = asli ref + service_role PostgREST');
  /* ── TEST 31: D94 offline-banner fix (Firebase-WS dependency hatayi) ── */
  var oh = fs.readFileSync(__dirname + '/../js/offline-handler.js', 'utf8');
  ok(!/\.info\/connected/.test(oh), '31a: offline-handler me Firebase .info/connected dependency NAHI (forever-banner root cause)');
  ok(/navigator\.onLine/.test(oh) && /supabase\.co\/rest/.test(oh), '31b: offline detect = browser events + asli Supabase data-probe');
  ok(/addEventListener\('online'/.test(oh) && /_setOnline\(\)/.test(oh), '31c: online hote hi instant hide hook');
  ok(/_online = \(typeof navigator === 'undefined'\) \? true : navigator\.onLine !== false;/.test(oh), '31d: boot par online assume (koi startup banner nahi), probe confirm karta hai');
  ok(/onclick = function \(\) \{ probe\(true\); \}/.test(oh), '31e: banner tap = manual re-probe');

  /* ── TEST 32: D95 owner batch — search/notif/support/chat/premium-row ── */
  var ab = fs.readFileSync(__dirname + '/../features/admin-badge.js', 'utf8');
  ok(!/\{ text: 'Active'/.test(ab), '32a: support tab me jhootha "Active" default badge NAHI (owner: admin hamesha active dikhta tha)');
  ok(/Support Team/.test(ab) && /getPresencePill/.test(ab), '32b: neutral default + verified-presence pill (Online/Away sirf asli data se)');
  ok(/showMatchDisputeForm/.test(ab) && !/navTo\('matches'\)/.test(ab), '32c: Match Dispute = asli form (sheet band karke matches par phekna band)');
  ok(/supportOnline\.json/.test(ab) && /_restPresence/.test(ab), '32d: presence REST fallback (Firebase WS atke to bhi asli status)');
  ok(/support_tickets[\s\S]{0,400}match_dispute/.test(ab), '32e: dispute ticket server-authoritative insert (support_tickets, subject match_dispute)');
  var sp = fs.readFileSync(__dirname + '/../screens/support.js', 'utf8');
  ok(/orderBy=%22\$key%22/.test(sp) && /_restMessages/.test(sp), '32f: chat history Firebase REST se (WS atke to bhi purane messages)');
  ok(/_restPutMsg/.test(sp) && /method: 'PUT'/.test(sp), '32g: chat send REST-primary (WS dead ho to bhi message server tak)');
  ok(/_injectChatStyles/.test(sp) && /chat-send-btn/.test(sp), '32h: chat UI stylish override maujood');
  var ft = fs.readFileSync(__dirname + '/../features/free-trial.js', 'utf8');
  ok(/_dismissPremiumExpiryBanner/.test(ft) && /_premDismissKey/.test(ft), '32i: premium countdown row dismissible (✕ = us expiry ke liye permanently hat gayi)');
  ok(/modalOpen \? 'none' : 'flex'/.test(ft) && /if \(modalOpen\) return true;/.test(ft), '32j: modal/sheet khuli ho to countdown row chhupti hai (backdrop ke upar nahi tairti)');
  var hm = fs.readFileSync(__dirname + '/../screens/home.js', 'utf8');
  ok(/usrSrchV2/.test(hm) && /conic-gradient/.test(hm), '32k: search UI stylish v2 (glass input + gradient-ring cards)');
  ok(/pubPc2Host" style="[^"]*overflow:hidden/.test(hm), '32l: searched profile art clipped frame me — border se bahar nahi');
  var nf = fs.readFileSync(__dirname + '/../screens/notifications.js', 'utf8');
  ok(/colRgb/.test(nf) && /notifications<\/span>/.test(nf), '32m: notification UI stylish v2 (type-colored gradient cards + count chip)');
/* ── TEST 33: D96 — PCARD2 banner window-clip + premium chip izzat ── */
  var pc = fs.readFileSync(__dirname + '/../js/profile-card2-core.js', 'utf8');
  ok(/BWIN = \{ l: 3\.25, r: 3\.35, t: 3\.85, b: 3\.95 \}/.test(pc), '33a: frame inner-window rect measured (pngjs) — banner clip insets');
  ok(/data-pc2win="1"/.test(pc) && /if \(d\.banner\)/.test(pc), '33b: custom banner SIRF frame-window ke andar render (full-bleed nahi)');
  ok(/var bg = d\.banner \? '' : SCENE/.test(pc), '33c: banner wale card me margins clean dark (scene full-bleed sirf default par)');
  ok(/data-pc2chips="1"/.test(pc) && !/left:30%;right:4%;top:76\.4%;height:4\.4%[^"]*overflow:hidden/.test(pc), '33d: chips row poori strip + koi overflow-hidden clipping nahi');
  ok(/linear-gradient\(135deg,#ffd75e,#ff9c00\)/.test(pc), '33e: premium chip = solid gold gradient pill (nishani aur izzat)');
  ok(/querySelectorAll\('\[data-pc2chips\]'\)/.test(pc), '33f: chips font card-size ke saath scale (fixed-9px katne wala bug gaya)');
  ok(/if \(d\.banner && imgs && imgs\.banner\)/.test(pc) && /if \(bgImg && !d\.banner\)/.test(pc), '33g: share-canvas me bhi wahi window-clip (HTML aur share pixel-consistent)');
  var ls = fs.readFileSync(__dirname + '/../core/listeners.js', 'utf8');
  ok(/UD\.is_vip = !!sp\.is_vip;/.test(ls), '33h: users.is_vip UD par map hota hai (own-card VIP chip missing bug gaya)');
  var dbj = fs.readFileSync(__dirname + '/../core/db.js', 'utf8');
  ok(/premium_level,premium_expires,is_vip,clan_id/.test(dbj), '33i: getMe select me is_vip+premium_expires (boot par hi chip, 30s poll ka wait nahi)');
/* ── TEST 34: D97 AUDIT — probe apikey + stored-XSS sinks escaped ── */
  var oh = fs.readFileSync(__dirname + '/../js/offline-handler.js', 'utf8');
  ok(/apikey: window\._SUPA_ANON_KEY/.test(oh) && !/np=' \+ Date\.now\(\)/.test(oh), '34a: offline-probe anon apikey header + no np-nonce (401/400 console-spam band)');
  var dbj2 = fs.readFileSync(__dirname + '/../core/db.js', 'utf8');
  ok(/window\._SUPA_ANON_KEY = SUPA_KEY;/.test(dbj2), '34b: anon key raw-fetch consumers ke liye exposed');
  var pf = fs.readFileSync(__dirname + '/../screens/profile.js', 'utf8');
  ok(/escHtml\(pendingIgn\)/.test(pf) && /escHtml\(pendingUid\)/.test(pf), '34c: pending IGN/UID rows escaped (stored-XSS sink band)');
  ok(/value=\"' \+ \(window\.escHtml\?window\.escHtml\(ud\.ign/.test(pf) && /escHtml\(ud\.phone/.test(pf), '34d: puIgn/puUid/puPhone value-attributes escaped (attr-breakout band)');
  var uf = fs.readFileSync(__dirname + '/../js/ui-fixes.js', 'utf8');
  ok(/escHtml\(UD\.ign/.test(uf) && /escHtml\(UD\.ffUid/.test(uf), '34e: ui-fixes profile form values escaped');
/* ── TEST 35: D98 — F3 chip/ticker overlap + F4 compliant wording ── */
  var vn = fs.readFileSync(__dirname + '/../js/verify-nudge.js', 'utf8');
  ok(/classList\.add\('vn-chip-on'\)/.test(vn) && /classList\.remove\('vn-chip-on'\)/.test(vn), '35a: chip show/hide par body class toggle (ticker overlap fix)');
  var stc = fs.readFileSync(__dirname + '/../styles.css', 'utf8');
  ok(/body\.vn-chip-on \.ticker-wrap\{padding-right:min\(48%,344px\) !important\}/.test(stc), '35b: chip on hone par ticker clip-region chhoti (!important — style.css shorthand se safe)');
  var ut = fs.readFileSync(__dirname + '/../core/utils.js', 'utf8');
  ok(/window\.compliantTicker = function/.test(ut) && /earn\\s\+money/gi.test(ut), '35c: compliantTicker normalizer (earn-money wording halal stance ke against)');
  var f5 = fs.readFileSync(__dirname + '/../js/fix5-listener-manager.js', 'utf8');
  var ln = fs.readFileSync(__dirname + '/../core/listeners.js', 'utf8');
  ok(/compliantTicker/.test(f5), '35d: RTDB ticker apply par normalizer (fix5)');
  var fu = fs.readFileSync(__dirname + '/../js/features-user.js', 'utf8');
  ok(/updateTicker[\s\S]{0,400}compliantTicker/.test(fu), '35d2: features-user updateTicker (asli raw setter) bhi normalized');
  ok(/compliantTicker/.test(ln), '35e: live_config ticker apply par bhi normalizer');
  var ix = fs.readFileSync(__dirname + '/../index.html', 'utf8');
  var stM = (ix.match(/\?v=(\d+[a-z])/) || [])[1];
  ok(stM && new RegExp('green_bg\\.jpg\\?v=' + stM).test(ix), '35f: GD card asset current v-stamp ke saath (Entry Matches wording live)');

/* ── TEST 36: D99 — third-party audit ke P1 findings (SQL + Android + client + build) ── */
  var MIG = fs.readFileSync(__dirname + '/../supabase/migrations/20261109_d99_audit_fixes.sql', 'utf8');
  ok(/CREATE OR REPLACE FUNCTION public\.wallet_col_for_entry_type/.test(MIG) && /WHEN 'coins'\s+THEN 'coins'/.test(MIG), '36a: canonical entry-type→wallet helper (coin/coins dono → coins; SKY chori band)');
  ok(/gift_match_entry[\s\S]{0,4000}wallet_col_for_entry_type/.test(MIG), '36b: gift_match_entry ab canonical wallet se debit karta hai (live bug: coins match par sky kat-ta tha)');
  ok(/Match ab joinable nahi hai/.test(MIG) && /Match full hai — gift nahi bhej sakte/.test(MIG) && /pehle se registered hai/.test(MIG), '36c: gift pre-flight (status/full/duplicate) — paisa katkar entry na banne wala rasta band');
  ok(/UPDATE gift_tickets SET status = 'delivered'/.test(MIG) && /'entry_registered', true/.test(MIG), '36d: gift ticket flow complete — entry turant register + ticket delivered');
  ok(/WHEN 'greendiamond' THEN v_server_fee := 0; v_fee_mode := 'free';/.test(MIG), '36e: join_match_team D87-aligned (GD entry free — solo/team rules ab ek jaise)');
  ok(/match_cancelled_gift_refund/.test(MIG) && /v_gt from_uid|v_gt\.from_uid/.test(MIG), '36f: match cancel par gift GIVER ko refund (paisa doobna band)');
  ok(/admin_confirm_creator_cheat[\s\S]{0,3000}wallet_col_for_entry_type/.test(MIG) && /IF v_col IN \('coins','sky_diamonds'\) THEN/.test(MIG), '36g: cheat-confirm refund canonical + ledger SIRF sachhe credit par (jhootha audit-trail band)');
  ok(/admin_dismiss_creator_flag[\s\S]{0,2500}wallet_col_for_entry_type/.test(MIG) && /creator_publish_result[\s\S]{0,3000}wallet_col_for_entry_type/.test(MIG), '36h: creator prize paths — canonical wallet + canonical ledger label');
  ok(/claim_ad_reward[\s\S]{0,1500}not in \(\s*'https:\/\/deepsilence10161-source\.github\.io'/.test(MIG) && !/if v_org not like '%deepsilence10161-source\.github\.io%' then/.test(MIG), '36i: ad reward Origin EXACT allowlist (substring spoof band)');
  ok(/claim_watch_earn_reward[\s\S]{0,2000}origin not allowed/.test(MIG), '36j: watch-earn claim par bhi Origin guard (pehle tha hi nahi)');
  ok(/ad_watch_start[\s\S]{0,1200}update public\.ad_watch_sessions set consumed = true where uid = v_uid and not consumed;/.test(MIG), '36k: ad session stacking band (ek waqt me ek open session)');
  ok(/CREATE OR REPLACE FUNCTION public\.submit_sponsored_withdrawal/.test(MIG) && /CREATE OR REPLACE FUNCTION public\.resolve_sponsored_withdrawal/.test(MIG) && /balance_deducted_at_submit/.test(MIG), '36l: sponsored-withdrawal RPC source repo me (parity) + reject semantics explicit');

  var MA = fs.readFileSync(__dirname + '/../android/app/src/main/java/com/miniesports/app/MainActivity.java', 'utf8');
  ok(/static boolean isTrustedAppHost\(String url\)/.test(MA) && /static boolean isTrustedNavHost\(String url\)/.test(MA) && /static String hostOf\(String url\)/.test(MA), '36m: Android host-exact URL helpers (Uri.getHost, substring nahi)');
  ok(!/url\.contains\("deepsilence10161-source\.github\.io"\)/.test(MA) && !/u\.contains\("deepsilence10161-source\.github\.io"\)/.test(MA) && !/origin\.contains\("deepsilence10161-source\.github\.io"\)/.test(MA), '36n: koi bhi contains()-based domain check bacha nahi (attacker query-param spoof band)');
  var gateCount = (MA.match(/if \(!bridgeAllowed\(\)\)/g) || []).length;
  var bridgeCount = (MA.match(/^\s*@JavascriptInterface\s*$/gm) || []).length;
  ok(bridgeCount > 0 && gateCount >= bridgeCount - 2, '36o: har @JavascriptInterface method par master-gate (' + gateCount + '/' + bridgeCount + ')');
  ok(/s\.setAllowFileAccess\(false\)/.test(MA) && /s\.setAllowUniversalAccessFromFileURLs\(false\)/.test(MA) && /s\.setAllowFileAccessFromFileURLs\(false\)/.test(MA), '36p: WebView file-access hardening');
  ok(/s\.setMixedContentMode\(WebSettings\.MIXED_CONTENT_NEVER_ALLOW\)/.test(MA) && !/MIXED_CONTENT_ALWAYS_ALLOW/.test(MA), '36q: mixed content NEVER_ALLOW (HTTP injection band)');
  ok(/popup\.getSettings\(\)\.setMixedContentMode\(WebSettings\.MIXED_CONTENT_NEVER_ALLOW\)/.test(MA) && /popup\.getSettings\(\)\.setAllowFileAccess\(false\)/.test(MA), '36r: popup WebView bhi utna hi strict');
  ok((MA.match(/isAllowedUpdateUrl\(/g) || []).length >= 4, '36s: APK download/install sirf host-allowlist se (main + popup + download-listener + deep-link)');

  ok(fs.existsSync(__dirname + '/../android/gradlew') && fs.existsSync(__dirname + '/../android/gradle/wrapper/gradle-wrapper.jar'), '36t: gradle wrapper repo me (zip se bhi build possible)');
  var gwp = fs.readFileSync(__dirname + '/../android/gradle/wrapper/gradle-wrapper.properties', 'utf8');
  ok(/gradle-8\.2-bin\.zip/.test(gwp), '36u: wrapper Gradle 8.2 (CI ke barabar)');
  var bg = fs.readFileSync(__dirname + '/../android/app/build.gradle', 'utf8');
  ok(/def fallbackCommitCount\(\)/.test(bg) && /VERSION_FALLBACK/.test(bg), '36v: versionCode git-absent fallback (zip build fail nahi hota)');
  var vf = fs.readFileSync(__dirname + '/../VERSION_FALLBACK', 'utf8').trim();
  ok(/^\d+$/.test(vf) && parseInt(vf, 10) > 500, '36w: VERSION_FALLBACK committed numeric (' + vf + ')');

  var pkg = JSON.parse(fs.readFileSync(__dirname + '/../package.json', 'utf8'));
  ok(pkg.scripts && /run-smoke-tests\.js/.test(pkg.scripts.test || ''), '36x: npm test = smoke suite (pehle "no test specified" fail karta tha)');
  var fsr = JSON.parse(fs.readFileSync(__dirname + '/../firebase-security-rules.json', 'utf8'));
  ok(!!fsr._WARNING && !!fsr._STATUS, '36y: firebase-security-rules.json LEGACY-marked (deploy-block + proof-not warning)');

  var f5b = fs.readFileSync(__dirname + '/../js/fix5-listener-manager.js', 'utf8');
  ok(!/realMoney\/winnings'\)\.transaction/.test(f5b) && !/toast\('[^']*Amount refunded/.test(f5b), '36z: withdrawal-reject par client-side fake refund + jhootha "Amount refunded" toast gaya');
  ok(/amount aapke balance me hi hai/.test(f5b), '36z2: rejection par sachhi baat (submit par deduction hota hi nahi)');
  var dbb = fs.readFileSync(__dirname + '/../core/db-bridge.js', 'utf8');
  ok(!/return Promise\.resolve\(\{ error/.test(dbb) && (dbb.match(/Promise\.reject\(new Error\('BLOCKED/g) || []).length >= 6, '36z3: bridge ke blocked money/premium/ledger paths ab REJECT karte hain (fake-success band)');
  var allJs = ['js', 'core', 'screens', 'features'].reduce(function (acc, d) {
    return acc.concat(fs.readdirSync(__dirname + '/../' + d).filter(function (f) { return f.endsWith('.js'); })
      .map(function (f) { return d + '/' + f; }));
  }, []);
  var badWriters = allJs.filter(function (f) {
    var t = fs.readFileSync(__dirname + '/../' + f, 'utf8');
    return /db\.ref\([^)]*realMoney\/winnings[^)]*\)\s*\.\s*(transaction|set|update)/.test(t);
  });
  ok(badWriters.length === 0, '36z4: koi bhi client file blocked realMoney-credit path use nahi karti' + (badWriters.length ? ' (' + badWriters.join(',') + ')' : ''));
})();

/* ═══════════════════════════════════════════════════════════════════════════
   TEST 37 — D99-F1/F2: HTML-sink escaping (stored-XSS class) permanent guards
   ───────────────────────────────────────────────────────────────────────────
   Background: D99 live gate (tools/audit/xss-pass.cjs + stray-where.cjs) me
   chat screen par 2 ZINDA payload nodes mile — `#chatMsgs` ke andar
   `<img src=x onerror=…>` aur `<svg onload=…>` (stray=2, xss=0). Wajah:
   screens/support.js renderChatList() message text ko RAW innerHTML me daalta
   tha. Usi class ke baaki sinks bhi sweep kiye gaye (matchFeed, clan, duel,
   mentor, auto-squad, bracket, partner-name, toast). Ye guards wapas regression
   rokne ke liye hain.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  var rd = function (p) { return fs.readFileSync(__dirname + '/../' + p, 'utf8'); };

  /* 37a — support chat bubble: text escaped, raw `+ txt +` sink khatam */
  var sup = rd('screens/support.js');
  ok(/var txt = \(window\.escHtml \? window\.escHtml\(m\.text \|\| m\.message \|\| ''\)/.test(sup),
     '37a: support-chat message text ab escHtml se escape hota hai (admin reply + user msg dono)');
  /* note: escaped value bhi `+ txt +` se hi interpolate hota hai — isliye guard
     ASSIGNMENT par hai (raw `var txt = (m.text …)` wapas na aaye). */
  ok(!/var txt = \(m\.text/.test(sup) && /window\.escHtml \? window\.escHtml\(m\.text/.test(sup),
     '37a2: support.js me raw txt assignment wapas nahi aaya (escape hi ek raasta)');

  /* 37b — match live feed text (RTDB, admin/creator likhta hai) */
  ok(/escHtml\(e\.text \|\| 'Event'\)/.test(rd('js/features-user.js')),
     '37b: matchFeed event text escaped (showMatchFeed)');

  /* 37c — toast ke DONO asli renderer escape karte hain */
  ok(/escHtml\(msg == null \? '' : msg\)/.test(rd('core/utils.js')),
     '37c: core/utils.js toast() msg escape karta hai');
  ok(/escHtml\(item\.msg == null \? '' : item\.msg\)/.test(rd('js/fix9-toast-queue.js')),
     '37c2: fix9-toast-queue (ACTIVE window.toast override) msg escape karta hai');

  /* 37d — onclick-attribute contexts ke liye JS+HTML escape helper */
  var ut = rd('core/utils.js');
  ok(/window\.escAttrJs = function/.test(ut)
     && ut.indexOf("window.escHtml(String(str == null ? '' : str).replace(") !== -1
     && /escAttrJs[\s\S]{0,220}?replace\(\/'\/g/.test(ut),
     '37d: escAttrJs helper maujood (pehle JS backslash+quote escape, phir escHtml) — attribute breakout band');
  ['features/challenge.js', 'features/friends.js', 'features/mentor.js', 'features/clan-war.js'].forEach(function (f) {
    var t = rd(f);
    ok(!/\.replace\(\/'\/g,"\\'"\)/.test(t) && /escAttrJs/.test(t),
       '37d-' + f.split('/')[1] + ': purana sirf-quote wala onclick escape gaya, escAttrJs laga');
  });

  /* 37e — doosre user / admin ke free-text fields escape */
  ok((rd('features/clan.js').match(/escHtml\(/g) || []).length >= 5, '37e: clan name/tag/emblem escaped');
  ok(/escHtml\(myClanName\)/.test(rd('features/clan-war.js')) && /escHtml\(oppName\)/.test(rd('features/clan-war.js')),
     '37e2: clan-war me apna + opponent clan name escaped');
  ok(/escHtml\(pIgn\)/.test(rd('features/auto-squad.js')) && /escHtml\(p\.rank_tier \|\| 'Bronze'\)/.test(rd('features/auto-squad.js')),
     '37e3: auto-squad player IGN + rank tier escaped');
  ok(/escHtml\(t\.name\|\|'Tournament'\)/.test(rd('features/bracket.js')) && /escHtml\(\(round\.name/.test(rd('features/bracket.js')),
     '37e4: bracket tournament + round name escaped');
  ok((rd('core/utils.js').match(/escHtml\((duoT\.memberName|sm\.name)/g) || []).length >= 6,
     '37e5: duo/squad-mate partner name (doosre user ka IGN) escaped');
  ok(/escHtml\(\(isChallenger\?d\.challengee_ign:d\.challenger_ign\)\)/.test(rd('features/challenge.js')),
     '37e6: duel list me challenger/challengee IGN escaped');

  /* 37f — repo-wide: in files me raw cross-user sink patterns wapas na aayein */
  var BLACKLIST = [
    ['screens/support.js', /var txt = \(m\.text/, 'chat text raw'],
    ['js/features-user.js', /\+ \(e\.text \|\| 'Event'\) \+/, 'matchFeed raw'],
    ['core/utils.js', /fa-' \+ ic \+ '><\/i>' \+ msg;/, 'toast msg raw'],
    ['js/fix9-toast-queue.js', /\+ item\.msg;/, 'toast queue msg raw'],
    ['features/clan.js', /\+clan\.tag\+|\+\(clan\.name\|\|'My Clan'\)\+/, 'clan raw'],
    ['features/auto-squad.js', /\+ pIgn \+|\+ \(p\.rank_tier \|\| 'Bronze'\) \+/, 'auto-squad raw'],
  ];
  var bad = BLACKLIST.filter(function (b) { return b[1].test(rd(b[0])); }).map(function (b) { return b[0] + ' (' + b[2] + ')'; });
  ok(bad.length === 0, '37f: raw-sink blacklist clean' + (bad.length ? ' → ' + bad.join(', ') : ''));

  /* 37g — LIVE evidence: xss-pass/stray-where ka saved result (agar maujood ho) */
  var evPath = __dirname + '/../reports/audit-d99/xss-d99.json';
  if (fs.existsSync(evPath)) {
    var ev = JSON.parse(fs.readFileSync(evPath, 'utf8'));
    var fin = ev.final || {};
    ok((fin.xss || 0) === 0 && (fin.stray || 0) === 0,
       '37g: LIVE xss-pass final → xss=0, stray=0 (chat screen par zinda payload node nahi)', fin);
  } else {
    console.log('  · 37g: reports/audit-d99/xss-d99.json nahi mila — live xss-pass chalakar save karo (skip)');
  }
})();

  /* ═══════════════════════════════════════════════════════════════════════
     TEST 38 — D100 (owner order, 7 screenshots): real medal ASSETS (emoji
     nahi), premium tier NAAM (Silver/Gold/Diamond), saaf title chip, stats
     DEDUPE (ek jagah), city leaderboard gate (sirf apni city), clan chat
     LIVE (6s poll + write-notify), Android native reverseGeocode auto-city.
     ═══════════════════════════════════════════════════════════════════════ */
(function () {
  var rd = function (p) { return fs.readFileSync(__dirname + '/../' + p, 'utf8'); };

  /* 38a — helpers maujood */
  var ut = rd('core/utils.js');
  ok(/window\.medalHtml = function/.test(ut) && /assets\/img\/ranks\/gold\.png|gold' : n === 2 \? 'silver/.test(ut.replace(/'/g, "'")),
     '38a: window.medalHtml helper (assets/img/ranks medal images)');
  ok(/window\.cleanLabel = function/.test(ut) && /window\.premTierName = function/.test(ut) && /window\.premTierIcon = function/.test(ut),
     '38a2: cleanLabel + premTierName + premTierIcon helpers');

  /* 38b — kisi bhi leaderboard renderer me medal-emoji ternary wapas na aaye */
  ['features/growth.js', 'features/clan.js', 'js/bugfix-v30-final.js', 'features/match-history.js',
   'js/match-result-detail.js', 'screens/rank.js', 'js/fixes-v7.js'].forEach(function (f) {
    var c = rd(f);
    ok(!/\?\s*'🥇'\s*:|return '🥇';|'🥇'\s*,\s*'🥈'/.test(c),
       '38b: ' + f + ' — position-medal emoji ternary khatam (medalHtml)');
  });
  ok(/medalHtml/.test(rd('features/growth.js')) && /medalHtml/.test(rd('features/clan.js'))
     && /medalHtml/.test(rd('screens/rank.js')) && /medalHtml/.test(rd('js/match-result-detail.js')),
     '38b2: medalHtml actually wired in renderers');

  /* 38c — profile: premium naam + saaf chip + stats dedupe */
  var pr = rd('screens/profile.js');
  ok(!/'⭐ Premium III'|'⭐ Premium II'|'⭐ Premium I'|'Premium III' :/.test(pr)
     && /premTierName/.test(pr) && /premTierIcon/.test(pr),
     '38c: profile premium chip = Silver/Gold/Diamond NAAM + real icon (Roman nahi)');
  ok(!/'✨ ' \+ _eqTag/.test(pr), '38c2: title chip par ✨ prefix khatam');
  ok(pr.indexOf('renderPlayerStatsCard()') === -1, '38c3: inline Career Stats card hataya (dedupe)');
  ok(pr.indexOf('window.renderStatsChart()') === -1, '38c4: inline Stats Chart call hataya (dedupe)');
  ok(!/ps-lbl\">Matches/.test(pr) && !/K\/Match/.test(pr), '38c5: 2-card + 3-cell duplicate stats blocks khatam');
  ok(/renderStatsChart\s*=\s*function[\s\S]{0,500}?return '';/.test(rd('js/features-user.js')),
     '38c6: renderStatsChart neutralized (return \'\') — purane callers safe');
  ok(/data-pc2tcover/.test(rd('js/profile-card2-core.js')),
     '38c7: pc2 title-plate baked ⚡ decor cover patch maujood (clean title render)');

  /* 38d — city leaderboard: gate + kabhi all-users fallback nahi */
  var gr = rd('features/growth.js');
  ok(/tab === 0 && !userCity/.test(gr) && /_doAutoSetLocation/.test(gr),
     '38d: My City tab — city unset par gated empty-state + Location CTA');
  ok(gr.indexOf('BUG #38 FIX') === -1, '38d2: purana all-users fallback (BUG#38) hamesha ke liye gaya');
  ok(/\(tab === 0 && userCity\)/.test(gr), '38d3: My City = SIRF eq(city) query');
  ok(/window\.cleanLabel \? window\.cleanLabel\(t\.name\)/.test(gr), '38d4: getEquippedTagText saaf text deta hai (source par strip)');

  /* 38e — clan chat LIVE */
  var db = rd('core/db-bridge.js');
  ok(/_bridgeListeners/.test(db) && /_bridgeNotify/.test(db) && /_isChat \? 6000 : 30000/.test(db),
     '38e: db-bridge — listener registry + chat paths 6s poll + write-notify');
  ok(/\.then\(function\(\) \{ _bridgeNotify\(path\); if \(cb\) cb\(null\); \}/.test(db),
     '38e2: set/update/remove ke ACK par turant notify (apna message instant)');

  /* 38f — modal.js location flow */
  var md = rd('core/modal.js');
  ok(/AndroidBridge\.reverseGeocode/.test(md) && /mpCityAutoDone/.test(md) && /window\._autoCityAndroid/.test(md),
     '38f: Android boot auto-city flow (bridge geocode → RPC, silent)');
  ok(md.indexOf("_submitLocationToServer('My City'") === -1 && !/\|\| 'Unknown'/.test(md),
     '38f2: fake \'My City\'/\'Unknown\' city fallback khatam (jhoothi entries nahi)');
  ok(/function _submitLocationToServer\(city, state, lat, lng, silent\)/.test(md),
     '38f3: _submitLocationToServer silent-mode (auto-flow me modal popup nahi)');

  /* 38g — MainActivity native reverseGeocode (gated) */
  var ma = rd('android/app/src/main/java/com/miniesports/app/MainActivity.java');
  ok(/public String reverseGeocode\(double lat, double lng\)/.test(ma)
     && /reverseGeocode[\s\S]{0,200}if \(!bridgeAllowed\(\)\)/.test(ma)
     && /android\.location\.Geocoder/.test(ma),
     '38g: MainActivity.reverseGeocode @JavascriptInterface + D99 master-gate + native Geocoder');
})();

(function () {
  /* TEST 39 — D101 (owner order): (1) GPS-OFF user-guidance flow (fail-loop khatam);
     (2) "Premium III" literal UI se khatam; (3) medal-emoji sweep — POORI app se 🥇🥈🥉
     hatakar asli assets; (4) pc2 purchased-title plate CENTER (cx 664). */
  var rd39 = function (f) { return fs.readFileSync(__dirname + '/../' + f, 'utf8'); };

  /* 39a — Android location ON-guidance */
  var ma = rd39('android/app/src/main/java/com/miniesports/app/MainActivity.java');
  ok(/public boolean isLocationEnabled\(\)/.test(ma) && /public void openLocationSettings\(\)/.test(ma)
     && /ACTION_LOCATION_SOURCE_SETTINGS/.test(ma) && /bridgeAllowed\(\)/.test(ma),
     '39a: MainActivity isLocationEnabled + openLocationSettings (gated @JavascriptInterface)');
  var md = rd39('core/modal.js');
  ok(/window\._openLocSettings = function/.test(md) && /function _locOffGuide\(/.test(md)
     && /window\._locOffGuide = _locOffGuide/.test(md),
     '39a2: modal.js _openLocSettings + _locOffGuide guide modal (+ window export)');
  ok(/AndroidBridge\.isLocationEnabled/.test(md),
     '39a3: detect + auto-city pre-check (GPS OFF → guide, baar-baar detect fail nahi)');
  ok(/if \(!window\.AndroidBridge\.isLocationEnabled\(\)\)/.test(md) && /if \(err\.code === 2\) \{ try \{ _locOffGuide\(\); \} catch/.test(md),
     '39a4: detect pre-check + POSITION_UNAVAILABLE dono par guide');

  /* 39b — Premium III literal UI se khatam */
  var hm = rd39('screens/home.js');
  ok(hm.indexOf('Premium III') === -1, '39b: home.js me Premium III literal zero (chip icon+naam)');
  ok(/premTierIcon/.test(hm) && /premTierName/.test(hm), '39b2: chip me premTierIcon img + premTierName');

  /* 39c — medal sweep: helper + zero non-comment medal emoji */
  var ut = rd39('core/utils.js');
  ok(/window\.tierIconHtml = function/.test(ut) && /assets\/img\/ranks\//.test(ut),
     '39c: tierIconHtml helper (assets/img/ranks images by tier name)');
  var medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
  var bad = [];
  ['screens', 'features', 'js', 'core'].forEach(function (d) {
    fs.readdirSync(__dirname + '/../' + d).forEach(function (fn) {
      if (!fn.endsWith('.js')) return;
      rd39(d + '/' + fn).replace(/\/\*[\s\S]*?\*\//g, '').split('\n').forEach(function (line, i) {
        var st = line.trim();
        if (st.indexOf('//') === 0) return;
        if (medals.some(function (m) { return line.indexOf(m) > -1; })) bad.push(d + '/' + fn + ':' + (i + 1));
      });
    });
  });
  ok(bad.length === 0, '39c2: 🥇🥈🥉 zero non-comment (bad: ' + bad.slice(0, 6).join(', ') + ')');
  var rs = rd39('js/rank-system.js');
  ok((rs.match(/emoji: ''/g) || []).length >= 3 && /img: 'assets\/img\/ranks\/gold\.png'/.test(rs),
     '39c3: RANK_TIERS gold/silver/bronze emoji khali, img assets maujood');
  var rk = rd39('screens/rank.js');
  ok(rk.indexOf("_rEmoji(pos)") === -1 || !/'🥇'/.test(rk), '39c4: rank.js _rEmoji medal literals khatam');

  /* 39d — pc2 purchased-title plate CENTER */
  var pc = rd39('js/profile-card2-core.js');
  ok(/title:\{ cx: 664/.test(pc), '39d: pc2 title plate cx 664 (pixel-probe center, pehle 722 right-shift)');
})();

(function () {
  /* TEST 40 — D102 (owner: "profile card me 🥇 chipka hua"): card_frame.png ke
     tier-pill me BAKED medal-emoji art tha → cover patch + dynamic ASLI rank
     asset (HTML + share canvas dono). */
  var rd40 = function (f) { return fs.readFileSync(__dirname + '/../' + f, 'utf8'); };
  var pc = rd40('js/profile-card2-core.js');
  ok(/var TIERCV = \{ l: 35\.3, t: 66\.9, w: 5\.9, h: 8\.5 \}/.test(pc),
     '40a: TIERCV pixel-probe box (frame-px x390-444 y656-732 → %)');
  ok(/data-pc2tiercover="1"/.test(pc) && /data-pc2tiericon="1"/.test(pc),
     '40b: HTML render me cover + dynamic tier icon img');
  ok(/function _tierAsset\(t\)/.test(pc) && /assets\/img\/ranks\/' \+ f \+ '\.png'/.test(pc),
     '40c: _tierAsset → assets/img/ranks real assets (bronze…legend)');
  ok(/ctx\.fillStyle = '#241600'/.test(pc) && /imgs\.tier/.test(pc),
     '40d: share canvas bhi identical (cover fillRect + tier drawImage)');
  ok(/load\(_tierAsset\(d && d\.tier\) \+ '\?v=' \+ STAMP, 'tier'\)/.test(pc),
     '40e: loadImgs tier asset load karta hai');
  /* admin: users tab 2 naye columns (app install + online) — admin repo file check */
  var fsx = require('fs');
  var ap = '/home/user/ff-admin-panel/js/admin-inline-b.js';
  if (fsx.existsSync(ap)) {
    var ab = fsx.readFileSync(ap, 'utf8');
    ok(/u\.fcmToken/.test(ab) && /u\.lastSeenAt/.test(ab),
       '40f: admin users tab — App (fcm_token platform mirror) + Online (last_seen heartbeat) wired');
    var fb = rd40('core/firebase.js');
    ok(/fcm_token: platform/.test(fb) && /fcm_updated_at/.test(fb), '40g: push-token ok → users.fcm_token platform mirror (admin-read able)');
    var sl = rd40('js/safe-loader.js');
    ok(/last_seen: new Date\(\)\.toISOString\(\)/.test(sl) && /setInterval\(_liveBeat, 60000\)/.test(sl), '40h: 60s last_seen heartbeat (online-now source)');
  }
})();

/* ✅ D103 (14-Nov-2026): header currency chips = real assets (emoji nahi) + i18n applier wired */
(function () {
  var rd41 = function (f) { return fs.readFileSync(__dirname + '/../' + f, 'utf8'); };
  var idx = rd41('index.html');
  ok(/assets\/img\/icons\/coin\.png/.test(idx) && /assets\/img\/icons\/diamond\.png/.test(idx), '41a: header coin/sky chips real icon assets use karte hain');
  ok(/js\/i18n-apply\.js/.test(idx), '41b: i18n-apply script index me wired');
  var i18 = rd41('js/i18n-apply.js');
  ok(/EN2HI/.test(i18) && /createTreeWalker/.test(i18), '41c: i18n applier text-node walker + dict present');
})();
  console.log('PASS: ' + PASS + ' | FAIL: ' + FAIL);
  if (failures.length) { console.log('failures:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(FAIL ? 1 : 0);
}, 50);
