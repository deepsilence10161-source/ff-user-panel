const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('appLang','en'); localStorage.setItem('tutorialSeen','1'); sessionStorage.setItem('vn_shown_this_launch','1'); } catch(e){} });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa1.email, ACCT.qa1.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  try { const sg = p.locator('button:has-text("Samajh gaya")'); if (await sg.count()) { await sg.first().click(); await p.waitForTimeout(800); } } catch (e) {}
  const out = {};
  for (const s of ['wallet','matches','rank','profile']) {
    await p.evaluate(sc => window.navTo(sc), s); await p.waitForTimeout(2400);
    out[s] = await p.evaluate(() => ((document.body.innerText || '').match(/[\u0900-\u097F]{3,}/g) || []).length);
  }
  console.log('EN-mode devanagari leaks:', JSON.stringify(out));
  await b.close();
})();
