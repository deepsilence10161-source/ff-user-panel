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

console.log('\n══════════════════════════════');
console.log('PASS: ' + PASS + ' | FAIL: ' + FAIL);
if (failures.length) { console.log('failures:'); failures.forEach(f => console.log('  - ' + f)); }
process.exit(FAIL ? 1 : 0);
