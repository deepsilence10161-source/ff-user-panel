'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { localStorage.setItem('appLang', 'en'); localStorage.setItem('_mes_lang_seen', '1'); });
  const p = await ctx.newPage();
  await p.goto(process.env.BASE || 'http://127.0.0.1:8092/_d103.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.qa6.email, ACCT.qa6.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  p.on('response', r => { if (r.url().includes('lh3')) console.log('LH3', r.status(), r.url().slice(48, 96)); });
  for (let i = 0; i < 6; i++) { const d = await p.evaluate(() => { const b = [...document.querySelectorAll('button,[onclick]')].find(x => x.offsetParent && /Abhi nahi|Skip|✕|×|Close|Band/i.test(x.textContent || '')); if (b) { b.click(); return 1; } return 0; }); if (!d) break; await p.waitForTimeout(800); }
  await p.evaluate(() => window.navTo('rank'));
  await p.evaluate(async () => { const el = document.scrollingElement || document.body; for (let y = 0; y < 6; y++) { el.scrollTop += 800; await new Promise(r => setTimeout(r, 400)); } });
  await p.waitForTimeout(2500);
  await p.evaluate(async () => { const el = document.scrollingElement || document.body; el.scrollTop = 1400; });
  await p.waitForTimeout(1500);
  for (let i = 0; i < 6; i++) { const d = await p.evaluate(() => { const b = [...document.querySelectorAll('button,[onclick]')].find(x => x.offsetParent && /Abhi nahi|Skip|✕|×|Close|Band/i.test(x.textContent || '')); if (b) { b.click(); return 1; } return 0; }); if (!d) break; await p.waitForTimeout(700); }
  await p.waitForTimeout(600);
  await p.screenshot({ path: '/home/user/ff-user-panel/reports/d103-sweep-live-fixverify/_rank-rows-check.png' });
  console.log('BADHTML', JSON.stringify(await p.evaluate(() => [...document.images].filter(i => i.offsetParent && (i.getAttribute('src') || '').startsWith('https://lh3') && !(i.complete && i.naturalWidth > 0)).slice(0, 3).map(i => ({ html: i.outerHTML.slice(0, 160), par: (i.parentElement.className || '').toString().slice(0, 30), par2: (i.parentElement.parentElement.className || '').toString().slice(0, 30) })))));
  console.log('LH3LIST', JSON.stringify(await p.evaluate(() => [...document.images].filter(i => (i.getAttribute('src') || '').startsWith('https://lh3')).slice(0, 6).map(i => ({ c: i.complete, w: i.naturalWidth, lz: i.loading, vis: !!i.offsetParent })))));
  for (const w of [2500, 5000, 9000]) {
    await p.waitForTimeout(w === 2500 ? 2500 : w - (w === 5000 ? 2500 : 5000));
    const st = await p.evaluate(() => { const vis = el => !!(el && el.offsetParent); const imgs = [...document.images].filter(vis).filter(i => (i.src || '').includes('lh3')); return { n: imgs.length, bad: imgs.filter(i => !(i.complete && i.naturalWidth > 0)).length }; });
    console.log('wait', w, JSON.stringify(st));
    if (w === 5000) console.log('LIST', JSON.stringify(await p.evaluate(() => [...document.images].filter(i => i.offsetParent).slice(0, 14).map(i => ({ s: (i.getAttribute('src') || '').slice(0, 34), c: i.complete, w: i.naturalWidth, lz: i.loading })))));
    if (w === 5000) console.log('SAMPLE', await p.evaluate(() => { const i = [...document.images].find(x => (x.src || '').includes('lh3')); return i ? i.outerHTML.slice(0, 220) + ' || loading=' + i.loading + ' complete=' + i.complete + ' cur=' + i.currentSrc : 'none'; }));
  }
  await b.close();
})();
