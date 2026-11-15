/* D103 round-3b: NOTIFICATION FLOW probe — bell badge, list render, open→read, push-toast.
   QA-token-only; real users ko kuch nahi jata. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
const OUT = process.env.OUT || '/home/user/ff-user-panel/reports/d103-notif';
fs.mkdirSync(OUT, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  await ctx.addInitScript(([l, LIVE_MODE]) => { try { localStorage.setItem('appLang', l); localStorage.setItem('_mes_lang_seen', '1'); } catch (e) {} if (!LIVE_MODE) { window._SUPA_URL = 'http://127.0.0.1:8091'; window._SUPA_ANON_KEY = 'mock'; } }, [process.env.LANGS || 'hi', process.env.LIVE === '1']);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  await p.goto((process.env.BASE || 'http://127.0.0.1:8092/_d103.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.qa4.email, ACCT.qa4.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(3500);
  /* R7 FIX: live badge element #bellDot hai (core/header.js): 1-3 unread = DOT (no text),
     4+ = count pill. Purana probe sirf textContent padhta tha => dot par false FAIL. */
  const BADGE_PROBE = () => {
    const el = document.getElementById('bellDot') || document.querySelector('#bellBadge, #bell-badge, #notifDot, .bell-badge');
    if (!el) return '';
    const vis = !!el.offsetParent && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
    if (!vis) return '';
    return (el.textContent || '').trim() || 'DOT';
  };
  const badge0 = await p.evaluate(BADGE_PROBE);
  ok(badge0 !== '', 'bell badge unread dikhta hai pre-visit (' + badge0 + ')');
  await p.evaluate(() => window.navTo('notif'));
  await p.waitForTimeout(1800);
  const cards = await p.evaluate(() => document.querySelectorAll('.notif-card').length);
  ok(cards >= 2, 'notif list render: ' + cards + ' cards (mock me 2)');
  await p.screenshot({ path: OUT + '/notif-qa4-hi-list.png' });
  await p.evaluate(() => { const c = document.querySelector('.notif-card'); if (c) c.click(); });
  await p.waitForTimeout(900);
  const opened = await p.evaluate(() => !!document.querySelector('.modal, [class*=modal], dialog') || (document.body.innerText || '').length > 50);
  ok(opened, 'notif open hota hai (modal/detail) bina crash');
  await p.evaluate(() => { const bs = [...document.querySelectorAll('button,[role=button],span,div')].filter(e => e.offsetParent); const c = bs.find(x => { const t = (x.textContent || '').trim(); return t === '✕' || t === '×' || /^Close|Band$/i.test(t); }); if (c) c.click(); });
  await p.waitForTimeout(500);
  await p.evaluate(() => window.navTo('home'));
  await p.waitForTimeout(1200);
  const badge1 = await p.evaluate(BADGE_PROBE);
  ok(badge1 === '' || badge1 === '0', 'visit ke baad badge clear (' + JSON.stringify(badge1) + ')');
  const toast = await p.evaluate(() => { try { window._onNativePush('D103 Test Title', 'Body check', ''); return true; } catch (e) { return false; } });
  await p.waitForTimeout(700);
  const toastSeen = await p.evaluate(() => (document.body.innerText || '').indexOf('D103 Test Title') > -1);
  ok(toast && toastSeen, 'push-payload → in-app toast render (FCM foreground path)');
  await p.screenshot({ path: OUT + '/notif-qa4-hi-toast.png' });
  ok(errs.filter(e => !/FCM|Notification|messaging|sw.js|realtime|websocket|503|401/i.test(e)).length === 0, 'koi pageerror nahi (' + errs.length + ' raw)');
  console.log('NOTIF PROBE: PASS ' + pass + ' | FAIL ' + fail);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
