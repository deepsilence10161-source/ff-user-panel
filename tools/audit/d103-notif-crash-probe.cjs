/* ═══════════════════════════════════════════════════════════════════════════
   tools/audit/d103-notif-crash-probe.cjs  (D103 r7c, 15-Nov-2026)
   ---------------------------------------------------------------------------
   KYA: clicks-matrix me qa4/en par `notif` screen ke click index 3 (ix3) ke
   baad renderer "Target crashed" ho gaya ⇒ uske baad ke saare 17 clicks bhi
   fail (kyunki page mar chuka tha). Ye probe batata hai:
     1) notif screen par clickable elements kaun-kaun hain (index ke saath)
     2) KAUN SA ek element renderer crash karta hai — har click EK FRESH PAGE
        par (taaki ek crash baaki ko poison na kare)
     3) crash account-specific hai ya element-specific (kai accounts/langs)
   Owner rule: "har button par zero crash" ⇒ ye launch-blocker hunt hai.

   Usage:
     ACCTS=qa4 LANGS=en node tools/audit/d103-notif-crash-probe.cjs
     ACCTS=qa4,qa2,qa6 LANGS=en,hi SCREEN=notif BASE=<live url> LIVE=1 node ...
   Env: ACCTS, LANGS, SCREEN(default notif), BASE, LIVE, OUT, MAXIX(default 10)
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ACCT = JSON.parse(fs.readFileSync(path.join(__dirname, '../tri-e2e/.state/d103.json'), 'utf8'));
const OUT = process.env.OUT || path.join(__dirname, '../../reports/d103-notif-crash-probe');
const BASE = process.env.BASE || 'http://127.0.0.1:8092/_d103.html';
const SCREEN = process.env.SCREEN || 'notif';
const MAXIX = Number(process.env.MAXIX || 10);
const accts = (process.env.ACCTS || 'qa4').split(',');
const langs = (process.env.LANGS || 'en').split(',');
fs.mkdirSync(OUT, { recursive: true });

const ENUM = () => [...document.querySelectorAll('button, [onclick], [role=button], .nav-item')]
  .filter(b => b.offsetParent && b.getBoundingClientRect().height > 8)
  .map((el, i) => {
    const r = el.getBoundingClientRect();
    return {
      i, tag: el.tagName.toLowerCase(),
      id: el.id || '', cls: (el.className || '').toString().slice(0, 40),
      onclick: (el.getAttribute('onclick') || '').slice(0, 60),
      txt: ((el.textContent || '').trim().replace(/\s+/g, ' ')).slice(0, 44),
      x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
      imgs: el.querySelectorAll('img').length,
    };
  });

const out = { ts: new Date().toISOString(), base: BASE, screen: SCREEN, runs: [] };

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--mute-audio'] });
  for (const key of accts) for (const lang of langs) {
    if (!ACCT[key]) { console.log('SKIP', key, '(state me nahi)'); continue; }
    /* ---------- STEP 1: enumeration (ek page) ---------- */
    let list = [];
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, geolocation: { latitude: 30.3366, longitude: 76.7789 }, permissions: ['geolocation', 'notifications'] });
      await ctx.addInitScript(([l, LIVE_MODE]) => { try { localStorage.setItem('appLang', l); localStorage.setItem('_mes_lang_seen', '1'); localStorage.setItem('tutorialSeen', '1'); } catch (e) {} if (!LIVE_MODE) { window._SUPA_URL = 'http://127.0.0.1:8091'; window._SUPA_ANON_KEY = 'mock'; } }, [lang, process.env.LIVE === '1']);
      const page = await ctx.newPage();
      let crashed = false; page.on('crash', () => { crashed = true; });
      const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
      try {
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
        await page.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT[key].email, ACCT[key].password]);
        await page.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
        await page.waitForTimeout(2500);
        for (let i = 0; i < 8; i++) { const done = await page.evaluate(() => { const bs = [...document.querySelectorAll('button, .btn, [onclick]')].filter(b => b.offsetParent); const t = b => (b.textContent || '').trim(); const c = bs.find(b => /Skip|Finish|Done|Let's Play|Let's Go|Claim|Khelo|Start/i.test(t(b)) && t(b).length < 24) || bs.find(b => /^Next/i.test(t(b))); if (c) { c.click(); return 1; } return 0; }); if (!done) break; await page.waitForTimeout(800); }
        await page.evaluate(s => window.navTo && window.navTo(s), SCREEN);
        await page.waitForTimeout(2000);
        list = await page.evaluate(ENUM);
        await page.screenshot({ path: path.join(OUT, `enum-${key}-${lang}.png`), fullPage: false }).catch(() => {});
      } catch (e) { console.log('ENUM FAIL', key, lang, String(e.message).slice(0, 100)); }
      console.log(`\n=== ${key}/${lang} — ${SCREEN} screen clickables: ${list.length} (crashed=${crashed}) ===`);
      list.slice(0, MAXIX + 2).forEach(e => console.log(`  ix${e.i} <${e.tag}${e.id ? '#' + e.id : ''}> "${e.txt}" onclick="${e.onclick}" imgs=${e.imgs}`));
      await ctx.close();
    }
    /* ---------- STEP 2: har index EK FRESH PAGE par click ---------- */
    for (let ix = 0; ix < Math.min(list.length, MAXIX); ix++) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, geolocation: { latitude: 30.3366, longitude: 76.7789 }, permissions: ['geolocation', 'notifications'] });
      await ctx.addInitScript(([l, LIVE_MODE]) => { try { localStorage.setItem('appLang', l); localStorage.setItem('_mes_lang_seen', '1'); localStorage.setItem('tutorialSeen', '1'); } catch (e) {} if (!LIVE_MODE) { window._SUPA_URL = 'http://127.0.0.1:8091'; window._SUPA_ANON_KEY = 'mock'; } }, [lang, process.env.LIVE === '1']);
      const page = await ctx.newPage();
      const rec = { acct: key, lang, ix, target: list[ix] ? { txt: list[ix].txt, onclick: list[ix].onclick, id: list[ix].id, tag: list[ix].tag } : null, crashed: false, errs: [], verdict: '?' };
      page.on('crash', () => { rec.crashed = true; });
      page.on('pageerror', e => rec.errs.push(String(e.message).slice(0, 140)));
      try {
        await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
        await page.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT[key].email, ACCT[key].password]);
        await page.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
        await page.waitForTimeout(2200);
        for (let i = 0; i < 8; i++) { const done = await page.evaluate(() => { const bs = [...document.querySelectorAll('button, .btn, [onclick]')].filter(b => b.offsetParent); const t = b => (b.textContent || '').trim(); const c = bs.find(b => /Skip|Finish|Done|Let's Play|Let's Go|Claim|Khelo|Start/i.test(t(b)) && t(b).length < 24) || bs.find(b => /^Next/i.test(t(b))); if (c) { c.click(); return 1; } return 0; }); if (!done) break; await page.waitForTimeout(700); }
        await page.evaluate(s => window.navTo && window.navTo(s), SCREEN);
        await page.waitForTimeout(1800);
        /* element ko dobara locate karo (fresh page ⇒ index same hona chahiye) */
        const meta = await page.evaluate(([i]) => {
          const els = [...document.querySelectorAll('button, [onclick], [role=button], .nav-item')].filter(b => b.offsetParent && b.getBoundingClientRect().height > 8);
          const el = els[i]; if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, txt: ((el.textContent || '').trim().replace(/\s+/g, ' ')).slice(0, 44), onclick: (el.getAttribute('onclick') || '').slice(0, 60), html: el.outerHTML.slice(0, 160) };
        }, [ix]);
        if (!meta) { rec.verdict = 'ELEMENT-GONE'; }
        else {
          rec.target = { txt: meta.txt, onclick: meta.onclick, html: meta.html };
          const memBefore = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : -1)).catch(() => -1);
          await page.mouse.click(meta.x, meta.y);
          await page.waitForTimeout(4000);
          const alive = await page.evaluate(() => !!(window.navTo && document.getElementById('mainContent'))).catch(() => false);
          const memAfter = await page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : -1)).catch(() => -1);
          rec.memBeforeMB = memBefore > 0 ? +(memBefore / 1048576).toFixed(1) : null;
          rec.memAfterMB = memAfter > 0 ? +(memAfter / 1048576).toFixed(1) : null;
          rec.alive = alive;
          rec.verdict = rec.crashed ? 'RENDERER-CRASH' : (!alive ? 'APP-DEAD' : (rec.errs.length ? 'JS-ERROR' : 'OK'));
          await page.screenshot({ path: path.join(OUT, `click-${key}-${lang}-ix${ix}.png`) }).catch(() => {});
        }
      } catch (e) { rec.verdict = rec.crashed ? 'RENDERER-CRASH' : 'PROBE-ERR: ' + String(e.message).slice(0, 100); }
      out.runs.push(rec);
      console.log(`  → ix${ix} ${rec.verdict} | "${(rec.target && rec.target.txt || '').slice(0, 30)}" | onclick="${(rec.target && rec.target.onclick || '').slice(0, 46)}" | mem ${rec.memBeforeMB}→${rec.memAfterMB} MB | errs=${rec.errs.length}`);
      if (rec.errs.length) rec.errs.slice(0, 3).forEach(e => console.log('      err:', e));
      await ctx.close().catch(() => {});
    }
  }
  fs.writeFileSync(path.join(OUT, 'crash-probe.json'), JSON.stringify(out, null, 1));
  const bad = out.runs.filter(r => r.verdict !== 'OK');
  console.log(`\nCRASH PROBE: runs=${out.runs.length} OK=${out.runs.length - bad.length} PROBLEM=${bad.length}`);
  bad.forEach(r => console.log(`  ✘ ${r.acct}/${r.lang} ix${r.ix} ${r.verdict} — "${(r.target && r.target.txt || '').slice(0, 34)}" onclick="${(r.target && r.target.onclick || '').slice(0, 50)}"`));
  console.log('json →', path.join(OUT, 'crash-probe.json'));
  await browser.close();
})();
