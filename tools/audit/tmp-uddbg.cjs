'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window._SUPA_URL = 'http://127.0.0.1:8091'; window._SUPA_ANON_KEY = 'mock'; });
  const p = await ctx.newPage();
  p.on('console', m => { const t = m.text(); if (/mock|supa|users\?/i.test(t)) console.log('C:', t.slice(0, 140)); });
  await p.goto('http://127.0.0.1:8092/_d103.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.qa2.email, ACCT.qa2.password]);
  await p.waitForFunction(() => window.U && window.UD, null, { timeout: 30000 });
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => ({ keys: Object.keys(window.UD || {}).slice(0, 40), stats: window.UD && window.UD.stats, level: window.UD && window.UD.level, prem: window.UD && (window.UD.premium_level ?? window.UD.premiumLevel), rp: window.UD && (window.UD.rank_points ?? window.UD.rp) }));
  console.log(JSON.stringify(r).slice(0, 1200));
  await b.close();
})();
