const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.route(u => String(u).includes('supabase.co'), async route => {
    const req = route.request();
    const url = req.url().replace(/https:\/\/[^/]*\.supabase\.co/, 'http://127.0.0.1:8091');
    try {
      const h0 = req.headers(); const h = {};
      ['apikey','authorization','content-type','prefer','accept'].forEach(k => { if (h0[k]) h[k] = h0[k]; });
      const r = await fetch(url, { method: req.method(), headers: h, body: req.postData() || undefined });
      const body = await r.text();
      await route.fulfill({ status: r.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' }, body });
    } catch (e) { await route.fulfill({ status: 500, body: '{"message":"mock-route-fail"}', headers: { 'Access-Control-Allow-Origin': '*' } }); }
  });
  await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(3500);
  try { const em = p.locator('input[type=email]').first(); if (await em.count()) { await em.fill(ACCT.adm1.email); await p.locator('input[type=password]').first().fill(ACCT.adm1.password); await p.locator('button[type=submit], button:has-text("Login"), button:has-text("Sign")').first().click(); await p.waitForTimeout(3000); } } catch (e) {}
  try { const t = p.locator('button:has-text("Trust")'); if (await t.count()) { await t.first().click(); await p.waitForTimeout(1500); } } catch (e) {}
  await p.evaluate(() => { const el = [...document.querySelectorAll('.nav-item,[onclick*=analytics]')].find(x => /Analytics/i.test(x.textContent || '')); if (el) el.click(); });
  await p.waitForTimeout(4000);
  const out = await p.evaluate(() => {
    const txt = document.body.innerText || '';
    const res = [];
    const re = /\bNaN\b|\bundefined\b|\[object Object\]/g; let m;
    while ((m = re.exec(txt))) res.push(txt.slice(Math.max(0, m.index - 70), m.index + 40).replace(/\n/g, ' | '));
    return res.slice(0, 6);
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
