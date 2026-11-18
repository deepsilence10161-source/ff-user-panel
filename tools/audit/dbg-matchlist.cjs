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
  await p.evaluate(() => window.navTo('matches')); await p.waitForTimeout(5000);
  const info = await p.evaluate(() => {
    const scr = document.getElementById('scrMatches');
    const cls = {};
    scr.querySelectorAll('*').forEach(el => { (el.className||'').toString().split(/\s+/).forEach(c => { if (c) cls[c] = (cls[c]||0)+1; }); });
    return { len: (scr.innerHTML||'').length, top: Object.entries(cls).sort((a,b)=>b[1]-a[1]).slice(0,12), cards: scr.querySelectorAll('.mm-card').length };
  });
  console.log(JSON.stringify(info));
  await b.close();
})();
