'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  for (const lang of ['hi', 'en']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await ctx.addInitScript(l => { localStorage.setItem('appLang', l); localStorage.setItem('_mes_lang_seen', '1'); }, lang);
    const p = await ctx.newPage();
    await p.goto('http://127.0.0.1:8092/_d103.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
    await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.qa1.email, ACCT.qa1.password]);
    await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
    await p.waitForTimeout(2500);
    for (let i = 0; i < 5; i++) { const d = await p.evaluate(() => { const bt = [...document.querySelectorAll('button,[onclick]')].find(x => x.offsetParent && /Abhi nahi|Skip|Close|✕|×/.test((x.textContent || '').trim()) && (x.textContent || '').trim().length < 22); if (bt) { bt.click(); return 1; } return 0; }); if (!d) break; await p.waitForTimeout(700); }
    await p.evaluate(() => window.navTo('notif'));
    await p.waitForTimeout(3000);
    const txt = await p.evaluate(() => document.body.innerText || '');
    console.log(lang, 'match-notif:', /Match Result/.test(txt), 'support-notif:', /Support Reply/.test(txt));
    await p.screenshot({ path: '/home/user/ff-user-panel/reports/d103-sweep-live-fixverify/_notif-live-' + lang + '.png' });
    await ctx.close();
  }
  await b.close();
})();
