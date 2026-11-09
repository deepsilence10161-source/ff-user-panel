/* D97 FULL AUDIT — click-all live crawler
   Usage: VBASE=http://127.0.0.1:8090 CRED=<path d97a.json> OUT=<out.json> SHOTS=<dir> node click-all.cjs */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const VBASE = process.env.VBASE || 'http://127.0.0.1:8090';
const CRED = process.env.CRED || '/home/user/ff-user-panel/tools/tri-e2e/.state/d97a.json';
const OUT = process.env.OUT || '/home/user/ff-user-panel/reports/audit-d97/live-click.json';
const SHOTS = process.env.SHOTS || '/home/user/ff-user-panel/reports/audit-d97/shots';
const SCREENS = ['home', 'rank', 'matches', 'wallet', 'profile', 'notif', 'chat', 'special'];
const DANGER = /log ?out|sign ?out|delete|remove account|fdel|format|factory/i;

fs.mkdirSync(SHOTS, { recursive: true });
const cred = JSON.parse(fs.readFileSync(CRED, 'utf8'));

const result = { screens: {}, consoleErrors: [], pageErrors: [], failedReqs: [], skipped: [], modals: [] };
const clicked = new Set();

function drain(page, tag) { /* called after waits via collectors below */ }

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => result.pageErrors.push({ msg: String(e).slice(0, 300), at: Date.now() }));
  page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push({ msg: m.text().slice(0, 300), at: Date.now() }); });
  page.on('response', r => { if (r.status() >= 400) result.failedReqs.push({ url: r.url().slice(0, 160), status: r.status() }); });
  page.on('requestfailed', r => result.failedReqs.push({ url: r.url().slice(0, 160), status: 'FAILED ' + (r.failure() || {}).errorText }));

  const tag = () => result.screens[result._cur] ? result.screens[result._cur] : (result.screens[result._cur = 'boot'] = { clicks: [], errors: 0 });

  await page.goto(VBASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.auth && window.firebase, null, { timeout: 20000 });
  // QA sign-in (same onAuthStateChanged path as Google login)
  await page.evaluate(async ([em, pw]) => {
    await window.auth.signInWithEmailAndPassword(em, pw);
  }, [cred.player.email, cred.player.password]);
  await page.waitForFunction(() => window.UD && window.UD.ign, null, { timeout: 25000 });
  console.log('signin ok:', await page.evaluate(() => window.UD.ign));

  // onboarding / policy modals
  for (let i = 0; i < 4; i++) {
    const handled = await page.evaluate(() => {
      const vis = el => el && el.offsetParent !== null;
      const btns = [...document.querySelectorAll('button')].filter(b => vis(b) && /start|accept|agree|continue|shuru|i agree|got it|✕|close/i.test(b.textContent || b.getAttribute('aria-label') || ''));
      const modalOpen = [...document.querySelectorAll('[class*=modal],[id*=modal],[class*=onb],[id*=onb]')].some(vis);
      if (modalOpen && btns[0]) { btns[0].click(); return (btns[0].textContent || '').trim().slice(0, 30); }
      return null;
    });
    if (!handled) break;
    result.modals.push('auto-handled: ' + handled);
    await page.waitForTimeout(600);
  }

  const getTargets = () => page.evaluate(() => {
    const vis = el => { if (!el || el.disabled) return false; const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false; let p = el; while (p && p !== document.body) { const ps = getComputedStyle(p); if (ps.display === 'none' || ps.visibility === 'hidden') return false; p = p.parentElement; } return true; };
    const key = el => { const parts = []; let n = el, d = 0; while (n && n !== document.body && d < 4) { parts.unshift(n.tagName + ':' + (n.id || [...(n.parentElement ? n.parentElement.children : [])].indexOf(n))); n = n.parentElement; d++; } return parts.join('>'); };
    const sel = 'button,[onclick],[role=button],.chip,.tab,a[href]';
    return [...document.querySelectorAll(sel)].filter(vis).map(el => ({ key: key(el), desc: (el.id ? '#' + el.id + ' ' : '') + (el.textContent || el.getAttribute('aria-label') || el.getAttribute('onclick') || '').replace(/\s+/g, ' ').trim().slice(0, 45), tag: el.tagName }))
      .filter(t => t.desc || t.key);
  });

  const clickByKey = k => page.evaluate(k => {
    const vis = el => { if (!el || el.disabled) return false; const r = el.getBoundingClientRect(); return r.width >= 4 && r.height >= 4; };
    const key = el => { const parts = []; let n = el, d = 0; while (n && n !== document.body && d < 4) { parts.unshift(n.tagName + ':' + (n.id || [...(n.parentElement ? n.parentElement.children : [])].indexOf(n))); n = n.parentElement; d++; } return parts.join('>'); };
    const el = [...document.querySelectorAll('button,[onclick],[role=button],.chip,.tab,a[href]')].find(e => key(e) === k && vis(e));
    if (!el) return { ok: false };
    el.click();
    return { ok: true };
  }, k);

  const modalVisible = () => page.evaluate(() => [...document.querySelectorAll('[class*=modal],[id*=modal],[class*=sheet],[id*=sheet]')].some(el => el.offsetParent !== null && el.getBoundingClientRect().height > 60));
  const closeModals = () => page.evaluate(() => {
    for (let i = 0; i < 3; i++) { if (window.closeModal) { try { window.closeModal(); } catch (e) {} } if (window.closeCoinShop) { try { window.closeCoinShop(); } catch (e) {} } }
    document.querySelectorAll('[class*=modal] [aria-label*=Close],[class*=modal] [onclick*=close],[id*=modal] [onclick*=close]').forEach(b => { if (b.offsetParent) b.click(); });
  });

  for (const scr of SCREENS) {
    result._cur = scr;
    result.screens[scr] = { clicks: [], errors: [], shots: [] };
    const eBefore = result.pageErrors.length + result.consoleErrors.length;
    await page.evaluate(s => window.navTo(s), scr);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(SHOTS, `scr-${scr}.png`) });
    result.screens[scr].shots.push(`scr-${scr}.png`);
    for (let round = 0; round < 3; round++) {
      const targets = await getTargets();
      let clickedThisRound = 0;
      for (const t of targets) {
        const ck = scr + '|' + t.key;
        if (clicked.has(ck)) continue;
        if (DANGER.test(t.desc)) { result.skipped.push(scr + ': ' + t.desc); continue; }
        clicked.add(ck);
        const r = await clickByKey(t.key);
        if (!r.ok) continue;
        clickedThisRound++;
        result.screens[scr].clicks.push(t.desc || t.key);
        await page.waitForTimeout(380);
        if (await modalVisible()) {
          const mName = await page.evaluate(() => { const m = [...document.querySelectorAll('[class*=modal],[id*=modal],[class*=sheet]')].find(el => el.offsetParent !== null); return m ? (m.id || m.className).toString().slice(0, 40) : '?'; });
          if (!result.modals.includes(scr + ': ' + mName)) { result.modals.push(scr + ': ' + mName); await page.screenshot({ path: path.join(SHOTS, `modal-${scr}-${result.modals.length}.png`) }); }
        }
        if (clickedThisRound >= 22) break;
      }
      await closeModals();
      await page.waitForTimeout(300);
      if (!clickedThisRound) break;
    }
    await closeModals();
    result.screens[scr].errors = (result.pageErrors.length + result.consoleErrors.length) - eBefore;
  }

  // chat input + search input special pass
  result._cur = 'inputs';
  result.screens.inputs = { clicks: [], errors: [] };
  await page.evaluate(() => window.navTo('chat'));
  await page.waitForTimeout(700);
  const chatOk = await page.evaluate(() => { const i = document.getElementById('chatIn'); if (!i) return false; i.value = 'QA audit msg d97a'; i.dispatchEvent(new Event('input')); if (window.sendChat) window.sendChat(); return true; });
  result.screens.inputs.clicks.push('chatIn+sendChat=' + chatOk);
  await page.waitForTimeout(800);
  const searchOk = await page.evaluate(() => { if (window.showUserSearch) { window.showUserSearch(); return true; } return false; });
  await page.waitForTimeout(600);
  if (searchOk) {
    const typed = await page.evaluate(() => { const i = [...document.querySelectorAll('input')].find(x => x.offsetParent && /search|ign|name/i.test(x.placeholder || x.id)); if (!i) return false; i.value = 'TRIQA2'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); return true; });
    result.screens.inputs.clicks.push('search typed=' + typed);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(SHOTS, 'search-results.png') });
  }
  await closeModals();

  result.totalClicks = [...clicked].length;
  delete result._cur;
  fs.writeFileSync(OUT, JSON.stringify(result, null, 1));
  console.log('CLICKS:', result.totalClicks, '| pageErrors:', result.pageErrors.length, '| consoleErrors:', result.consoleErrors.length, '| failedReqs:', result.failedReqs.length);
  await browser.close();
})().catch(e => { console.error('FATAL', e); fs.writeFileSync(OUT, JSON.stringify(result, null, 1)); process.exit(1); });
