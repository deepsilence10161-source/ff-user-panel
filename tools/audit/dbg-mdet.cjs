const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('appLang','hi'); localStorage.setItem('tutorialSeen','1'); } catch(e){} });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa2.email, ACCT.qa2.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(3000);
  const dismiss = async () => { try { const sg = p.locator('button:has-text("Samajh")'); const c = await sg.count(); for (let i=0;i<c;i++){ const el=sg.nth(i); if (await el.isVisible()) { await el.click({timeout:2500, force:true}).catch(()=>{}); await p.waitForTimeout(600);} } } catch(e){} };
  await dismiss();
  await p.evaluate(() => window.navTo('matches')); await p.waitForTimeout(3500); await dismiss();
  const info = await p.evaluate(() => {
    const det = [...document.querySelectorAll('[onclick*="showDet"]')];
    const res = [...document.querySelectorAll('[onclick*="showResultPage"]')];
    return { det: det.length, res: res.length, scr: (document.querySelector('.screen.active')||{}).id || null };
  });
  if (info.det) { await p.evaluate(() => { const el = document.querySelector('[onclick*="showDet"]'); if (el) el.click(); }); await p.waitForTimeout(2200); await dismiss(); }
  else if (info.res) { await p.evaluate(() => { const m = (document.querySelector('[onclick*="showResultPage"]').getAttribute('onclick').match(/showResultPage\('([^']+)'/)||[])[1]; if (m && window.showResultPage) window.showResultPage(m); }); await p.waitForTimeout(2500); await dismiss(); }
  await p.screenshot({ path: 'reports/ui-sweep/z30-hi-matchdet.png' });
  console.log(JSON.stringify(info));
  await b.close();
})();
