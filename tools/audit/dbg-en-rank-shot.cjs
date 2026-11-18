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
  try { const sg = p.locator('button:has-text("Samajh")'); const c = await sg.count(); for (let i=0;i<c;i++){ const el=sg.nth(i); if (await el.isVisible()) { await el.click({timeout:2500, force:true}).catch(()=>{}); await p.waitForTimeout(600);} } } catch(e){}
  await p.evaluate(() => window.navTo('rank')); await p.waitForTimeout(4000);
  try { const sg2 = p.locator('button:has-text("Samajh")'); const c2 = await sg2.count(); for (let i=0;i<c2;i++){ const el=sg2.nth(i); if (await el.isVisible()) { await el.click({timeout:2500, force:true}).catch(()=>{}); await p.waitForTimeout(600);} } } catch(e){}
  await p.evaluate(() => { const sc = document.querySelector('.screen.active'); if (sc) sc.scrollTop = 900; });
  await p.waitForTimeout(800);
  await p.screenshot({ path: 'reports/ui-sweep/z29-en-rank.png' });
  console.log('EN-RANK-OK');
  await b.close();
})();
