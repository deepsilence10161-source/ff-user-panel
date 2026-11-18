const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
const OUT = '/home/user/ff-user-panel/reports/ui-sweep/';
const MODALS = [];
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
  for (const fn of MODALS) {
    const has = await p.evaluate(f => typeof window[f] === 'function', fn);
    if (!has) { report[fn] = 'missing'; continue; }
    try {
      await p.evaluate(f => window[f](), fn);
      await p.waitForTimeout(2200);
      const bad = await p.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.complete && !i.naturalWidth && i.offsetParent).map(i => (i.src||'').split('/').slice(-1)[0]).slice(0,6));
      report[fn] = { broken: bad };
      await p.screenshot({ path: OUT + 'mod-' + fn + '.png' });
    } catch (e) { report[fn] = { err: String(e).slice(0,100) }; }
    await p.evaluate(() => { try { window.closeModal && window.closeModal(); } catch(e){} });
    await p.waitForTimeout(600);
    await p.evaluate(() => { const ov=[...document.querySelectorAll('body > div')].filter(d=>{const s=getComputedStyle(d);return s.position==='fixed'&&parseInt(s.zIndex||'0')>=900&&d.offsetHeight>200;}); ov.forEach(d=>d.remove()); });
    await p.waitForTimeout(400);
  }
  // match detail via View Only
  try {
    await p.evaluate(() => window.navTo('home')); await p.waitForTimeout(2500);
    const n = await p.evaluate(() => { const el = [...document.querySelectorAll('[onclick^="showDet("]')][0]; if (el) { el.click(); return 1; } return 0; });
    if (n) { await p.waitForTimeout(3200); await p.screenshot({ path: OUT + 'mod-matchdetail.png' }); report.matchDetail = { ok: true }; }
    else report.matchDetail = 'no showDet element';
  } catch (e) { report.matchDetail = { err: String(e).slice(0,100) }; }
  report.pageErrors = errs.slice(0, 10);
  fs.writeFileSync(OUT + 'report2.json', JSON.stringify(report, null, 1));
  console.log(JSON.stringify(report).slice(0, 1600));
  await b.close();
})();
