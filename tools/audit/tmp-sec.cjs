'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth || window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.adm1.email, ACCT.adm1.password]);
  await p.waitForTimeout(5000);
  for (let i = 0; i < 3; i++) {
    const done = await p.evaluate((mail) => {
      const inp = [...document.querySelectorAll('input')].find(x => x.offsetParent && /admin email/i.test(x.placeholder || ''));
      const btn = [...document.querySelectorAll('button')].find(bb => bb.offsetParent && /Trust This Device/i.test(bb.textContent || ''));
      if (btn) { if (inp) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(inp, mail); inp.dispatchEvent(new Event('input', { bubbles: true })); } btn.click(); return 1; }
      const acc = [...document.querySelectorAll('button,a')].find(bb => bb.offsetParent && /Access Admin Panel/i.test(bb.textContent || ''));
      if (acc) { acc.click(); return 2; } return 0;
    }, ACCT.adm1.email);
    if (!done) break; await p.waitForTimeout(1500);
  }
  await p.waitForTimeout(3000);
  const st = () => p.evaluate(() => { const sec = [...document.querySelectorAll('.section')].find(x => x.classList.contains('active')); return sec ? { id: sec.id, title: ((sec.querySelector('.section-title') || {}).textContent || '').trim().slice(0, 40) } : null; });
  console.log('ACTIVE-0', JSON.stringify(await st()));
  const r = await p.evaluate(() => { const el = [...document.querySelectorAll('.nav-item')].find(e => (e.textContent || '').trim().startsWith('Users')); if (!el) return 'no-el'; el.click(); return 'clicked:' + el.outerHTML.slice(0, 80); });
  console.log('CLICK', r);
  await p.waitForTimeout(2500);
  console.log('ACTIVE-1', JSON.stringify(await st()));
  const sw = await p.evaluate(l => { const sec = [...document.querySelectorAll('.section')].find(x => x.classList.contains('active')); if (!sec) return 'no-sec'; const t = ((sec.querySelector('.section-title') || {}).textContent || sec.innerText || '').replace(/\s+/g, ' '); return JSON.stringify({ l, inc: t.includes(l), t: t.slice(0, 40) }); }, 'Users');
  console.log('SWITCH-CHECK', sw);
  const r2 = await p.evaluate(() => typeof window.showSection);
  console.log('showSection type:', r2);
  await b.close();
})();
