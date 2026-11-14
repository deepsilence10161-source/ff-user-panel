'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { localStorage.setItem('appLang', 'en'); localStorage.setItem('_mes_lang_seen', '1'); });
  const p = await ctx.newPage();
  p.on('response', async r => { if (r.status() >= 400 && r.url().includes('supabase.co')) { let t = ''; try { t = (await r.text()).slice(0, 160); } catch (e) {} console.log('BAD', r.status(), r.request().method(), r.url().slice(45, 150), '=>', t, 'POST=', (r.request().postData() || '').slice(0, 140)); } });
  await p.goto(process.env.BASE || 'https://deepsilence10161-source.github.io/ff-user-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.qa2.email, ACCT.qa2.password]);
  await p.waitForTimeout(9000);
  await b.close();
})();
