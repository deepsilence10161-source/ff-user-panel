'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => {
    const of = window.fetch;
    window.fetch = async function (...a) {
      const r = await of.apply(this, a);
      try {
        const u = String(a[0] && a[0].url ? a[0].url : a[0]);
        if (u.includes('supabase.co') && /admins|users\?/.test(u)) {
          const c = r.clone(); const t = await c.text();
          console.log('FETCHLOG ' + r.status + ' ' + u.slice(0, 110) + ' => ' + t.slice(0, 140));
        }
      } catch (e) {}
      return r;
    };
  });
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
  p.on('console', m => { const t = m.text(); if (t.startsWith('FETCHLOG')) console.log(t); });
  await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth || window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.adm1.email, ACCT.adm1.password]);
  await p.waitForTimeout(7000);
  await b.close();
})();
