'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(u => String(u).includes('supabase.co'), async route => {
    const req = route.request();
    const url = req.url().replace('https://hddhkculuyrfoevmlwy.supabase.co', 'http://127.0.0.1:8091');
    const h0 = req.headers(); const h = {};
    ['apikey', 'authorization', 'content-type', 'prefer', 'accept'].forEach(k => { if (h0[k]) h[k] = h0[k]; });
    try { const r = await fetch(url, { method: req.method(), headers: h, body: req.postData() || undefined });
      await route.fulfill({ status: r.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: await r.text() });
    } catch (e) { await route.fulfill({ status: 599, body: '{}', headers: { 'Access-Control-Allow-Origin': '*' } }); }
  });
  const p = await ctx.newPage();
  p.on('console', m => { const t = m.text(); if (/RLS|row-level|401|403|denied|Denied|admin/i.test(t)) console.log('C:', t.slice(0, 110)); });
  await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth || window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.adm1.email, ACCT.adm1.password]);
  await p.waitForTimeout(4500);
  for (let i = 0; i < 4; i++) {
    const st = await p.evaluate((em) => {
      const vis = e => e && e.offsetParent;
      const inp = [...document.querySelectorAll('input')].find(x => vis(x) && /admin email/i.test(x.placeholder || ''));
      const trust = [...document.querySelectorAll('button')].find(x => vis(x) && /Trust This Device/i.test(x.textContent || ''));
      if (trust) { if (inp) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(inp, em); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); } trust.click(); return 'trust'; }
      const acc = [...document.querySelectorAll('button,a')].find(x => vis(x) && /Access Admin Panel/i.test(x.textContent || ''));
      if (acc) { acc.click(); return 'access'; }
      return 'none:' + (document.body.innerText || '').slice(0, 80).replace(/\n/g, ' ');
    }, ACCT.adm1.email);
    console.log('step' + i, st);
    await p.waitForTimeout(1500);
  }
  await p.waitForTimeout(2500);
  console.log('BODY:', (await p.evaluate(() => (document.body.innerText || '').slice(0, 300))).replace(/\n/g, ' | '));
  await p.screenshot({ path: '/home/user/ff-user-panel/reports/d103-admin/boot2.png' });
  await b.close();
})();
