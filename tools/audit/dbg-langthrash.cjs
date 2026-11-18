const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('appLang','hi'); localStorage.setItem('tutorialSeen','1'); sessionStorage.setItem('vn_shown_this_launch','1'); } catch(e){} });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa1.email, ACCT.qa1.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  try { const sg = p.locator('button:has-text("Samajh gaya")'); if (await sg.count()) { await sg.first().click(); await p.waitForTimeout(800); } } catch (e) {}
  const devCount = () => p.evaluate(() => {
    const scr = document.getElementById('scrWallet') || document.body;
    const w = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT, null);
    let c = 0; let n;
    while ((n = w.nextNode())) { const t = (n.nodeValue || '').trim(); if (t && /[\u0900-\u097F]/.test(t)) c++; }
    return c;
  });
  await p.evaluate(() => window.navTo('wallet')); await p.waitForTimeout(3500);
  const hi1 = await devCount();
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => window.setLanguage && window.setLanguage('en')); await p.waitForTimeout(1500);
    await p.evaluate(() => window.setLanguage && window.setLanguage('hi')); await p.waitForTimeout(1500);
  }
  const hi2 = await devCount();
  await p.evaluate(() => window.setLanguage && window.setLanguage('en')); await p.waitForTimeout(2500);
  const enDev = await devCount();
  await p.evaluate(() => window.setLanguage && window.setLanguage('hi')); await p.waitForTimeout(2500);
  const hi3 = await devCount();
  console.log(JSON.stringify({ hi1, hi2, enDev, hi3 }));
  await b.close();
})();
