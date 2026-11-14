'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const seen = [];
  ctx.on('request', r => { if (/supabase|workers|firebase/.test(r.url())) seen.push(r.method() + ' ' + r.url().slice(0, 110)); });
  ctx.on('response', r => { if (/supabase/.test(r.url())) seen.push('  -> ' + r.status() + ' ' + r.url().slice(0, 100)); });
  await ctx.route('**hddhkculuyrfoevmlwy.supabase.co/**', async route => {
    const req = route.request();
    const url = req.url().replace('https://hddhkculuyrfoevmlwy.supabase.co', 'http://127.0.0.1:8091');
    const h0 = req.headers(); const h = {};
    ['apikey', 'authorization', 'content-type', 'prefer', 'accept'].forEach(k => { if (h0[k]) h[k] = h0[k]; });
    try {
      const r = await fetch(url, { method: req.method(), headers: h, body: req.postData() || undefined });
      const body = await r.text();
      seen.push('  MOCK ' + r.status + ' ' + req.url().slice(8, 90));
      await route.fulfill({ status: r.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body });
    } catch (e) { seen.push('  MOCKFAIL ' + e.message); await route.fulfill({ status: 500, body: '{}', headers: { 'Access-Control-Allow-Origin': '*' } }); }
  });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth || window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.adm1.email, ACCT.adm1.password]);
  await p.waitForTimeout(8000);
  console.log(seen.slice(0, 40).join('\n'));
  await b.close();
})();
