'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const cred = JSON.parse(fs.readFileSync('tools/tri-e2e/.state/d102a.json', 'utf8'));
  const OUT = 'reports/release-evidence/20261109-d102';
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  /* ctx1: PLAYER user panel (presence online) */
  const ctxU = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctxU.addInitScript(() => { try { localStorage.setItem('ffOnbV1', '1'); } catch (e) {} });
  const pu = await ctxU.newPage();
  await pu.goto('https://deepsilence10161-source.github.io/ff-user-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pu.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await pu.evaluate(([em, pw]) => window.auth.signInWithEmailAndPassword(em, pw), [cred.player.email, cred.player.password]);
  await pu.waitForFunction(() => window.UD && window.UD.ign, null, { timeout: 30000 });
  await pu.waitForTimeout(2500);
  /* simulate APK: appInstall mirror (asli flow: _onNativeFcmToken → _pushTokenCall ok → mirror) */
  await pu.evaluate(() => new Promise(res => {
    try { window._fbDb.ref('users/' + window.U.uid + '/appInstall').set({ platform: 'android', t: Date.now() }).then(() => res('ok'), () => res('err')); } catch (e) { res('throw'); }
  })).then(r => console.log('appInstall mirror:', r));
  const pres = await pu.evaluate(() => new Promise(res => {
    try { window._fbDb.ref('presence/' + window.U.uid).once('value', s => res(s.val())); } catch (e) { res({ err: String(e) }); }
  }));
  console.log('presence:', JSON.stringify(pres).slice(0, 120));
  /* ctx2: ADMIN panel */
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pa = await ctxA.newPage();
  const errs = [];
  pa.on('pageerror', e => errs.push(String(e).slice(0, 120)));
  await pa.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await pa.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await pa.evaluate(([em, pw]) => window.auth.signInWithEmailAndPassword(em, pw), [cred.admin.email, cred.admin.password]);
  await pa.waitForTimeout(6000);
  /* Users section kholo */
  const clicked = await pa.evaluate(() => {
    var cands = Array.from(document.querySelectorAll('button,a,div[onclick],li,span')).filter(el => {
      var t = (el.textContent || '').trim();
      return t === 'Users' || t.indexOf('Users ') === 0 || /fa-users/.test(el.innerHTML || '');
    });
    var el = cands.find(x => (x.textContent || '').length < 30) || cands[0];
    if (el) { el.click(); return (el.textContent || '').trim().slice(0, 30); }
    return '';
  });
  console.log('users-tab click:', clicked);
  await pa.waitForTimeout(5000);
  const row = await pa.evaluate((uid) => {
    var tb = document.getElementById('usersTable');
    if (!tb) return { tb: false };
    var tr = Array.from(tb.querySelectorAll('tr')).find(r => (r.textContent || '').indexOf('TRIQA d102a') > -1);
    if (!tr) return { tb: true, row: false, rows: tb.querySelectorAll('tr').length };
    return { tb: true, row: true, html: tr.innerHTML, hasApp: tr.innerHTML.indexOf('\ud83d\udcf1 App') > -1, hasWeb: tr.innerHTML.indexOf('\ud83c\udf10 Web') > -1, hasOn: tr.innerHTML.indexOf('● Online') > -1, tail: tr.innerHTML.slice(-900), txt: (tr.textContent || '').replace(/\s+/g, ' ').slice(0, 260) };
  }, cred.player.uid);
  console.log('ROWTAIL:', (row.tail || '').replace(/></g, '>\n<').slice(-1200));
  console.log('MAPS:', await pa.evaluate(() => JSON.stringify({ app: Object.keys(window._appInstallMap || {}).length, pres: Object.keys(window._presenceMap || {}).length, supa: !!window._supa, rtdb: typeof rtdb })));
  const okApp = row.row && (row.hasApp || row.hasWeb);
  const okOn = row.row && row.hasOn;
  console.log('CHECK App-col:', okApp, '| Online-col:', okOn);
  await pa.screenshot({ path: OUT + '/05-admin-users-columns.png', fullPage: false });
  /* table area clip */
  const tbl = await pa.$('#usersTable');
  if (tbl) await tbl.screenshot({ path: OUT + '/06-admin-users-table.png' }).catch(() => {});
  console.log('pageerrors:', errs.slice(0, 3));
  await browser.close();
  process.exit(okApp && okOn ? 0 : 1);
})().catch(e => { console.error('CRASH:', e.message); process.exit(2); });
