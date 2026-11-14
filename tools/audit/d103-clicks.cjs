/* D103 round-3: BUTTON-CLICK MATRIX — har screen ke har visible button/clickable par
   actual click → pageerror/crash detect → modal close → next. Real user jaisa behaviour.
   Usage: ONLY=qa2 LANGS=hi node d103-clicks.cjs   */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
const OUT = '/home/user/ff-user-panel/reports/d103-clicks';
fs.mkdirSync(OUT, { recursive: true });
const SCREENS = ['home', 'rank', 'matches', 'wallet', 'profile', 'notif', 'special', 'clan', 'settings'];
const findings = [];
const SKIP = /Logout|Sign Out|Delete Account|logout/i;   // session khatam karne wale skip
(async () => {
  const browser = await chromium.launch();
  const only = process.env.ONLY ? process.env.ONLY.split(',') : ['qa2', 'qa1'];
  const langs = process.env.LANGS ? process.env.LANGS.split(',') : ['hi'];
  for (const key of only) for (const lang of langs) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: { latitude: 30.3366, longitude: 76.7789 }, permissions: ['geolocation', 'notifications'] });
    await ctx.addInitScript(([l]) => { try { localStorage.setItem('appLang', l); } catch (e) {} window._SUPA_URL = 'http://127.0.0.1:8091'; window._SUPA_ANON_KEY = 'mock'; }, [lang]);
    const page = await ctx.newPage();
    let errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    try {
      await page.goto('http://127.0.0.1:8092/_d103.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
      await page.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT[key].email, ACCT[key].password]);
      await page.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
      await page.waitForTimeout(2500);
      let ns = 0;
      for (let i = 0; i < 8; i++) {
        const done = await page.evaluate(() => {
          const bs = [...document.querySelectorAll('button, .btn, [onclick]')].filter(b => b.offsetParent);
          const t = b => (b.textContent || '').trim();
          const c = bs.find(b => /Skip|Finish|Done|Let's Play|Let's Go|Claim|Khelo|Start/i.test(t(b)) && t(b).length < 24) || bs.find(b => /^Next/i.test(t(b)));
          if (c) { c.click(); return 1; } return 0;
        });
        if (!done) { ns++; if (ns >= 4) break; } else ns = 0;
        await page.waitForTimeout(1000);
      }
      for (const scr of SCREENS) {
        await page.evaluate(s => window.navTo && window.navTo(s), scr);
        await page.waitForTimeout(1500);
        const n = await page.evaluate(() => [...document.querySelectorAll('button, [onclick], [role=button], .nav-item')].filter(b => b.offsetParent && b.getBoundingClientRect().height > 8).length);
        for (let ix = 0; ix < Math.min(n, 22); ix++) {
          const meta = await page.evaluate(([i, sk]) => {
            const els = [...document.querySelectorAll('button, [onclick], [role=button], .nav-item')].filter(b => b.offsetParent && b.getBoundingClientRect().height > 8);
            const el = els[i]; if (!el) return null;
            const t = ((el.textContent || '').trim() || el.getAttribute('aria-label') || el.className || '').slice(0, 40);
            if (new RegExp(sk).test(t)) return { skip: true, t };
            const r = el.getBoundingClientRect();
            return { t, x: r.x + r.width / 2, y: r.y + r.height / 2 };
          }, [ix, SKIP.source]);
          if (!meta || meta.skip) continue;
          errs = [];
          try { await page.mouse.click(meta.x, meta.y); } catch (e) { continue; }
          await page.waitForTimeout(700);
          const alive = await page.evaluate(() => !!(window.navTo && document.getElementById('mainContent')));
          errs.filter(e => !/FCM|Notification|messaging|service worker|sw.js|realtime|websocket|503|401/i.test(e)).forEach(e => findings.push({ acct: key, lang, screen: scr, btn: meta.t, err: e }));
          if (!alive) findings.push({ acct: key, lang, screen: scr, btn: meta.t, err: 'APP-DEAD after click' });
          /* overlay close: Escape + X/✕/Close/Back */
          await page.keyboard.press('Escape').catch(() => {});
          await page.evaluate(() => {
            const bs = [...document.querySelectorAll('button,[role=button],span,div')].filter(e => e.offsetParent);
            const c = bs.find(b => { const t = (e => (e.textContent || '').trim)(b); return t === '✕' || t === '×' || /^Close$|^Band$|^Back$|^Wapas$/i.test(t); });
            if (c) c.click();
          });
          await page.waitForTimeout(300);
        }
        console.log(`clicks ${key}/${lang}/${scr} done, findings=${findings.length}`);
      }
    } catch (e) { findings.push({ acct: key, lang, screen: '*', btn: '-', err: 'flow: ' + e.message.slice(0, 120) }); }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'click-findings.json'), JSON.stringify(findings, null, 1));
  console.log('CLICK MATRIX FINDINGS:', findings.length);
  findings.slice(0, 20).forEach(f => console.log(' -', f.screen, '|', f.btn, '|', f.err));
  await browser.close();
})();
