/* D103 round-4: ADMIN PANEL SWEEP — live admin (github.io) par Supabase requests ko
   Playwright route-se local mock (127.0.0.1:8091) par fulfill karta hai (sandbox egress blocked).
   Checks: boot login → device-modal dismiss → har sidebar tab: pageerrors, NaN/undefined leaks,
   broken images, table render, D102 App/Online columns + 📱/● render. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
const OUT = '/home/user/ff-user-panel/reports/d103-admin';
fs.mkdirSync(OUT, { recursive: true });
const findings = [];
const add = (k, d) => findings.push({ kind: k, detail: String(d).slice(0, 200) });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  /* Supabase → local mock (node-side fetch, CORS fulfill) */
  const LIVE = process.env.LIVE === '1';
  if (!LIVE) await ctx.route(u => String(u).includes('supabase.co'), async route => {
    const req = route.request();
    if (process.env.RLOG) console.log('ROUTE', req.method(), req.url().slice(0, 90));
    const url = req.url().replace(/https:\/\/[^/]*\.supabase\.co/, 'http://127.0.0.1:8091');
    try {
      const h0 = req.headers();
      const h = {};
      ['apikey', 'authorization', 'content-type', 'prefer', 'accept'].forEach(k => { if (h0[k]) h[k] = h0[k]; });
      const r = await fetch(url, { method: req.method(), headers: h, body: req.postData() || undefined });
      const body = await r.text();
      await route.fulfill({ status: r.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body });
    } catch (e) { await route.fulfill({ status: 500, body: '{"message":"mock-route-fail"}', headers: { 'Access-Control-Allow-Origin': '*' } }); }
  });
  const ADMIN_EMAIL = ACCT.adm1.email;
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message).slice(0, 150)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 130)); });
  await page.goto(process.env.ADMIN_BASE || 'https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.auth || window.firebase, null, { timeout: 30000 });
  await page.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.adm1.email, ACCT.adm1.password]);
  await page.waitForTimeout(4000);
  /* New Device Detected modal dismiss */
  for (let i = 0; i < 3; i++) {
    const done = await page.evaluate((ADMIN_EMAIL) => {
      const inp = [...document.querySelectorAll('input')].find(x => x.offsetParent && /admin email/i.test(x.placeholder || ''));
      const btn = [...document.querySelectorAll('button')].find(b => b.offsetParent && /Trust This Device/i.test(b.textContent || ''));
      if (btn) { if (inp) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(inp, ADMIN_EMAIL); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); } btn.click(); return 1; }
      const acc = [...document.querySelectorAll('button,a')].find(b => b.offsetParent && /Access Admin Panel/i.test(b.textContent || ''));
      if (acc) { acc.click(); return 2; }
      return 0;
    }, ACCT.adm1.email);
    if (!done) break;
    await page.waitForTimeout(1200);
  }
  await page.waitForTimeout(2500);
  /* gate retry (flaky network call ek baar fail ho to dobara try) */
  for (let g = 0; g < 5; g++) {
    const denied = await page.evaluate(() => /Not an admin account/i.test(document.body.innerText || ''));
    if (!denied) break;
    await page.evaluate(() => { const b2 = [...document.querySelectorAll('button,a')].find(x => x.offsetParent && /Access Admin Panel/i.test(x.textContent || '')); if (b2) b2.click(); });
    await page.waitForTimeout(2500);
  }
  const booted = await page.evaluate(() => !/Not an admin account/i.test(document.body.innerText || '') && (document.getElementById('mainApp') ? getComputedStyle(document.getElementById('mainApp')).display !== 'none' : (document.body.innerText || '').length > 200));
  if (!booted) { add('flow-fail', 'admin boot hi nahi hua'); }
  /* sidebar tabs collect */
  const tabs = await page.evaluate(() => [...document.querySelectorAll('a,button,[onclick],[role=tab],.tab')]
    .filter(t => t.offsetParent).map(t => (t.textContent || '').trim()).filter(t => t && t.length < 26 && /Users|Matches|Dashboard|Payments|Wallet|Notif|Settings|Support|Requests|Analytics|Creators|Clans|Bans|Logs|Tickets|Withdraw/i.test(t)));
  console.log('TABS:', tabs.slice(0, 24).join(' | '));
  const seen = new Set();
  for (const label of tabs.slice(0, 18)) {
    if (seen.has(label)) continue; seen.add(label);
    const clicked = await page.evaluate(l => {
      const el = [...document.querySelectorAll('a,button,[onclick],[role=tab],.tab')].find(t => t.offsetParent && (t.textContent || '').trim() === l);
      if (el) { el.click(); return 1; } return 0;
    }, label);
    if (!clicked) continue;
    await page.waitForTimeout(2000);
    const rep = await page.evaluate(() => {
      const vis = el => !!(el && el.offsetParent !== null);
      const imgs = [...document.images].filter(vis).map(i => ({ s: i.getAttribute('src') || '', ok: i.complete && i.naturalWidth > 0 }));
      const bad = imgs.filter(i => i.s && !i.ok && !i.s.startsWith('data:'));
      const txt = document.body.innerText || '';
      const leaks = (txt.match(/\bNaN\b|\bundefined\b|\[object Object\]/g) || []).length;
      const rows = document.querySelectorAll('table tbody tr, .table-wrapper tr').length;
      return { bad: bad.slice(0, 6), leaks, rows };
    });
    rep.bad.forEach(b => add('img-fail', label + ' :: ' + b.s));
    if (rep.leaks > 0) add('text-leak', label + ' :: ' + rep.leaks + ' leaks');
    await page.screenshot({ path: path.join(OUT, 'tab-' + label.replace(/[^a-z0-9]+/gi, '_').slice(0, 18) + '.png'), fullPage: false });
    console.log('tab', label, 'rows=' + rep.rows, 'leaks=' + rep.leaks, 'badimg=' + rep.bad.length);
  }
  /* D102 columns verify on users tab */
  const usersTab = await page.evaluate(() => {
    const el = [...document.querySelectorAll('a,button,[onclick],[role=tab],.tab')].find(t => t.offsetParent && /Users/i.test(t.textContent || ''));
    if (el) { el.click(); return 1; } return 0;
  });
  await page.waitForTimeout(2500);
  const cols = await page.evaluate(() => {
    const ths = [...document.querySelectorAll('th')].map(t => (t.textContent || '').trim());
    const body = document.body.innerText || '';
    return { hasApp: ths.some(t => /APP/i.test(t)), hasOnline: ths.some(t => /ONLINE/i.test(t)), appBadge: /📱/.test(body), onlineDot: /●\s*Online/i.test(body), webBadge: /🌐/.test(body) };
  });
  console.log('D102 COLS:', JSON.stringify(cols));
  if (usersTab) await page.screenshot({ path: path.join(OUT, 'users-columns.png') });
  if (!cols.hasApp || !cols.hasOnline) add('d102-cols', 'App/Online headers missing: ' + JSON.stringify(cols));
  const NOISE = LIVE
    ? /FCM|Notification permission|messaging|sw.js|realtime|websocket|favicon|ResizeObserver/i
    : /FCM|Notification|messaging|sw.js|realtime|websocket|favicon|row-level security|401 \(Unauthorized\)|403 \(Forbidden\)|Edge Function|app_settings/i;
  errs.filter(e => !NOISE.test(e)).slice(0, 8).forEach(e => add('pageerror', e));
  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 1));
  console.log('ADMIN SWEEP FINDINGS:', findings.length);
  findings.slice(0, 14).forEach(f => console.log(' -', f.kind, '|', f.detail));
  await browser.close();
})();
