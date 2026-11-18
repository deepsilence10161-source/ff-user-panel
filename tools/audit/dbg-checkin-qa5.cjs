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
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa5.email, ACCT.qa5.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  try { const sg = p.locator('button:has-text("Samajh gaya")'); if (await sg.count()) { await sg.first().click(); await p.waitForTimeout(800); } } catch (e) {}
  await p.evaluate(() => window.doCheckIn && window.doCheckIn());
  await p.waitForTimeout(4000);
  const d = await p.evaluate(() => {
    const scr = document.getElementById('modalB') || document.body;
    const w = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT, null);
    const o = []; let n;
    while ((n = w.nextNode())) { const t = (n.nodeValue || '').trim(); if (t && t.length < 46 && /[A-Za-z]{3}/.test(t)) o.push(t); }
    return { title: ((document.getElementById('modalT')||{}).textContent||'').trim(), nodes: [...new Set(o)].slice(0,20) };
  });
  console.log(JSON.stringify(d, null, 0));
  await b.close();
})();
