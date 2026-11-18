const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('appLang','hi'); localStorage.setItem('tutorialSeen','1'); sessionStorage.setItem('vn_shown_this_launch','1'); } catch(e){} });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa1.email, ACCT.qa1.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  try { const sg = p.locator('button:has-text("Samajh gaya")'); if (await sg.count()) { await sg.first().click(); await p.waitForTimeout(800); } } catch (e) {}
  const audit = () => p.evaluate(() => {
    const bad = [];
    const vw = window.innerWidth;
    document.querySelectorAll('.screen, .screen *').forEach(el => {
      const scr = el.closest('.screen');
      if (!scr || getComputedStyle(scr).display === 'none') return;
      if (el.closest('[style*="display:none"], [hidden]')) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const txt = (el.textContent || '').trim().slice(0, 26);
      const dev = /[\u0900-\u097F]/.test(el.textContent || '');
      /* in-flow content overflow only (decorative absolute glows ignore) */
      let maxR = 0, maxB = 0;
      el.querySelectorAll('*').forEach(ch => {
        const ccs = getComputedStyle(ch);
        if (ccs.position === 'absolute' || ccs.position === 'fixed' || ccs.display === 'none') return;
        const cr2 = ch.getBoundingClientRect();
        if (cr2.width < 2 || cr2.height < 2) return;
        if (cr2.right > maxR) maxR = cr2.right;
        if (cr2.bottom > maxB) maxB = cr2.bottom;
      });
      const ownR = r.right - parseFloat(cs.paddingRight || '0');
      const ownB = r.bottom - parseFloat(cs.paddingBottom || '0');
      if (maxR > ownR + 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') {
        bad.push({ k: 'xover', sel: el.tagName + '.' + (el.className || '').toString().split(' ')[0], txt, over: Math.round(maxR - ownR), dev });
      }
      if (maxB > ownB + 2 && (cs.overflowY === 'hidden' || cs.overflowY === 'clip')) {
        bad.push({ k: 'yclip', sel: el.tagName + '.' + (el.className || '').toString().split(' ')[0], txt, over: Math.round(maxB - ownB), dev });
      }
      /* outside viewport horizontally */
      if (r.right > vw + 2 || r.left < -2) {
        bad.push({ k: 'offview', sel: el.tagName + '.' + (el.className || '').toString().split(' ')[0], txt, l: Math.round(r.left), r: Math.round(r.right), vw, dev });
      }
    });
    /* dedupe */
    const seen = new Set();
    return bad.filter(x => { const id = x.k + x.sel + x.txt; if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, 40);
  });
  const dismiss = async () => { try { const sg = p.locator('button:has-text("Samajh gaya")'); if (await sg.count()) { await sg.first().click(); await p.waitForTimeout(700); } } catch (e) {} };
  const out = {};
  for (const s of ['home','matches','rank','wallet','profile','notif','special']) {
    await p.evaluate((s) => window.navTo(s), s); await p.waitForTimeout(3800); await dismiss();
    out[s] = await audit();
    await dismiss();
    await p.screenshot({ path: '/home/user/ff-user-panel/reports/ui-sweep/hi-layout-' + s + '.png' });
  }
  /* modals */
  const modals = [['wd', 'startWd'], ['shop', 'showCoinShop'], ['clan', 'showClanHome'], ['search', 'showUserSearch']];
  for (const [key, fn] of modals) {
    try {
      await p.evaluate((fn) => { window[fn] && window[fn](); }, fn);
      await p.waitForTimeout(3000);
      out['modal-' + key] = await p.evaluate(() => {
        const ov = document.getElementById('modalOv');
        if (!ov || getComputedStyle(ov).display === 'none') return [];
        const bad = [];
        const vw = window.innerWidth;
        ov.querySelectorAll('*').forEach(el => {
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          const r = el.getBoundingClientRect();
          if (r.width < 4 || r.height < 4) return;
          const txt = (el.textContent || '').trim().slice(0, 26);
          const dev = /[\u0900-\u097F]/.test(el.textContent || '');
          let mR = 0, mB = 0;
          el.querySelectorAll('*').forEach(ch => {
            const ccs = getComputedStyle(ch);
            if (ccs.position === 'absolute' || ccs.position === 'fixed' || ccs.display === 'none') return;
            const cr3 = ch.getBoundingClientRect();
            if (cr3.width < 2 || cr3.height < 2) return;
            if (cr3.right > mR) mR = cr3.right;
            if (cr3.bottom > mB) mB = cr3.bottom;
          });
          const oR = r.right - parseFloat(cs.paddingRight || '0');
          const oB = r.bottom - parseFloat(cs.paddingBottom || '0');
          if (mR > oR + 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') bad.push({ k: 'xover', sel: el.tagName + '.' + (el.className || '').toString().split(' ')[0], txt, over: Math.round(mR - oR), dev });
          if (mB > oB + 2 && (cs.overflowY === 'hidden' || cs.overflowY === 'clip')) bad.push({ k: 'yclip', sel: el.tagName + '.' + (el.className || '').toString().split(' ')[0], txt, over: Math.round(mB - oB), dev });
          if (r.right > vw + 2 || r.left < -2) bad.push({ k: 'offview', sel: el.tagName + '.' + (el.className || '').toString().split(' ')[0], txt, l: Math.round(r.left), r: Math.round(r.right), vw, dev });
        });
        const seen = new Set();
        return bad.filter(x => { const id = x.k + x.sel + x.txt; if (seen.has(id)) return false; seen.add(id); return true; }).slice(0, 30);
      });
      await p.screenshot({ path: '/home/user/ff-user-panel/reports/ui-sweep/hi-layout-modal-' + key + '.png' });
      await p.evaluate(() => { window.closeModal && window.closeModal(); window.closeCoinShop && window.closeCoinShop(); });
      await p.waitForTimeout(800);
    } catch (e) { out['modal-' + key] = 'ERR'; }
  }
  console.log(JSON.stringify(out));
  await b.close();
})();
