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
  await p.waitForTimeout(4000);
  const dump = () => p.evaluate(() => {
    const scr = document.getElementById('scrHome') || document.body;
    const w = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT, null);
    const out = []; let n;
    while ((n = w.nextNode())) { const t = (n.nodeValue || '').trim(); if (t && t.length < 46 && /[A-Za-z]{3}/.test(t)) out.push(t); }
    return [...new Set(out)].slice(0, 40);
  });
  const before = await dump();
  const rev = await p.evaluate(() => window._i18nFixRev);
  await p.evaluate(() => { window._i18nApplyRaw && window._i18nApplyRaw(); });
  await p.waitForTimeout(600);
  const after = await dump();
  await p.waitForTimeout(3000);
  const later = await dump();
  console.log(JSON.stringify({ rev, before: before.length, after: after.length, later: later.length, afterSample: after.slice(0,8) }));
  await b.close();
})();
