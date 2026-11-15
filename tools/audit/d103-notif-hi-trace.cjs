/* ═══════════════════════════════════════════════════════════════════════════
   tools/audit/d103-notif-hi-trace.cjs  (D103 r7c, 15-Nov-2026)
   ---------------------------------------------------------------------------
   KYA: qa4 + Hindi + `notif` screen par clicks-matrix ka renderer crash
   ("Target crashed" / "Target page... closed") REPRODUCIBLE nikla, jabki:
     • qa4 + English → 9/9 screens clean
     • qa6/qa7/adm1 + hi & en → clean
     • fresh page par akela ix3 click → clean
   Matlab crash SEQUENCE + LANG + ACCOUNT specific hai. Ye trace batata hai ki
   KAUNSA click renderer maarta hai aur usse pehle DOM/memory kaise badhta hai
   (leak vs single poisonous element).

   Har click ke baad: alive?, DOM nodes, JS heap MB, pageerror, overlay count,
   aur notification cards ka Hindi text (taaki poisonous data dikhe).

   Usage:
     ACCTS=qa4 LANGS=hi SCREEN=notif MAXIX=12 LIVE=1 BASE=<live url> \
       node tools/audit/d103-notif-hi-trace.cjs
   ═══════════════════════════════════════════════════════════════════════════ */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ACCT = JSON.parse(fs.readFileSync(path.join(__dirname, '../tri-e2e/.state/d103.json'), 'utf8'));
const OUT = process.env.OUT || path.join(__dirname, '../../reports/d103-notif-hi-trace');
const BASE = process.env.BASE || 'http://127.0.0.1:8092/_d103.html';
const SCREEN = process.env.SCREEN || 'notif';
const MAXIX = Number(process.env.MAXIX || 12);
const accts = (process.env.ACCTS || 'qa4').split(',');
const langs = (process.env.LANGS || 'hi').split(',');
fs.mkdirSync(OUT, { recursive: true });

const DIAG = () => {
  const scr = document.querySelector('.screen.active') || document.body;
  const overlays = [...document.querySelectorAll('.modal, .overlay, dialog, [class*="modal"], [class*="overlay"], [class*="popup"], [class*="sheet"]')]
    .filter(e => e.offsetParent && getComputedStyle(e).display !== 'none');
  const cards = [...document.querySelectorAll('[class*="notif"], .card, li')]
    .filter(e => e.offsetParent && (e.textContent || '').trim().length > 4);
  return {
    alive: !!(window.navTo && document.getElementById('mainContent')),
    domNodes: document.querySelectorAll('*').length,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : -1,
    overlays: overlays.length,
    clickables: [...document.querySelectorAll('button, [onclick], [role=button], .nav-item')].filter(b => b.offsetParent && b.getBoundingClientRect().height > 8).length,
    cardCount: cards.length,
    cardTexts: cards.slice(0, 8).map(c => (c.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 90)),
    screenText: (scr.innerText || '').replace(/\s+/g, ' ').slice(0, 300),
  };
};

const out = { ts: new Date().toISOString(), base: BASE, screen: SCREEN, traces: [] };

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--mute-audio'] });
  for (const key of accts) for (const lang of langs) {
    if (!ACCT[key]) { console.log('SKIP', key); continue; }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, geolocation: { latitude: 30.3366, longitude: 76.7789 }, permissions: ['geolocation', 'notifications'] });
    await ctx.addInitScript(([l, LIVE_MODE]) => { try { localStorage.setItem('appLang', l); localStorage.setItem('_mes_lang_seen', '1'); localStorage.setItem('tutorialSeen', '1'); } catch (e) {} if (!LIVE_MODE) { window._SUPA_URL = 'http://127.0.0.1:8091'; window._SUPA_ANON_KEY = 'mock'; } }, [lang, process.env.LIVE === '1']);
    const page = await ctx.newPage();
    const errs = []; let crashed = false;
    page.on('pageerror', e => errs.push(String(e.message).slice(0, 160)));
    page.on('crash', () => { crashed = true; console.log('  ‼ RENDERER CRASH EVENT'); });
    const trace = { acct: key, lang, steps: [] };
    try {
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
      await page.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT[key].email, ACCT[key].password]);
      await page.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
      await page.waitForTimeout(2500);
      for (let i = 0; i < 8; i++) { const done = await page.evaluate(() => { const bs = [...document.querySelectorAll('button, .btn, [onclick]')].filter(b => b.offsetParent); const t = b => (b.textContent || '').trim(); const c = bs.find(b => /Skip|Finish|Done|Let's Play|Let's Go|Claim|Khelo|Start/i.test(t(b)) && t(b).length < 24) || bs.find(b => /^Next/i.test(t(b))); if (c) { c.click(); return 1; } return 0; }); if (!done) break; await page.waitForTimeout(700); }
      /* matrix jaisa hi: pehle 5 screens ghumo (state accumulate ho), phir target screen */
      for (const pre of ['home', 'rank', 'matches', 'wallet', 'profile']) {
        await page.evaluate(s => window.navTo && window.navTo(s), pre);
        await page.waitForTimeout(1200);
      }
      await page.evaluate(s => window.navTo && window.navTo(s), SCREEN);
      await page.waitForTimeout(2500);
      let d0 = await page.evaluate(DIAG);
      trace.steps.push({ at: 'after-navTo-' + SCREEN, ...d0, errs: errs.slice() });
      console.log(`\n=== ${key}/${lang} ${SCREEN} === nodes=${d0.domNodes} heap=${d0.heapMB}MB overlays=${d0.overlays} clickables=${d0.clickables} cards=${d0.cardCount}`);
      console.log('  screenText:', d0.screenText.slice(0, 200));
      d0.cardTexts.forEach((t, i) => console.log(`  card${i}: ${t}`));
      await page.screenshot({ path: path.join(OUT, `trace-${key}-${lang}-before.png`) }).catch(() => {});

      for (let ix = 0; ix < MAXIX; ix++) {
        const meta = await page.evaluate(([i]) => {
          const els = [...document.querySelectorAll('button, [onclick], [role=button], .nav-item')].filter(b => b.offsetParent && b.getBoundingClientRect().height > 8);
          const el = els[i]; if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, txt: ((el.textContent || '').trim().replace(/\s+/g, ' ')).slice(0, 40), onclick: (el.getAttribute('onclick') || '').slice(0, 60), tag: el.tagName.toLowerCase(), id: el.id || '', html: el.outerHTML.slice(0, 120) };
        }, [ix]).catch(e => ({ err: 'meta: ' + String(e.message).slice(0, 80) }));
        if (!meta) { console.log(`  ix${ix}: ELEMENT-GONE`); trace.steps.push({ ix, verdict: 'ELEMENT-GONE' }); break; }
        if (meta.err) { console.log(`  ix${ix}: ${meta.err}`); trace.steps.push({ ix, verdict: meta.err }); break; }
        errs.length = 0;
        try { await page.mouse.click(meta.x, meta.y); } catch (e) { console.log(`  ix${ix} "${meta.txt}" CLICK-ERR ${String(e.message).slice(0, 60)}`); trace.steps.push({ ix, target: meta, verdict: 'CLICK-ERR', err: String(e.message).slice(0, 100) }); break; }
        await page.waitForTimeout(2500);
        const d = await page.evaluate(DIAG).catch(e => ({ diagErr: String(e.message).slice(0, 90) }));
        const step = { ix, target: meta, crashed, errs: errs.slice(), ...d };
        trace.steps.push(step);
        console.log(`  ix${ix} "${(meta.txt || '').slice(0, 22)}" onclick="${(meta.onclick || '').slice(0, 34)}" → nodes=${d.domNodes} heap=${d.heapMB}MB overlays=${d.overlays} clickables=${d.clickables} alive=${d.alive} crashed=${crashed} errs=${errs.length}${d.diagErr ? ' DIAGERR=' + d.diagErr : ''}`);
        if (errs.length) errs.slice(0, 3).forEach(e => console.log('      err:', e));
        await page.screenshot({ path: path.join(OUT, `trace-${key}-${lang}-ix${ix}.png`) }).catch(() => {});
        if (crashed || d.diagErr || d.alive === false) { console.log(`  ✘ STOP: renderer/page dead at ix${ix}`); break; }
        /* matrix jaisa overlay close */
        await page.keyboard.press('Escape').catch(() => {});
        await page.evaluate(() => { const bs = [...document.querySelectorAll('button,[role=button],span,div')].filter(e => e.offsetParent); const t = b => (b.textContent || '').trim(); const c = bs.find(b => t(b) === '✕' || t(b) === '×' || /^Close$|^Band$|^Back$|^Wapas$|^OK$/i.test(t(b)) || /^(बंद|वापस|पीछे|ठीक)/.test(t(b))); if (c) c.click(); }).catch(() => {});
        await page.waitForTimeout(800);
      }
    } catch (e) { trace.fatal = String(e.message).slice(0, 160); console.log('  FATAL:', trace.fatal); }
    trace.crashed = crashed;
    out.traces.push(trace);
    await ctx.close().catch(() => {});
  }
  fs.writeFileSync(path.join(OUT, 'trace.json'), JSON.stringify(out, null, 1));
  const bad = out.traces.filter(t => t.crashed || (t.steps || []).some(s => s.alive === false || s.diagErr));
  console.log(`\nTRACE DONE: combos=${out.traces.length} problem=${bad.length} → ${path.join(OUT, 'trace.json')}`);
  await browser.close();
})();
