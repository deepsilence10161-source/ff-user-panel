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
  try { await p.waitForSelector('#_mes_tc1', { timeout: 6000 }); await p.check('#_mes_tc1'); await p.check('#_mes_tc2'); await p.click('button:has-text("Accept")'); await p.waitForTimeout(1200); } catch (e) {}
  await p.evaluate(() => window.navTo('rank')); await p.waitForTimeout(4000);
  const r = await p.evaluate(() => { const t = document.body.innerText || ''; const d = t.match(/[\u0900-\u097F]{3,}/g) || []; return { n: d.length, sample: d.slice(0, 12), lang: document.documentElement.lang }; });
  console.log(JSON.stringify(r));
  await p.screenshot({ path: '/home/user/ff-user-panel/reports/ui-sweep/scr-hindi-rank.png' });
  await b.close();
})();
