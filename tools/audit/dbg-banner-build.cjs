'use strict';
/* ================================================================
   dbg-banner-build.cjs — OBFUSCATED BUILD gate (banner flag)
   ----------------------------------------------------------------
   protect-build.mjs javascript-obfuscator se sab app JS ko obfuscate
   karta hai. H13 (2026-11-20) me sabak mila tha: obfuscator ne
   screens/join.js ke nested helpers (_normET/_gdLegacy) gira diye the
   → live ReferenceError. Isliye har release se PEHLE ye gate zaroori:
   obfuscated build me banner-change flag asli me kaam karta hai ya nahi.

   Ye build/ tree ko serve karke (default http://127.0.0.1:8090) QA
   player se login karta hai aur sabit karta hai:
     1. boot par koi pageerror/crash nahi
     2. window.CFG.bannerChangeEnabled = 0 (DB live_config se aaya)
     3. profile settings sheet me label "Change Banner Photo (OFF)"
     4. file choose karne par block toast + uploader tak flow nahi
     5. _normET/_gdLegacy jaisa koi global helper gayab nahi
        (join.js ke window aliases obf-exempt hain — regression watch)

   Env: BUILD_BASE (default http://127.0.0.1:8090), RUN (default bnrtgl2)
   Run: node tools/audit/dbg-banner-build.cjs
   Exit: 0 = PASS, 1 = FAIL, 2 = crash
   ================================================================ */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RUN = process.env.RUN || 'bnrtgl2';
const BUILD_BASE = process.env.BUILD_BASE || 'http://127.0.0.1:8090';
const STATE_DIR = process.env.STATE_DIR || 'tools/tri-e2e/.state';
const SB_URL = 'https://hddhkculuyrfoevxmlwy.supabase.co';
const SB_KEY = fs.readFileSync('/home/user/.secrets/supabase_service_role', 'utf8').trim();

const R = [];
function check(n, p, d) { R.push({ n, p: !!p, d: d === undefined ? '' : String(d) }); console.log((p ? '  ✓ ' : '  ✗ ') + n + (d ? '   [' + d + ']' : '')); }
async function poll(page, fn, arg, t, label) {
  const t0 = Date.now(); let last;
  while (Date.now() - t0 < (t || 20000)) {
    try { last = await page.evaluate(fn, arg); } catch (e) { last = { err: String(e.message || e).slice(0, 80) }; }
    if (last && last.ok) return last;
    await page.waitForTimeout(250);
  }
  throw new Error('poll timeout: ' + (label || '') + ' last=' + JSON.stringify(last).slice(0, 160));
}

(async () => {
  const st = JSON.parse(fs.readFileSync(path.join(STATE_DIR, RUN + '.json'), 'utf8'));
  const db = await (await fetch(SB_URL + '/rest/v1/app_settings?key=eq.live_config&select=value',
    { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } })).json();
  const flag = Number(((db[0] || {}).value || {}).bannerChangeEnabled || 0);
  console.log('BUILD_BASE=' + BUILD_BASE + '  RUN=' + RUN + '  DB flag=' + flag);

  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC', 'base64');
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--js-flags=--max-old-space-size=384'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await ctx.addInitScript((uid) => {
    try { localStorage.setItem('ffOnbV1', '1'); localStorage.setItem('tutorialSeen', '1'); localStorage.setItem('tutorialSeen_' + uid, '1'); } catch (e) {}
  }, st.player.uid);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.message || e).slice(0, 140)));

  console.log('\n── obfuscated build: boot ──');
  await p.goto(BUILD_BASE + '/index.html?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(6000);
  const boot = await p.evaluate(() => ({
    bodyLen: (document.body.innerText || '').length,
    locked: !!window.__MINI_LOCKED,
    auth: !!(window.auth && window.firebase),
    supa: !!window._supa,
    stamp: (Array.from(document.querySelectorAll('script[src]')).map(s => s.src).find(s => /\?v=/.test(s)) || '').split('?v=')[1] || '',
  }));
  check('boot: koi pageerror nahi', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  check('boot: app lock nahi (update-required screen nahi)', boot.locked === false);
  check('boot: firebase auth + supabase ready', boot.auth && boot.supa);
  check('boot: stamp 20261124a ship hua', /20261124a/.test(boot.stamp), 'stamp=' + boot.stamp);

  console.log('\n── obfuscated build: login + banner flag ──');
  await p.evaluate(([e, pw]) => window.auth.signInWithEmailAndPassword(e, pw), [st.player.email, st.player.password]);
  await poll(p, () => ({ ok: !!(window.UD && window.UD.ign) }), null, 45000, 'UD.ign');
  await p.evaluate(() => {
    window.__toasts = []; window.__bannerCalls = [];
    const t = window.toast;
    window.toast = function (m) { try { window.__toasts.push(String(m)); } catch (e) {} return t ? t.apply(this, arguments) : undefined; };
    window.uploadBannerImage = function (d, cb) { window.__bannerCalls.push(String(d).slice(0, 20)); if (cb) cb(null); };
  });
  const cfg = await poll(p, () => ({ ok: !!(window.CFG && window.CFG.bannerChangeEnabled !== undefined), flag: Number(window.CFG.bannerChangeEnabled || 0), prem: window.isPremiumActive ? window.isPremiumActive() : null }), null, 40000, 'CFG');
  check('obfuscated app-config.js se CFG.bannerChangeEnabled mila', cfg.flag === flag, 'CFG=' + cfg.flag + ' DB=' + flag);
  check('premium gate helper zinda (isPremiumActive)', cfg.prem === true, 'isPremiumActive()=' + cfg.prem);

  console.log('\n── obfuscated build: profile banner block ──');
  await p.evaluate(() => { window.navTo('profile'); });
  await p.waitForTimeout(2000);
  const sheet = await p.evaluate(() => {
    window.showProfileSettings();
    const s = document.getElementById('profSettingsSheet');
    if (!s) return { ok: false };
    const row = Array.from(s.querySelectorAll('div,span,button')).map(e => (e.textContent || '').trim()).find(t => /^Change Banner Photo/.test(t) && t.length < 40);
    return { ok: true, row: row || '', input: !!document.getElementById('profBannerIn') };
  });
  check('obfuscated profile.js: settings sheet khuli', sheet.ok === true);
  check('label me (OFF) — obfuscation ke baad bhi flag read hota hai', /\(OFF\)/.test(sheet.row), sheet.row);
  check('#profBannerIn input zinda (layout/DOM intact)', sheet.input === true);
  await p.setInputFiles('#profBannerIn', { name: 'qa-banner.png', mimeType: 'image/png', buffer: PNG });
  await p.waitForTimeout(2500);
  const out = await p.evaluate(() => ({ toasts: window.__toasts.slice(0, 5), calls: window.__bannerCalls.length }));
  check('block toast dikha (obfuscated string decode hui)', out.toasts.some(t => /band kiya hai/.test(t)), JSON.stringify(out.toasts));
  check('uploader tak flow NAHI pahuncha', out.calls === 0, 'calls=' + out.calls);

  console.log('\n── H13 regression watch: screens/join.js obf-exempt ──');
  /* ✅ 2026-11-24 (gate theek kiya): window._gdLegacy/_normET join.js ke
     NESTED scope me assign hote hain (join-flow call hone par), isliye boot
     par typeof undefined hona NORMAL hai — pehle wala runtime check jhootha
     FAIL de raha tha. H13 ka asli invariant ye hai ki obfuscator join.js ko
     chhue hi nahi (warna nested definitions gir jaati thi aur call-sites
     ReferenceError dete the). Isliye ab FILE-LEVEL proof:
       (a) build/screens/join.js == source screens/join.js (byte-identical)
       (b) usme function _gdLegacy/_normET + window aliases maujood
       (c) runtime: window.cJoin function hai (join.js execute hua) */
  const crypto = require('crypto');
  const srcJoin = fs.readFileSync('screens/join.js');
  const bldJoin = fs.readFileSync('build/screens/join.js');
  const sha = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 12);
  check('build/screens/join.js source ke byte-identical (OBF_SKIP_FILES chala)',
    sha(srcJoin) === sha(bldJoin), 'src=' + sha(srcJoin) + ' build=' + sha(bldJoin) + ' (' + srcJoin.length + 'B/' + bldJoin.length + 'B)');
  const jt = bldJoin.toString('utf8');
  check('build join.js me function _gdLegacy + _normET definitions', /function _gdLegacy\(/.test(jt) && /function _normET\(/.test(jt));
  check('build join.js me window aliases (obfuscated call-sites ke liye)', /window\._gdLegacy = _gdLegacy/.test(jt) && /window\._normET = _normET/.test(jt));
  const al = await p.evaluate(() => ({ cJoin: typeof window.cJoin, normET: typeof window._normET }));
  check('runtime: window.cJoin zinda (join.js execute hua)', al.cJoin === 'function', 'typeof=' + al.cJoin);
  console.log('  ℹ️ note: window._normET boot par ' + al.normET + ' hai — ye EXPECTED hai (alias join-flow call par set hota hai, nested scope).');

  const errs2 = await p.evaluate(() => 0);
  check('poore flow me koi pageerror nahi aaya', errs.length === 0, JSON.stringify(errs.slice(0, 3)) + ' x=' + errs2);
  await browser.close();

  const bad = R.filter(x => !x.p);
  console.log('\n══════════════════════════════════════════════════');
  console.log('BUILD-GATE PASS: ' + (R.length - bad.length) + ' | FAIL: ' + bad.length);
  bad.forEach(b => console.log('  ✗ ' + b.n + ' [' + b.d + ']'));
  console.log('══════════════════════════════════════════════════');
  process.exit(bad.length ? 1 : 0);
})().catch(e => { console.error('CRASH: ' + (e && e.stack || e)); process.exit(2); });
