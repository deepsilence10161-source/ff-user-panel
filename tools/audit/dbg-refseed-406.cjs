const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('appLang','hi'); localStorage.setItem('tutorialSeen','1'); sessionStorage.setItem('vn_shown_this_launch','1'); window._SUPA_URL = 'http://127.0.0.1:8091'; window._SUPA_ANON_KEY = 'mock-anon-key'; } catch(e){} });
  const p = await ctx.newPage();
  const bad = [];
  await p.route(u => String(u).includes('supabase.co') || String(u).includes('127.0.0.1:8091'), async route => {
    const req = route.request();
    const url = req.url().replace(/https:\/\/[^/]*\.supabase\.co/, 'http://127.0.0.1:8091');
    try {
      const h0 = req.headers(); const h = {};
      ['apikey','authorization','content-type','prefer','accept'].forEach(k => { if (h0[k]) h[k] = h0[k]; });
      const r = await fetch(url, { method: req.method(), headers: h, body: req.postData() || undefined });
      const body = await r.text();
      if (r.status >= 400) bad.push(r.status + ' ' + req.method() + ' ' + url.slice(21, 130));
      await route.fulfill({ status: r.status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body });
    } catch (e) { await route.fulfill({ status: 500, body: '{}', headers: { 'Access-Control-Allow-Origin': '*' } }); }
  });
  await p.goto('http://127.0.0.1:8092/_d103.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.refseed.email, ACCT.refseed.password]);
  await p.waitForTimeout(9000);
  for (const sc of ['home','rank','matches','wallet','profile','notif','special']) {
    await p.evaluate(s => window.navTo && window.navTo(s), sc);
    await p.waitForTimeout(2600);
  }
  console.log(JSON.stringify(bad.slice(0, 8), null, 1));
  await b.close();
})();
