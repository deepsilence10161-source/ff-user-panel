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
  await p.waitForTimeout(3000);
  const r = await p.evaluate(() => {
    const btn = document.querySelector('#scrHome .mc-join');
    if (!btn) return { err: 'nobtn' };
    btn.click();
    return { ok: 1 };
  });
  await p.waitForTimeout(4000);
  const d = await p.evaluate(() => {
    const ov = document.getElementById('modalOv');
    const ovVis = ov ? getComputedStyle(ov).display !== 'none' : false;
    const scr = ovVis ? (document.getElementById('modalB') || document.body) : ([...document.querySelectorAll('.screen')].find(s => getComputedStyle(s).display !== 'none') || document.body);
    const w = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT, null);
    const o = []; let n;
    while ((n = w.nextNode())) { const t = (n.nodeValue || '').trim(); if (t && t.length < 46 && /[A-Za-z]{3}/.test(t)) o.push(t); }
    return { ovVis, title: ((document.getElementById('modalT')||{}).textContent||'').trim().slice(0,40), nodes: [...new Set(o)].slice(0, 40) };
  });
  console.log(JSON.stringify({ r, d }));
  await b.close();
})();
