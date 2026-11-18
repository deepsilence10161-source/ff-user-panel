'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
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
  await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth || window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.adm1.email, ACCT.adm1.password]);
  await p.waitForTimeout(5000);
  for (let i = 0; i < 3; i++) {
    const done = await p.evaluate(() => {
      const inp = [...document.querySelectorAll('input')].find(x => x.offsetParent && /email/i.test(x.placeholder || ''));
      const btn = [...document.querySelectorAll('button')].find(b2 => b2.offsetParent && /Trust This Device|Trust/i.test(b2.textContent || ''));
      if (btn) { if (inp && !inp.value) inp.value = 'qa-d103@sweep.local'; btn.click(); return 1; } return 0;
    });
    if (!done) break; await p.waitForTimeout(1000);
  }
  await p.waitForTimeout(2000);
  const nav = await p.evaluate(() => {
    const cands = [...document.querySelectorAll('a,button,[onclick],[role=tab],.tab,[class*=menu] *,[class*=nav] *')].filter(e => e.offsetParent && (e.textContent || '').trim().length > 2 && (e.textContent || '').trim().length < 26 && e.children.length <= 2);
    return [...new Set(cands.map(e => (e.textContent || '').trim()))].slice(0, 40);
  });
  console.log('NAV:', JSON.stringify(nav));
  await p.screenshot({ path: '/home/user/ff-user-panel/reports/d103-admin/boot.png' });
  await b.close();
})();
