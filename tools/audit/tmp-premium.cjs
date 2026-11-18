'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { localStorage.setItem('appLang', 'hi'); localStorage.setItem('_mes_lang_seen', '1'); });
  const p = await ctx.newPage();
  await p.goto('http://127.0.0.1:8092/_d103.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.qa2.email, ACCT.qa2.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  for (let i = 0; i < 14; i++) {

    const d = await p.evaluate(() => {
      if (window._tutDone) { try { window._tutDone(); return 'tut'; } catch (e) {} }
      const cand = [...document.querySelectorAll('*')].filter(e => e.offsetParent && e.children.length === 0 && /^[✕×x]$/.test((e.textContent || '').trim()));
      const dateInp = [...document.querySelectorAll('input[type=date]')].find(x => x.offsetParent);
      if (dateInp && !dateInp.value) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(dateInp, '1995-05-05'); dateInp.dispatchEvent(new Event('input', { bubbles: true })); dateInp.dispatchEvent(new Event('change', { bubbles: true })); return 'dob'; }
      const btn = [...document.querySelectorAll('button,[onclick],[role=button]')].find(x => x.offsetParent && /Abhi nahi|Skip|Close|Band|Next|Let's Play|Shuru|Samajh gaya|Verify|Submit|Confirm|Ho gaya|Done/.test((x.textContent || '').trim()) && (x.textContent || '').trim().length < 26);
      if (btn) { btn.click(); return 'btn:' + btn.textContent.trim().slice(0, 12); }
      if (cand[0]) { cand[0].click(); return 'x'; }
      return 0;
    });
    if (!d) break;
    await p.waitForTimeout(800);
  }
  await p.waitForTimeout(1200);
  await p.screenshot({ path: '/home/user/ff-user-panel/reports/d103-sweep-live-fixverify/_premium-home-hi.png' });
  await p.evaluate(() => window.navTo('profile'));
  await p.waitForTimeout(2500);
  await p.screenshot({ path: '/home/user/ff-user-panel/reports/d103-sweep-live-fixverify/_premium-profile-hi.png' });
  console.log('SHEETS:', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('div')].filter(d => { const cs = getComputedStyle(d); return cs.position === 'fixed' && parseInt(cs.zIndex || '0', 10) > 500 && d.offsetHeight > 150; }).map(d => (d.innerText || '').slice(0, 60).replace(/\n/g, ' | ')))));
  const t = await p.evaluate(() => (document.body.innerText || '').slice(0, 400));
  console.log('PROFILE-TXT:', t.replace(/\n/g, ' | ').slice(0, 260));
  await b.close();
})();
