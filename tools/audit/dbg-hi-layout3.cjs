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
  const out = {};
  await p.evaluate(() => window.navTo('profile')); await p.waitForTimeout(3800);
  out.tile = await p.evaluate(() => {
    const el = [...document.querySelectorAll('#scrProfile div')].find(e => e.scrollHeight > e.clientHeight + 3 && /पहला मैच/.test(e.textContent||''));
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { html: el.outerHTML.slice(0, 220), style: el.getAttribute('style'), css: { ch: el.clientHeight, sh: el.scrollHeight, cw: el.clientWidth, sw: el.scrollWidth, oh: cs.overflowY, ox: cs.overflowX, h: cs.height, lh: cs.lineHeight, fs: cs.fontSize, pad: cs.padding, disp: cs.display, ac: cs.alignContent }, parentStyle: el.parentElement.getAttribute('style'), parentCls: (el.parentElement.className||'').toString() };
  });
  await p.evaluate(() => window.navTo('home')); await p.waitForTimeout(3800);
  out.card = await p.evaluate(() => {
    const card = document.querySelector('#scrHome .m-card');
    if (!card) return null;
    const cr = card.getBoundingClientRect();
    const wide = [];
    card.querySelectorAll('*').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > cr.width + 2 || r.right > cr.right + 2) wide.push({ sel: el.tagName + '.' + (el.className||'').toString().split(' ')[0], w: Math.round(r.width), r: Math.round(r.right), cardR: Math.round(cr.right), style: (el.getAttribute('style')||'').slice(0,80), pos: getComputedStyle(el).position });
    });
    return { cardW: Math.round(cr.width), cardSW: card.scrollWidth, wide: wide.slice(0,6) };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
