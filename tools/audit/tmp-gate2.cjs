'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
  await ctx.route(u => String(u).includes('supabase.co'), async route => {
    const req = route.request();
    const url = req.url().replace(/https:\/\/[^/]*\.supabase\.co/, 'http://127.0.0.1:8091');
    const h0 = req.headers(); const h = {};
    ['apikey', 'authorization', 'content-type', 'prefer', 'accept'].forEach(k => { if (h0[k]) h[k] = h0[k]; });
    if (process.env.RLOG) console.log('ROUTE', req.method(), JSON.stringify(req.url().slice(0, 45)), req.url().slice(40, 200), 'accept=', h0.accept || '-');
    try { const r = await fetch(url, { method: req.method(), headers: h, body: req.postData() || undefined });
      const body = await r.text();
      if (process.env.RLOG && /admins/.test(req.url())) console.log('   ->', r.status, 'URL=' + url, 'body=' + body.slice(0, 120));
      await route.fulfill({ status: r.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body });
    } catch (e) { if (process.env.RLOG) console.log('   -> FAIL', e.message); await route.fulfill({ status: 599, body: '{}', headers: { 'Access-Control-Allow-Origin': '*' } }); }
  });
  const p = await ctx.newPage();
  p.on('console', m => { const t = m.text(); if (/Auth|admin check|Supabase admin/i.test(t)) console.log('C:', t.slice(0, 120)); });
  await p.goto('http://127.0.0.1:8093/_d103admin.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth || window.firebase, null, { timeout: 30000 });
  await p.waitForTimeout(1500);
  const pre = await p.evaluate(() => ({ supa: !!window._supa, url: window.SUPABASE_URL || window._SUPA_URL || '-' }));
  console.log('PRE:', JSON.stringify(pre));
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.adm1.email, ACCT.adm1.password]);
  await p.waitForTimeout(6000);
  const res = await p.evaluate(async (uid) => {
    if (!window._supa) return 'no _supa';
    const r = await window._supa.from('admins').select('uid,is_active,role').eq('uid', uid).maybeSingle();
    return JSON.stringify({ status: r.status, err: r.error, data: r.data });
  }, ACCT.adm1.uid);
  console.log('GATE-QUERY:', res);
  await p.waitForTimeout(4000);
  console.log('BODY:', (await p.evaluate(() => (document.body.innerText || '').slice(0, 260))).replace(/\n/g, ' | '));
  await p.screenshot({ path: '/home/user/ff-user-panel/reports/d103-admin/after-gate.png' });
  await b.close();
})();
