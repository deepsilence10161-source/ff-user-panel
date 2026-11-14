'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window._SUPA_URL = 'http://127.0.0.1:8091'; window._SUPA_ANON_KEY = 'mock'; localStorage.setItem('appLang', 'hi'); });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8092/_d103.html', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.qa2.email, ACCT.qa2.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(4000);
  for (let i = 0; i < 8; i++) await p.evaluate(() => { const bs = [...document.querySelectorAll('button')].filter(x => x.offsetParent); const t = x => (x.textContent || '').trim(); const c = bs.find(x => /Skip|Finish|Done|Let's Play|Khelo|Start/i.test(t(x)) && t(x).length < 24) || bs.find(x => /^Next/i.test(t(x))); if (c) c.click(); });
  await p.evaluate(() => window.navTo && window.navTo('profile'));
  await p.waitForTimeout(2000);
  const out = await p.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && (e.textContent || '').trim() === 'My Titles');
    if (!el) return 'no Matches leaf; TEXT: ' + (document.body.innerText || '').replace(/\n+/g, ' | ').slice(0, 300);
    let box = el;
    return 'TAG '+el.tagName+' cls='+el.className+' parent='+box.parentElement.className+' :: '+box.parentElement.outerHTML.slice(0,400);
  });
  console.log(out);
  await b.close();
})();
