const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('appLang','hi'); localStorage.removeItem('tutorialSeen'); sessionStorage.clear(); } catch(e){} });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa6.email, ACCT.qa6.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(3500);
  const dump = () => p.evaluate(() => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    const o = []; let n;
    while ((n = w.nextNode())) { const t = (n.nodeValue || '').trim(); if (t && t.length < 60 && /[A-Za-z]{3}/.test(t)) o.push(t); }
    return [...new Set(o)].slice(0, 50);
  });
  const steps = [];
  for (let i = 0; i < 4; i++) {
    steps.push(await dump());
    const adv = await p.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter(b => getComputedStyle(b).display !== 'none' && /next|agle|start|shuru|skip|chhodo|got it|samajh/i.test(b.textContent || ''));
      if (btns[0]) { btns[0].click(); return (btns[0].textContent || '').trim(); }
      return null;
    });
    if (!adv) break;
    await p.waitForTimeout(1500);
  }
  console.log(JSON.stringify({ steps: steps.length, last: steps[steps.length - 1] }));
  await b.close();
})();
