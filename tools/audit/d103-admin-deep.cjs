/* D103 round-4b: ADMIN DEEP SWEEP (LIVE Supabase, read-only-safe).
   1) har visible nav/section kholo  2) har section me non-destructive buttons click (modal open→close)
   3) pageerrors / broken images / NaN-undefined leaks / dummy-emoji-icon audit / empty-state
   4) screenshots per section.  DESTRUCTIVE actions (delete/ban/pay/approve/broadcast) SKIP by design. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
const OUT = process.env.OUT || '/home/user/ff-user-panel/reports/d103-admin-deep';
fs.mkdirSync(OUT, { recursive: true });
const findings = []; const add = (k, d) => findings.push({ kind: k, detail: String(d).slice(0, 220) });
const DESTRUCT = /delete|remove|ban\b|unban|suspend|deactivate|approve|reject|pay\b|payout|refund|withdraw|send\b|broadcast|reset|clear|wipe|cancel tournament|refund all|purge|kick|promote|demote|grant|revoke|save|submit|confirm|apply|update|close account|freeze|sign out|logout/i;
const EMOJI_ICON = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F0FF}]/u;
const AUDIT = `(() => {
  const vis = el => !!(el && el.offsetParent !== null && el.getClientRects().length);
  const imgs = [...document.images].filter(vis).map(i => ({ s: i.getAttribute('src') || '', ok: i.complete && i.naturalWidth > 0 }));
  const broken = imgs.filter(i => i.s && !i.ok && !i.s.startsWith('data:'));
  const txt = document.body.innerText || '';
  const leaks = (txt.match(/\\bNaN\\b|\\bundefined\\b|\\[object Object\\]|\\bnull\\b/g) || []).length;
  /* nav icons: text-only emoji vs real img/svg */
  const navs = [...document.querySelectorAll('nav a, nav button, .sidebar a, .sidebar button, aside a, aside button')].filter(vis);
  const navEmoji = navs.filter(n => !n.querySelector('img,svg') && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test((n.textContent || '').trim()));
  /* buttons without img/svg that look like icon buttons */
  const iconBtns = [...document.querySelectorAll('button')].filter(vis).filter(b => (b.getAttribute('title') || b.getAttribute('aria-label') || '').length > 2);
  const sec = [...document.querySelectorAll('.section')].find(x => x.classList.contains('active')) || null;
  const secVis = !!(sec && sec.offsetParent !== null);
  const secTxt = sec ? (sec.innerText || '') : '';
  const rows = sec ? sec.querySelectorAll('table tbody tr').length : document.querySelectorAll('table tbody tr').length;
  const ths = [...document.querySelectorAll('th')].map(t => (t.textContent || '').trim()).filter(Boolean);
  const fa = [...(sec || document).querySelectorAll('i.fas,i.far,i.fab')].filter(vis);
  const faDead = fa.filter(i => (i.offsetWidth === 0 && i.offsetHeight === 0));
  return { broken: broken.slice(0, 8), nImg: imgs.length, leaks, rows, ths: ths.slice(0, 14), navCount: navs.length, navEmoji: navEmoji.slice(0, 10).map(n => (n.textContent || '').trim().slice(0, 24)), iconBtns: iconBtns.length, txtLen: txt.length, secVis, secTxtLen: secTxt.length, faN: fa.length, faDead: faDead.length };
})`;
(async () => {
  /* ✅ r7c FIX (15-Nov): --disable-dev-shm-usage zaroori hai — bina iske /dev/shm
   (container me chhota) bhar jata tha ⇒ renderer OOM: pehle 10-min hang, phir
   'Target page, context or browser has been closed' (jo findings me false-positive
   ban kar girte the). premium script me ye pehle se tha, isliye wo clean chala. */
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--mute-audio'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + String(e.message).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  page.on('response', async r => { if (r.status() >= 400 && String(r.url()).includes('supabase.co')) { let bt = ''; try { bt = (await r.text()).slice(0, 160); } catch (e) {} errs.push('http' + r.status() + ': ' + String(r.url()).slice(45, 190) + ' => ' + bt); if (String(r.url()).includes('admin_activity_log') && !global.__lg400) { global.__lg400 = 1; const rq = r.request(); console.log('LOG400 METHOD=' + rq.method() + ' BODY=' + bt + ' POST=' + (rq.postData() || '').slice(0, 260)); } } });
  await page.goto(process.env.ADMIN_BASE || 'https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.auth || window.firebase, null, { timeout: 30000 });
  await page.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.adm1.email, ACCT.adm1.password]);
  await page.waitForTimeout(4000);
  for (let i = 0; i < 3; i++) {
    const done = await page.evaluate((mail) => {
      const inp = [...document.querySelectorAll('input')].find(x => x.offsetParent && /admin email/i.test(x.placeholder || ''));
      const btn = [...document.querySelectorAll('button')].find(b => b.offsetParent && /Trust This Device/i.test(b.textContent || ''));
      if (btn) { if (inp) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(inp, mail); inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true })); } btn.click(); return 1; }
      const acc = [...document.querySelectorAll('button,a')].find(b => b.offsetParent && /Access Admin Panel/i.test(b.textContent || ''));
      if (acc) { acc.click(); return 2; }
      return 0;
    }, ACCT.adm1.email);
    if (!done) break;
    await page.waitForTimeout(1500);
  }
  await page.waitForTimeout(3000);
  const denied = await page.evaluate(() => /Not an admin account/i.test(document.body.innerText || ''));
  if (denied) { add('flow-fail', 'LIVE admin gate denied'); }
  await page.screenshot({ path: path.join(OUT, '00-boot.png') });

  const MODS = "() => [...document.querySelectorAll('div')].filter(d => { const cs = getComputedStyle(d); return (cs.position === 'fixed' || cs.position === 'absolute') && parseInt(cs.zIndex || '0', 10) >= 50 && d.offsetHeight > 100; }).filter(d => !/toast|snack/i.test(d.className || '') && !d.querySelector('nav,.sidebar,.nav-item') && (d.innerText || '').length < 1500)";
  const closeAllModals = async () => {
    for (let k = 0; k < 3; k++) {
      const n = await page.evaluate(new Function('return (' + MODS + ')().length'));
      if (!n) return;
      await page.evaluate(new Function('return (' + MODS + ')().forEach(m => { const c = [...m.querySelectorAll(\'button,a,span,i\')].find(x => x.offsetParent && (/^(cancel|close|back|never ?mind|no|nahi)$/i.test((x.textContent || \'\').trim()) || /close/i.test(x.className || \'\') || /close|cancel/i.test(x.getAttribute(\'aria-label\') || \'\') || /^[×✕✖xX]$/.test((x.textContent || \'\').trim()))); if (c) c.click(); })'));
      await page.waitForTimeout(400);
      const n2 = await page.evaluate(new Function('return (' + MODS + ')().length'));
      if (n2 >= n) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
      const n3 = await page.evaluate(new Function('return (' + MODS + ')().length'));
      if (n3) {
        const r = await page.evaluate(new Function('const m = (' + MODS + ')()[0]; if (!m) return null; const d = m.firstElementChild || m; const b = d.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height };'));
        if (r) { await page.mouse.click(Math.max(6, r.x - 25), Math.max(6, r.y + r.h / 2)); await page.waitForTimeout(400); }
      }
      const n4 = await page.evaluate(new Function('return (' + MODS + ')().length'));
      if (n4) {
        add('modal-stuck', 'overlay band nahi hua (no close btn/escape/backdrop) — force-hide :: ' + (await page.evaluate(new Function('const m = (' + MODS + ')()[0]; return m ? (m.innerText || \'\').slice(0, 70) : \'?\''))).replace(/\n/g, ' '));
        await page.evaluate(new Function('(' + MODS + ')().forEach(m => { m.style.display = \'none\'; })'));
        await page.waitForTimeout(300);
      }
    }
  };
  /* ---- sections: app ke apne showSection(id) se deterministic switch ---- */
  const secIds = await page.evaluate(() => {
    const ids = [];
    [...document.querySelectorAll('[onclick*="showSection("]')].forEach(e => {
      const m = String(e.getAttribute('onclick')).match(/showSection\(\s*'([^']+)'/);
      if (m && !ids.includes(m[1])) ids.push(m[1]);
    });
    return ids;
  });
  console.log('SECTIONS(' + secIds.length + '):', secIds.join(', '));
  const clicked = []; let btnClicks = 0; let modalOpens = 0;
  for (const sid of secIds) {
    const label = sid;
    if (DESTRUCT.test(sid)) { clicked.push(sid + ' [SKIP-destructive]'); continue; }
    await closeAllModals();
    const ok = await page.evaluate(i => { try { window.showSection(i); return 1; } catch (e) { return 0; } }, sid);
    if (!ok) { add('section-switch-fail', sid + ' :: showSection throw'); continue; }
    let switched = 0;
    for (let w = 0; w < 8; w++) {
      switched = await page.evaluate(i => { const sec = document.querySelector('.section.active'); return sec && sec.id === 'section-' + i ? 1 : 0; }, sid);
      if (switched) break;
      await page.waitForTimeout(400);
    }
    if (!switched) add('section-switch-fail', sid + ' :: active id mismatch');
    /* nav onclick ke section-loaders bhi chalao (showSection akela loaders skip karta) */
    await page.evaluate(i => { const el = [...document.querySelectorAll('[onclick]')].find(e => (e.getAttribute('onclick') || '').includes("showSection('" + i + "'")); if (el) el.click(); }, sid);
    await page.waitForTimeout(1600);
    const rep = await page.evaluate(new Function('return ' + AUDIT)());
    const slug = sid.replace(/[^a-z0-9]+/gi, '_').slice(0, 26);
    await page.screenshot({ path: path.join(OUT, 'sec-' + slug + '.png') });
    console.log('SEC', sid, 'rows=' + rep.rows, 'imgs=' + rep.nImg, 'broken=' + rep.broken.length, 'leaks=' + rep.leaks, 'secVis=' + rep.secVis, 'txt=' + rep.secTxtLen, 'faDead=' + rep.faDead);
    rep.broken.forEach(b => add('img-fail', sid + ' :: ' + b.s));
    if (rep.leaks > 0) add('text-leak', sid + ' :: ' + rep.leaks + ' NaN/undefined/null leaks');
    if (!rep.secVis || rep.secTxtLen < 60) add('empty-section', sid + ' :: section not visible/blank (vis=' + rep.secVis + ' txt=' + rep.secTxtLen + ')');
    if (rep.faDead > 0) add('icon-fail', sid + ' :: ' + rep.faDead + '/' + rep.faN + ' FA icons zero-size');
    clicked.push(sid);
    /* in-section safe button probe */
    const btnInfo = await page.evaluate(() => {
      const sec = document.querySelector('.section.active') || document;
      return [...sec.querySelectorAll('button')]
        .filter(b => b.offsetParent).map(b => ({ t: (b.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40), img: !!b.querySelector('img,svg') }))
        .filter(b => b.t && b.t.length < 34);
    });
    for (const b of btnInfo) {
      if (btnClicks >= 90) break;
      if (DESTRUCT.test(b.t)) continue;
      const MODS = "() => [...document.querySelectorAll('div')].filter(d => { const cs = getComputedStyle(d); return (cs.position === 'fixed' || cs.position === 'absolute') && parseInt(cs.zIndex || '0', 10) >= 50 && d.offsetHeight > 100; }).filter(d => !/toast|snack/i.test(d.className || '') && !d.querySelector('nav,.sidebar,.nav-item') && (d.innerText || '').length < 1500)";
      const before = await page.evaluate(new Function('return (' + MODS + ')().length'));
      const did = await page.evaluate(bt => { const sec = document.querySelector('.section.active') || document; const el = [...sec.querySelectorAll('button')].filter(x => x.offsetParent).find(x => ((x.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)) === bt); if (!el) return 0; el.click(); return 1; }, b.t);
      if (!did) continue;
      btnClicks++;
      await page.waitForTimeout(700);
      const after = await page.evaluate(new Function('return { n: (' + MODS + ')().length }'));
      if (after.n > before) {
        modalOpens++;
        await page.screenshot({ path: path.join(OUT, 'modal-' + slug + '-' + b.t.replace(/[^a-z0-9]+/gi, '_').slice(0, 16) + '.png') });
        await closeAllModals();
      }
    }
  }
  /* global emoji-as-icon audit (nav) */
  const navEmoji = await page.evaluate(() => [...document.querySelectorAll('nav a,nav button,.sidebar a,.sidebar button,aside a,aside button')]
    .filter(e => e.offsetParent).filter(e => !e.querySelector('img,svg') && /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test((e.textContent || '').trim()))
    .map(e => (e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30)));
  if (navEmoji.length) add('dummy-icon', 'nav emoji-only icons: ' + navEmoji.slice(0, 12).join(' / '));
  const NOISE = /FCM|Notification permission|messaging|sw.js|realtime|websocket|favicon|ResizeObserver|401 \(Unauthorized\)|403 \(Forbidden\)/i;
  errs.filter(e => !NOISE.test(e)).slice(0, 40).forEach(e => add('pageerror', e));
  console.log('CLICKED SECTIONS:', clicked.length, '| button clicks:', btnClicks, '| modals opened:', modalOpens);
  console.log('ADMIN DEEP FINDINGS:', findings.length);
  findings.slice(0, 24).forEach(f => console.log(' -', f.kind, '|', f.detail));
  fs.writeFileSync(path.join(OUT, 'findings.json'), JSON.stringify({ findings, sections: clicked, btnClicks, modalOpens }, null, 1));
  await browser.close();
})();
