const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const times = [];
  for (let i = 0; i < 3; i++) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('appLang','en'); localStorage.setItem('tutorialSeen','1'); sessionStorage.setItem('vn_shown_this_launch','1'); } catch(e){} });
    const p = await ctx.newPage();
    const t0 = Date.now();
    await p.goto('http://127.0.0.1:8092/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
    await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa1.email, ACCT.qa1.password]);
    await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
    times.push(Date.now() - t0);
    await ctx.close();
  }
  console.log('boot-ms(run: login+app-ready):', JSON.stringify(times), 'avg=', Math.round(times.reduce((a,c)=>a+c,0)/3));
  await b.close();
})();
