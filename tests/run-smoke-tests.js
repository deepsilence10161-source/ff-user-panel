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

/* ── TEST 3: features-user-tail referenced after main ────────── */
console.log('\n── TEST 3: features-user-tail.js referenced (load order) ──');
{
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const mainIdx = html.indexOf('features-user.js?v=20260922t');
  const tailIdx = html.indexOf('features-user-tail.js?v=20260922t');
  ok(mainIdx !== -1, 'features-user.js referenced');
  ok(tailIdx !== -1, 'features-user-tail.js referenced');
  ok(tailIdx > mainIdx, 'tail loads after main');
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

/* ── TEST 5: ROUND-4 — checkin-system releaseNoShows server-authoritative ── */
console.log('\n── TEST 5: R4 checkin-system releaseNoShows (client slot-decrement removed) ──');
{
  const ck = fs.readFileSync(path.join(REPO, 'features/checkin-system.js'), 'utf8');
  // Client ab filled_slots ko NAHI chhedta — server (internal_process_no_show_refunds) ghataata hai
  ok(!/filled_slots[^\n]*update\(/.test(ck.split('window.releaseNoShows')[1] || ''),
     'releaseNoShows ab client filled_slots decrement NAHI karta (server-authoritative)');
  ok(ck.includes('SERVER-AUTHORITATIVE'), 'releaseNoShows me SERVER-AUTHORITATIVE marker present');
  ok(ck.includes('double-decrement'), 'double-decrement avoidance comment present');
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

console.log('\n══════════════════════════════');
console.log('PASS: ' + PASS + ' | FAIL: ' + FAIL);
if (failures.length) { console.log('failures:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(FAIL ? 1 : 0);
