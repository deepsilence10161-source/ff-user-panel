/* D103 round-3: BUTTON-CLICK MATRIX — har screen ke har visible button/clickable par
   actual click → pageerror/crash detect → modal close → next. Real user jaisa behaviour.
   Usage: ONLY=qa2 LANGS=hi node d103-clicks.cjs   */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
const OUT = process.env.OUT || '/home/user/ff-user-panel/reports/d103-clicks';
fs.mkdirSync(OUT, { recursive: true });
const SCREENS = ['home', 'rank', 'matches', 'wallet', 'profile', 'notif', 'special', 'clan', 'settings'];
const findings = [];
const ALL_DIALOGS = [];
const OVERLAY_CLEANED = {};
const CRASHES = [];
const CUR = { scr: '-', ix: -1 };   // acct/lang → kitne overlay force-clean hue
const SKIP = /Logout|Sign Out|Delete Account|logout/i;   // session khatam karne wale skip
(async () => {
  /* ✅ r7c FIX (15-Nov): --disable-dev-shm-usage zaroori hai — bina iske /dev/shm
   (container me chhota) bhar jata tha ⇒ renderer OOM: pehle 10-min hang, phir
   'Target page, context or browser has been closed' (jo findings me false-positive
   ban kar girte the). premium script me ye pehle se tha, isliye wo clean chala. */
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--mute-audio'] });
  const only = process.env.ONLY ? process.env.ONLY.split(',') : ['qa2', 'qa1'];
  const langs = process.env.LANGS ? process.env.LANGS.split(',') : ['hi'];
  for (const key of only) for (const lang of langs) {
    /* ✅ r7c: DSF env-controlled (default 2 = pehle jaisa). Crash investigate
       karte waqt DSF=1 par test kiya — renderer OOM sirf DSF=2 par dikha. */
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: Number(process.env.DSF || 2), isMobile: true, hasTouch: true, geolocation: { latitude: 30.3366, longitude: 76.7789 }, permissions: ['geolocation', 'notifications'] });
    await ctx.addInitScript(([l, LIVE_MODE]) => { try { localStorage.setItem('appLang', l); localStorage.setItem('_mes_lang_seen', '1'); } catch (e) {} if (!LIVE_MODE) { window._SUPA_URL = 'http://127.0.0.1:8091'; window._SUPA_ANON_KEY = 'mock'; } }, [lang, process.env.LIVE === '1']);
    const page = await ctx.newPage();
    let errs = [];
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
    /* ✅ r7c: renderer crash ka event pakdo + heap trace (warna sirf
       'Target crashed' text milta tha, kaaran nahi). */
    let CRASHED = false;
    page.on('crash', () => { CRASHED = true; CRASHES.push({ acct: key, lang, screen: CUR.scr, ix: CUR.ix, blockI18n: process.env.BLOCK_I18N === '1' }); console.log(`  ‼ RENDERER CRASH ${key}/${lang} screen=${CUR.scr} ix=${CUR.ix} (BLOCK_I18N=${process.env.BLOCK_I18N === '1'})`); });
    /* ✅ r7c FIX (15-Nov-2026): native alert()/confirm()/prompt() khulne par
       Playwright HAMESHA ke liye block ho jata tha (qa4/en/special par 10 min
       atka mila). Ab har dialog turant dismiss + record hota hai. */
    const dialogs = [];
    page.on('dialog', async d => {
      try { const rec = { acct: key, lang, type: d.type(), msg: (d.message() || '').slice(0, 100) }; dialogs.push(rec); ALL_DIALOGS.push(rec); } catch (e) {}
      try { await d.dismiss(); } catch (e) { try { await d.accept(); } catch (e2) {} }
    });
    page.setDefaultTimeout(20000);   // koi bhi call forever hang na ho
    try {
      /* ✅ r7c A/B PROOF: BLOCK_I18N=1 par js/i18n-apply.js load hi nahi hota.
         Agar crash gayab ho jaye ⇒ culprit wahi file (self-triggering
         MutationObserver loop), product bug confirm. */
      if (process.env.BLOCK_I18N === '1') {
        await page.route('**/i18n-apply.js*', r => r.abort());
        await page.route('**/js/i18n-apply.js', r => r.abort());
      }
      await page.goto((process.env.BASE || 'http://127.0.0.1:8092/_d103.html'), { waitUntil: 'domcontentloaded', timeout: 60000 });
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
        if (CRASHED) { findings.push({ acct: key, lang, screen: scr, btn: '-', err: 'SKIPPED: renderer already crashed' }); console.log(`clicks ${key}/${lang}/${scr} SKIPPED (renderer dead)`); continue; }
        CUR.scr = scr; CUR.ix = -1;
        await page.evaluate(s => window.navTo && window.navTo(s), scr);
        await page.waitForTimeout(1500);
        const n = await page.evaluate(() => [...document.querySelectorAll('button, [onclick], [role=button], .nav-item')].filter(b => b.offsetParent && b.getBoundingClientRect().height > 8).length);
        for (let ix = 0; ix < Math.min(n, 22); ix++) {
         CUR.ix = ix;
         if (CRASHED) break;
         try {
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
            /* ✅ r7c FIX: pehle regex SIRF English tha (Close|Band|Back|Wapas) ⇒
               Hindi mode me modal ke "बंद करें/वापस" button kabhi click hi nahi
               hote the ⇒ overlay stack hote gaye (ek hi page par 100+ clicks) ⇒
               renderer OOM "Target crashed". Ab Devanagari labels + force-clean. */
            const t = b => (b.textContent || '').trim();
            const c = bs.find(b => t(b) === '✕' || t(b) === '×'
              || /^Close$|^Band$|^Back$|^Wapas$|^OK$|^Theek$/i.test(t(b))
              || /^(बंद|बंद करें|वापस|वापस जाएँ|पीछे|ठीक है|ठीक|रद्द करें|रद्द)/.test(t(b)));
            if (c) c.click();
          });
          await page.waitForTimeout(300);
          /* ✅ force-clean: ab bhi koi overlay/modal visible hai to DOM se hatao
             (warna agle click par pile-up). Count record hota hai = evidence. */
          const cleaned = await page.evaluate(() => {
            const sel = '.modal, .overlay, dialog, [class*="modal"], [class*="overlay"], [class*="popup"], [class*="sheet"], [id*="Modal"], [id*="Overlay"]';
            let n = 0;
            document.querySelectorAll(sel).forEach(el => {
              if (!el.offsetParent) return;
              const cs = getComputedStyle(el);
              if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
              const r = el.getBoundingClientRect();
              if (r.width < 40 || r.height < 40) return;   // chhote chips nahi, sirf bade overlays
              /* app ke zaroori container na hat jayein: sirf fixed/absolute full-screen wale */
              if (cs.position !== 'fixed' && cs.position !== 'absolute') return;
              if (el.id === 'mainContent' || el.classList.contains('screen')) return;
              try { el.remove(); n++; } catch (e) {}
            });
            return n;
          }).catch(() => 0);
          if (cleaned) { OVERLAY_CLEANED[key + '/' + lang] = (OVERLAY_CLEANED[key + '/' + lang] || 0) + cleaned; }
         } catch (e) { findings.push({ acct: key, lang, screen: scr, btn: 'ix' + ix, err: 'click-flow: ' + String(e.message).slice(0, 100) }); }
        }
        console.log(`clicks ${key}/${lang}/${scr} done, findings=${findings.length} dialogs=${dialogs.length}`);
        /* ✅ incremental save: beech me kuch atke ya crash ho to data na jaye */
        try { fs.writeFileSync(path.join(OUT, 'click-findings.json'), JSON.stringify({ findings, dialogs }, null, 1)); } catch (e) {}
      }
    } catch (e) { findings.push({ acct: key, lang, screen: '*', btn: '-', err: 'flow: ' + e.message.slice(0, 120) }); }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, 'click-findings.json'), JSON.stringify({ findings, dialogs: ALL_DIALOGS, overlayCleaned: OVERLAY_CLEANED }, null, 1));
  console.log('CLICK MATRIX FINDINGS:', findings.length, '| NATIVE DIALOGS:', ALL_DIALOGS.length);
  console.log('OVERLAYS FORCE-CLEANED (per acct/lang):', JSON.stringify(OVERLAY_CLEANED));
  console.log('RENDERER CRASHES:', CRASHES.length, JSON.stringify(CRASHES));
  ALL_DIALOGS.slice(0, 12).forEach(d => console.log('  dlg', d.acct + '/' + d.lang, d.type, '|', d.msg));
  findings.slice(0, 20).forEach(f => console.log(' -', f.screen, '|', f.btn, '|', f.err));
  await browser.close();
})();
