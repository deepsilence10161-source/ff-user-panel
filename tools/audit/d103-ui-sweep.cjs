const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
const OUT = '/home/user/ff-user-panel/reports/ui-sweep/';
const SCREENS = ['home','matches','rank','wallet','profile','notif','special'];
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('appLang','en'); localStorage.setItem('_mes_lang_seen','1'); localStorage.setItem('tutorialSeen','1'); sessionStorage.setItem('vn_shown_this_launch','1'); } catch(e){} });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa1.email, ACCT.qa1.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  try { await p.waitForSelector('#_mes_tc1', { timeout: 6000 }); await p.check('#_mes_tc1'); await p.check('#_mes_tc2'); await p.click('button:has-text("Accept & Continue")'); await p.waitForTimeout(1500); } catch (e) {}
  try { const sg = p.locator('button:has-text("Samajh gaya")'); if (await sg.count()) { await sg.first().click(); await p.waitForTimeout(800); } } catch (e) {}
  const report = {};
  for (const s of SCREENS) {
    await p.evaluate(sc => window.navTo(sc), s);
    await p.waitForTimeout(3200);
    const bad = await p.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.complete && !i.naturalWidth && i.offsetParent).map(i => (i.src||'').split('/').slice(-1)[0]).slice(0,8));
    report[s] = { broken: bad };
    await p.screenshot({ path: OUT + 'scr-' + s + '.png' });
  }
  try {
    await p.evaluate(() => window.navTo('profile')); await p.waitForTimeout(1500);
    await p.evaluate(() => window.showCreatorDashboard && window.showCreatorDashboard());
    await p.waitForTimeout(3500);
    await p.screenshot({ path: OUT + 'modal-creator.png' });
    report.creator = { ok: true };
  } catch (e) { report.creator = { err: String(e).slice(0,120) }; }
  report.pageErrors = errs.slice(0, 12);
  fs.writeFileSync(OUT + 'report.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report).slice(0, 1200));
  await b.close();
})();
