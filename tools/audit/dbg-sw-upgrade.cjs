'use strict';
/* ================================================================
   dbg-sw-upgrade.cjs — SERVICE WORKER upgrade gate (release ke liye)
   ----------------------------------------------------------------
   Har release par sw.js ka CACHE_VER badhta hai, aur sw.js ka activate
   handler purani saari caches delete karta hai. Agar ye upgrade path
   toota to users purani cache me hamesha ke liye fanse rahenge
   ("fix apply hi nahi hua" wala purana dard).

   Ye gate ASLI upgrade path simulate karta hai:
     PHASE 1 — pub tree me PURANA sw.js (pichli release wala) daal kar
               load → purani CACHE_VER ki caches banti hain
     PHASE 2 — sw.js ko NAYA (is release wala) karke reload →
               naya SW install+activate ho, purani caches WIPE hon,
               page controlled rahe, app JS load hota rahe

   ⚠️ Is gate ko chalane ke liye ek local static server chahiye jo PUB tree
      serve kar raha ho (default http://127.0.0.1:8099) aur PUB_DIR writable ho.
      Gate ke end me PUB_DIR/sw.js NAYA wala hi chhodta hai.

   Env:  BASE (default http://127.0.0.1:8099)
         PUB_DIR (default /tmp/pubrel)
         OLD_SW  (purane sw.js ka path; default = PUB_DIR me `git show HEAD:sw.js`)
   Run:  node tools/audit/dbg-sw-upgrade.cjs
   Exit: 0 = PASS, 1 = FAIL, 2 = crash
   ================================================================ */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const PUB = process.env.PUB_DIR || '/tmp/pubrel';
const SWP = path.join(PUB, 'sw.js');

const R = [];
function check(n, p, d) { R.push({ n, p: !!p, d: d === undefined ? '' : String(d) }); console.log((p ? '  ✓ ' : '  ✗ ') + n + (d ? '   [' + d + ']' : '')); }
function cacheVer(file) {
  const s = fs.readFileSync(file, 'utf8');
  const m = s.match(/var\s+CACHE_VER\s*=\s*'([^']+)'/) || s.match(/CACHE_VER\s*=\s*'([^']+)'/);
  return m ? m[1] : '(obfuscated/unknown)';
}

(async () => {
  const NEW = Buffer.from(fs.readFileSync(SWP));
  const NEWV = cacheVer(SWP);
  let OLD;
  if (process.env.OLD_SW) { OLD = fs.readFileSync(process.env.OLD_SW); }
  else {
    // HEAD ka sw.js aksar NAYA hi hota hai (release commit ho chuka hota hai),
    // toh purana SW HEAD~1 (pichli release) se lo — asli upgrade scenario wahi hai.
    OLD = execSync('git show HEAD:sw.js', { cwd: PUB, maxBuffer: 1 << 26 });
    fs.writeFileSync('/tmp/sw-old-gate.js', OLD);
    if (cacheVer('/tmp/sw-old-gate.js') === NEWV) {
      try { OLD = execSync('git show HEAD~1:sw.js', { cwd: PUB, maxBuffer: 1 << 26 }); }
      catch (e) { console.log('  (HEAD~1 nahi mila — shallow clone? OLD_SW=<file> do)'); }
    }
  }
  fs.writeFileSync('/tmp/sw-old-gate.js', OLD);
  const OLDV = cacheVer('/tmp/sw-old-gate.js');
  console.log('BASE=' + BASE + '  PUB=' + PUB);
  console.log('OLD CACHE_VER=' + OLDV + ' (' + OLD.length + 'B)   NEW CACHE_VER=' + NEWV + ' (' + NEW.length + 'B)');
  if (OLDV === NEWV) { console.error('\n❌ OLD aur NEW CACHE_VER SAME (' + NEWV + ') — upgrade simulate hi nahi hua, gate jhooth bol dega.\n   OLD_SW=<purane release ka sw.js> de kar chalao (shallow clone me HEAD~1 nahi milta).'); process.exit(2); }

  const b = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--js-flags=--max-old-space-size=384'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const failed = [];
  p.on('requestfailed', r => { const u = r.url(); if (!/google-analytics|gstatic|fonts\.g/.test(u)) failed.push(u.split('/').pop().slice(0, 46) + '::' + ((r.failure() || {}).errorText || '')); });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.message || e).slice(0, 110)));

  console.log('\n── PHASE 1 — purana SW (jaise live user ke browser me hai) ──');
  fs.writeFileSync(SWP, OLD);
  await p.goto(BASE + '/index.html?cb=' + Date.now(), { waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(11000);
  const r1 = await p.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return { active: r && r.active ? r.active.state : null, controlled: !!navigator.serviceWorker.controller, keys: await caches.keys() };
  });
  check('purana SW activate hua', r1.active === 'activated', 'state=' + r1.active);
  check('purani CACHE_VER ki caches bani', r1.keys.some(k => k.indexOf(OLDV) === 0), JSON.stringify(r1.keys));

  console.log('\n── PHASE 2 — naya SW ship hua → reload (asli upgrade) ──');
  fs.writeFileSync(SWP, NEW);
  await p.reload({ waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(13000);
  const r2 = await p.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return { active: r && r.active ? r.active.state : null, waiting: !!(r && r.waiting), controlled: !!navigator.serviceWorker.controller, keys: await caches.keys(), url: r && r.active ? r.active.scriptURL : '' };
  });
  check('naya SW activate hua (waiting nahi)', r2.active === 'activated' && !r2.waiting, 'state=' + r2.active + ' waiting=' + r2.waiting);
  check('page naye SW ke control me hai', r2.controlled === true);
  check('PURANI caches WIPE hui (' + OLDV + ')', !r2.keys.some(k => k.indexOf(OLDV) === 0), JSON.stringify(r2.keys));
  check('NAYI caches bani (' + NEWV + ')', r2.keys.some(k => k.indexOf(NEWV) === 0), JSON.stringify(r2.keys));

  const boot = await p.evaluate(() => ({
    bodyLen: (document.body.innerText || '').length,
    auth: !!(window.auth && window.firebase), supa: !!window._supa,
    locked: !!window.__MINI_LOCKED, prem: typeof window.isPremiumActive,
    cfg: window.CFG ? Number(window.CFG.bannerChangeEnabled || 0) : null,
  }));
  check('app naye SW ke neeche sahi boot hui', boot.auth && boot.supa && !boot.locked, JSON.stringify(boot));
  check('banner flag naye SW ke neeche bhi read hua', boot.cfg === 0, 'CFG.bannerChangeEnabled=' + boot.cfg);
  check('koi pageerror nahi', errs.length === 0, JSON.stringify(errs.slice(0, 3)));

  console.log('\n── PHASE 3 — teesra load (SW cache se serve) ──');
  const fBefore = failed.length;
  await p.reload({ waitUntil: 'load', timeout: 60000 });
  await p.waitForTimeout(9000);
  const r3 = await p.evaluate(async () => ({ keys: await caches.keys(), bodyLen: (document.body.innerText || '').length, prem: typeof window.isPremiumActive }));
  check('cache-stable: wahi CACHE_VER families', r3.keys.every(k => k.indexOf(NEWV) === 0), JSON.stringify(r3.keys));
  check('app JS load hota raha (pageerror nahi)', errs.length === 0, JSON.stringify(errs.slice(0, 3)));
  console.log('  ℹ️ app-request failures (local python server flaky ho sakta hai): total=' + failed.length + ' phase3-ke-baad=' + (failed.length - fBefore) + ' → ' + JSON.stringify(failed.slice(0, 5)));

  fs.writeFileSync(SWP, NEW);   /* gate ke baad PUB tree me NAYA sw.js hi rahe */
  check('PUB_DIR/sw.js naya wala restore hua', cacheVer(SWP) === NEWV, cacheVer(SWP));
  await b.close();

  const bad = R.filter(x => !x.p);
  console.log('\n══════════════════════════════════════════════════');
  console.log('SW-UPGRADE GATE  PASS: ' + (R.length - bad.length) + ' | FAIL: ' + bad.length);
  bad.forEach(x => console.log('  ✗ ' + x.n + ' [' + x.d + ']'));
  console.log('══════════════════════════════════════════════════');
  process.exit(bad.length ? 1 : 0);
})().catch(e => { fs.existsSync(SWP) && null; console.error('CRASH: ' + (e && e.stack || e)); process.exit(2); });
