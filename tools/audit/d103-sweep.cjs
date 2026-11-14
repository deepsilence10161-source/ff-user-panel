/* D103 10-hour QA sweep — 7 QA accounts × hi/en × har screen.
   Mock-Supabase (127.0.0.1:8091) data-layer; Firebase auth live.
   Checks per screen: images loaded / dummy-src / emoji-icon slots / i18n holes / NaN-undefined-leaks / pageerrors.
   OUT: reports/d103-sweep/  */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
const OUT = process.env.OUT || '/home/user/ff-user-panel/reports/d103-sweep';
fs.mkdirSync(OUT, { recursive: true });
const SCREENS = ['home', 'rank', 'matches', 'wallet', 'profile', 'notif', 'special', 'clan', 'settings'];
const EMOJI = /[\u{1F3C6}\u{1F3C5}\u{1F396}\u{1F6E1}\u{2B50}\u{1F48E}\u{1F451}\u{1F525}\u{1F3AF}]/u;
const findings = [];
function add(sev, acct, lang, screen, kind, detail) { findings.push({ sev, acct, lang, screen, kind, detail: String(detail).slice(0, 220) }); }

(async () => {
  const browser = await chromium.launch();
  const only = process.env.ONLY ? process.env.ONLY.split(',') : Object.keys(ACCT);
  const langs = process.env.LANGS ? process.env.LANGS.split(',') : ['hi', 'en'];
  for (const key of only) {
    for (const lang of langs) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, geolocation: { latitude: 30.3366, longitude: 76.7789 }, permissions: ['geolocation', 'notifications'] });
      await ctx.addInitScript(([l]) => {
        try { localStorage.setItem('appLang', l); localStorage.setItem('_mes_lang_seen', '1'); } catch (e) {}
        window._SUPA_URL = 'http://127.0.0.1:8091';
        window._SUPA_ANON_KEY = 'mock-anon-key';
      }, [lang]);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
      page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 140)); });
      try {
        await page.goto((process.env.BASE || 'http://127.0.0.1:8092/_d103.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
        await page.evaluate(([em, pw]) => window.auth.signInWithEmailAndPassword(em, pw), [ACCT[key].email, ACCT[key].password]);
        await page.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
        await page.waitForTimeout(2500);
        /* first-login modals dismiss: referral sheet skip + loc guide (geolocation granted hai) */
        let nullStreak = 0;
        for (let i = 0; i < 8; i++) {
          const done = await page.evaluate(() => {
            const btns = [...document.querySelectorAll('button, .btn, [onclick]')].filter(b => b.offsetParent);
            const skip = btns.find(b => /Skip/i.test(b.textContent || ''));
            if (skip) { skip.click(); return 'skip'; }
            const allow = btns.find(b => /ON kar|Allow|Enable/i.test(b.textContent || '') && /loc|GPS|location/i.test((b.closest('.modal,[class*=modal],dialog') || {}).textContent || b.textContent));
            if (allow) { allow.click(); return 'loc'; }
            const fin = btns.find(b => /Finish|Done|Shuru|Samapt|Close|Band|Let's Play|Let's Go|Claim|Awesome|Khelo|Start/i.test((b.textContent || '').trim()) && (b.textContent || '').trim().length < 22);
            if (fin) { fin.click(); return 'finish'; }
            const nxt = btns.find(b => /Next/i.test(b.textContent || ''));
            if (nxt) { nxt.click(); return 'next'; }
            const x = [...document.querySelectorAll('button,[role=button],span,div')].filter(e => e.offsetParent && ((e.textContent || '').trim() === '✕' || (e.textContent || '').trim() === '×'));
            if (x[0]) { x[0].click(); return 'x'; }
            return null;
          });
          if (!done) { nullStreak++; if (nullStreak >= 4) break; } else nullStreak = 0;
          await page.waitForTimeout(1100);
        }
        for (const scr of SCREENS) {
          const okNav = await page.evaluate(s => { try { if (!window.navTo) return false; window.navTo(s); return true; } catch (e) { return false; } }, scr);
          if (!okNav) { add('info', key, lang, scr, 'nav-missing', 'navTo absent'); continue; }
          await page.waitForTimeout(1800);
          await page.evaluate(() => {
            const btns = [...document.querySelectorAll('button, .btn, [onclick]')].filter(b => b.offsetParent);
            const t = b => (b.textContent || '').trim();
            const c = btns.find(b => /Skip|Finish|Done|Shuru|Band|Let's Play|Let's Go|Claim|Khelo|Start/i.test(t(b)) && t(b).length < 24) || btns.find(b => /^Next/i.test(t(b)));
            if (c) c.click();
          });
          await page.waitForTimeout(400);
          const rep = await page.evaluate((lang) => {
            const vis = el => !!(el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
            const imgs = [...document.images].filter(i => vis(i) && i.getAttribute('src')).map(i => ({ s: i.getAttribute('src'), ok: i.complete && i.naturalWidth > 0 }));
            const badImgs = imgs.filter(i => !i.ok || /dummy|placeholder|via\.place|lorempixel/i.test(i.s));
            const emojiSlots = [...document.querySelectorAll('.badge,[class*="tier"],[class*="rank-"],[class*="medal"],[class*="premium"],[class*="title-"],[class*="icon"]')]
              .filter(vis).map(e => (e.textContent || '').trim()).filter(t => t && t.length <= 4 && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(t));
            const txt = document.body.innerText || '';
            const leaks = (txt.match(/\bNaN\b|\bundefined\b|\{\{|\[object Object\]|TODO:|FIXME/g) || []);
            const i18nHoles = [...document.querySelectorAll('[data-i18n]')].filter(vis).filter(e => (e.textContent || '').trim() === (e.getAttribute('data-i18n') || '').trim() && e.getAttribute('data-i18n')).map(e => e.getAttribute('data-i18n'));
            const ENLAB = /(^(Home|Rank|Wallet|Profile|Matches|Settings|Notifications|Shop|Store|Clan|Leaderboard|Wins|Kills)$|My Titles|View all|Season Pass|Join \/ Create|Live Stream|Battle Pass|Welcome to|Invite & Earn|Search|Apply$|Skip|Next|Finish|Let's Play|Gold\+|Win Rate|K\/M|Quick Tour)/;
            const enInHi = lang === 'hi' ? [...document.querySelectorAll('button, .nav-item, [class*=nav] a, [class*=bottom] *, h1,h2,h3,h4, .badge, [class*=chip], [class*=label]')].filter(vis).map(e => (e.textContent || '').trim()).filter(t => t && t.length < 26 && ENLAB.test(t) && !/[\u0900-\u097F]/.test(t)) : [];
            return { badImgs: badImgs.slice(0, 12), emojiSlots: emojiSlots.slice(0, 12), leaks: leaks.slice(0, 8), i18nHoles: i18nHoles.slice(0, 12), imgTotal: imgs.length, enInHi: [...new Set(enInHi)].slice(0, 14) };
          }, [lang]);
          rep.badImgs.forEach(b => add('high', key, lang, scr, 'img-fail', b.s));
          rep.emojiSlots.forEach(t => add('med', key, lang, scr, 'emoji-slot', t));
          rep.leaks.forEach(t => add('med', key, lang, scr, 'text-leak', t));
          rep.i18nHoles.forEach(t => add('med', key, lang, scr, 'i18n-hole', t));
          rep.enInHi.forEach(t => add('med', key, lang, scr, 'en-in-hi', t));
          await page.screenshot({ path: path.join(OUT, `${key}-${lang}-${scr}.png`) });
        }
        errs.filter(e => !/FCM|Notification permission|messaging|service worker|sw.js|realtime\/v1|websocket|503|401 \(\)/i.test(e)).slice(0, 6).forEach(e => add('high', key, lang, '*', 'pageerror', e));
      } catch (e) { add('high', key, lang, '*', 'flow-fail', e.message.slice(0, 160)); }
      await ctx.close();
      console.log(`done ${key}/${lang} findings=${findings.length}`);
    }
  }
  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify(findings, null, 1));
  const byKind = {};
  findings.forEach(f => byKind[f.kind] = (byKind[f.kind] || 0) + 1);
  console.log('SWEEP FINDINGS:', findings.length, JSON.stringify(byKind));
  await browser.close();
})();
