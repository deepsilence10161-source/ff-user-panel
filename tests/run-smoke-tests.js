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
     (wo anon role par "permission denied for table match_interest" deta tha) */
  try {
    const ad = fs.readFileSync(path.join(REPO, '..', 'ff-admin-panel/js/admin-inline-c.js'), 'utf8');
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
  const calls = (rk.match(/seasonBanner \+ rankTools/g) || []).length;
  ok(calls === 4,
     'B28: rankTools saare render paths me (turant render + teen _renderRankList calls)');
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

console.log('\n══════════════════════════════');
console.log('PASS: ' + PASS + ' | FAIL: ' + FAIL);
if (failures.length) { console.log('failures:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(FAIL ? 1 : 0);
