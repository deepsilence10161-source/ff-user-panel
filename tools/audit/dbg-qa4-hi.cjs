const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('appLang','hi'); localStorage.setItem('tutorialSeen','1'); sessionStorage.setItem('vn_shown_this_launch','1'); } catch(e){} });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PE: ' + String(e).slice(0,140)));
  p.on('crash', () => errs.push('PAGE-CRASH'));
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa4.email, ACCT.qa4.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  for (const scr of ['home','matches','rank','wallet','profile','notif','special']) {
    await p.evaluate(s => window.navTo(s), scr);
    await p.waitForTimeout(2500);
  }
  await p.waitForTimeout(3000);
  console.log(JSON.stringify({ errs: errs.slice(0,8), alive: !p.isClosed() }));
  await b.close();
})();
