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
  /* home: m-card inner overflow + offview div identity */
  await p.evaluate(() => window.navTo('home')); await p.waitForTimeout(3800);
  out.home = await p.evaluate(() => {
    const res = { cardKids: [], offview: [] };
    const card = document.querySelector('#scrHome .m-card');
    if (card) {
      card.querySelectorAll('*').forEach(el => {
        const cs = getComputedStyle(el);
        if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') {
          res.cardKids.push({ sel: el.tagName + '.' + (el.className||'').toString().split(' ')[0], txt: (el.textContent||'').trim().slice(0,30), sw: el.scrollWidth, cw: el.clientWidth, to: cs.textOverflow, ws: cs.whiteSpace });
        }
      });
      res.cardCss = (() => { const cs = getComputedStyle(card); return { ox: cs.overflowX, w: card.clientWidth, sw: card.scrollWidth, pad: cs.padding }; })();
    }
    document.querySelectorAll('#scrHome div').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.right > 392 && r.width > 4) {
        const cs = getComputedStyle(el);
        res.offview.push({ id: el.id, cls: (el.className||'').toString().slice(0,40), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), pos: cs.position, pe: cs.pointerEvents, bg: cs.backgroundImage.slice(0,40), html: el.outerHTML.slice(0,90) });
      }
    });
    return res;
  });
  /* profile: badge tile css */
  await p.evaluate(() => window.navTo('profile')); await p.waitForTimeout(3800);
  out.profile = await p.evaluate(() => {
    const tiles = [...document.querySelectorAll('#scrProfile div')].filter(el => /पहला मैच|वेटेरन|चैंपियन/.test(el.textContent||'') && el.children.length <= 3 && (el.textContent||'').length < 40);
    const t = tiles[tiles.length-1];
    if (!t) return null;
    const cs = getComputedStyle(t);
    const par = t.parentElement; const pcs = getComputedStyle(par);
    return { cls: (t.className||'').toString(), html: t.outerHTML.slice(0,160), css: { h: t.clientHeight, sh: t.scrollHeight, w: t.clientWidth, sw: t.scrollWidth, oh: cs.overflowY, lh: cs.lineHeight, fs: cs.fontSize, pad: cs.padding, hmin: cs.minHeight }, par: { cls: (par.className||'').toString(), disp: pcs.display, gap: pcs.gap, cols: pcs.gridTemplateColumns } };
  });
  /* rank: .rn ellipsis? */
  await p.evaluate(() => window.navTo('rank')); await p.waitForTimeout(3800);
  out.rank = await p.evaluate(() => {
    const el = document.querySelector('#scrRank .rn') || [...document.querySelectorAll('.rn')][0];
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { to: cs.textOverflow, ox: cs.overflowX, ws: cs.whiteSpace, sw: el.scrollWidth, cw: el.clientWidth };
  });
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
