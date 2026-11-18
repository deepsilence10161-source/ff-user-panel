const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
const OUT = '/home/user/ff-user-panel/reports/ui-sweep/';
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('appLang','hi'); localStorage.setItem('_mes_lang_seen','1'); localStorage.setItem('tutorialSeen','1'); sessionStorage.setItem('vn_shown_this_launch','1'); } catch(e){} });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0,140)));
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa1.email, ACCT.qa1.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  try { await p.waitForSelector('#_mes_tc1', { timeout: 6000 }); await p.check('#_mes_tc1'); await p.check('#_mes_tc2'); await p.click('button:has-text("Accept")'); await p.waitForTimeout(1200); } catch (e) {}
  try { const sg = p.locator('button:has-text("Samajh gaya"), button:has-text("समझ")'); if (await sg.count()) { await sg.first().click(); await p.waitForTimeout(800); } } catch (e) {}
  const hindi = await p.evaluate(() => {
    const txt = (document.body.innerText || '');
    const dev = txt.match(/[\u0900-\u097F]{4,}/g) || [];
    return { devCount: dev.length, sample: dev.slice(0, 8) };
  });
  await p.screenshot({ path: OUT + 'scr-hindi-home.png' });
  // join sheet (en wapas)
  await p.evaluate(() => { try { localStorage.setItem('appLang','en'); } catch(e){} });
  const joined = await p.evaluate(() => { const el = [...document.querySelectorAll('[onclick^="cJoin("]')].find(x => !x.disabled); if (el) { el.click(); return el.getAttribute('onclick'); } return null; });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: OUT + 'mod-joinsheet.png' });
  console.log(JSON.stringify({ hindi, joined, errs: errs.slice(0,6) }));
  await b.close();
})();
