/* D103 (owner): "premium badge aur tag perfectly show hona chahiye, iski
   position perfectly set kar" — LIVE visual+geometry probe (final version).
   Surfaces: PCARD2 tier-color chip pill (profile), VIP crown chip, ribbon,
   home/public icons. Checks: visible, in-viewport, host ke andar, icon
   naturalWidth>0, koi "Premium III" nahi, koi ⭐ emoji nahi.
   Accts: qa2 (Gold L2 + title_mythic + badge_mvp), qa5 (Silver L1). hi + en. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(path.join(__dirname, '../tri-e2e/.state/d103.json'), 'utf8'));
const OUT = process.env.OUT || path.join(__dirname, '../../reports/d103-sweep-live-fixverify/_prem-visual');
const BASE = process.env.BASE || 'http://127.0.0.1:8092/_d103.html';
fs.mkdirSync(OUT, { recursive: true });
try { fs.readdirSync(OUT).filter(f => /^_measure-/.test(f)).forEach(f => fs.unlinkSync(path.join(OUT, f))); } catch (e) {}
const findings = [];
const add = (sev, acct, lang, where, kind, detail) => findings.push({ sev, acct, lang, where, kind, detail });

const MEASURE = () => {
  const vw = window.innerWidth;
  const cs = el => getComputedStyle(el);
  const vis = el => !!(el && el.offsetParent !== null && cs(el).visibility !== 'hidden' && cs(el).opacity !== '0');
  const rect = el => { const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), cx: +(r.x + r.width / 2).toFixed(1), right: +r.right.toFixed(1) }; };
  const out = { vw, surfaces: [], icons: [], texts: [] };
  const iconState = img => ({ src: (img.getAttribute('src') || '').split('/').slice(-2).join('/'), complete: img.complete, nw: img.naturalWidth, vis: vis(img), disp: cs(img).display, w: img.getBoundingClientRect().width });
  const _root = document.querySelector('.screen.active') || document;
  /* 1) PCARD2 premium chip pill (tier-color gradient, border-radius:999px) */
  const chip = [..._root.querySelectorAll('span')].find(s => (s.getAttribute('style') || '').indexOf('border-radius:999px') >= 0 && /Silver|Gold|Diamond|Premium/i.test((s.textContent || '').trim()) && (s.textContent || '').trim().length < 24);
  if (chip) {
    const r = rect(chip); const host = chip.parentElement; const hr = rect(host);
    out.surfaces.push({ id: 'pc2-chip', vis: vis(chip), rect: r, hostRect: hr, inViewport: r.x >= -1 && r.right <= vw + 1 && r.w > 0, insideHost: r.x >= hr.x - 2 && r.right <= hr.right + 2, text: (chip.textContent || '').trim() });
    chip.querySelectorAll('img').forEach(i => out.icons.push({ id: 'chip', ...iconState(i) }));
  } else out.surfaces.push({ id: 'pc2-chip', missing: true });
  /* 1b) VIP chip (crown asset, koi ⭐ emoji nahi) */
  const vipChip = [..._root.querySelectorAll('span')].find(s => (s.getAttribute('style') || '').indexOf('border-radius:999px') >= 0 && /VIP/.test((s.textContent || '').trim()) && (s.textContent || '').trim().length < 12);
  if (vipChip) {
    const r = rect(vipChip);
    out.surfaces.push({ id: 'pc2-vip', vis: vis(vipChip), rect: r, inViewport: r.x >= -1 && r.right <= vw + 1, text: (vipChip.textContent || '').trim(), starEmoji: /⭐/.test(vipChip.textContent || '') });
    vipChip.querySelectorAll('img').forEach(i => out.icons.push({ id: 'vip', ...iconState(i) }));
  }
  /* 1c) legacy plate (informational only) */
  const plate = document.querySelector('.pf2-prem');
  if (plate) out.surfaces.push({ id: 'profile-plate', vis: vis(plate), text: (plate.textContent || '').trim() });
  /* 3) leaderboard / matches ribbon (.prem-ribbon) */
  document.querySelectorAll('.prem-ribbon').forEach(rb => {
    const r = rect(rb);
    out.surfaces.push({ id: 'ribbon', vis: vis(rb), rect: r, inViewport: r.x >= -1 && r.right <= vw + 1, tier: rb.getAttribute('data-premium-tier') });
    out.icons.push({ id: 'ribbon', ...iconState(rb) });
  });
  /* 4) koi bhi premium icon img (home/public chips) */
  [...document.querySelectorAll('img')].filter(i => vis(i) && /premium\/(silver|gold|diamond|ribbon)\.png/.test(i.getAttribute('src') || '')).forEach(i => {
    const r = rect(i); const wrap = i.closest('div,span,button');
    out.icons.push({ id: 'any', rect: r, inViewport: r.x >= -1 && r.right <= vw + 1, wrapText: wrap ? (wrap.textContent || '').trim().slice(0, 24) : '', ...iconState(i) });
  });
  /* 5) banned strings */
  const txt = document.body.innerText || '';
  out.texts = { premiumIII: /Premium\s*(III|3)\b/.test(txt), hasTierWord: /Silver|Gold|Diamond/.test(txt) };
  return out;
};

(async () => {
  const browser = await chromium.launch({ args: ['--disable-dev-shm-usage', '--mute-audio'] });
  for (const key of ['qa2', 'qa5']) {
    for (const lang of ['hi', 'en']) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await ctx.addInitScript(([l, uid]) => {
        try { localStorage.setItem('appLang', l); localStorage.setItem('_mes_lang_seen', '1'); localStorage.setItem('tutorialSeen', '1'); localStorage.setItem('tutorialSeen_' + uid, '1'); localStorage.setItem('_mes_state', 'Haryana'); } catch (e) {}
      }, [lang, ACCT[key].uid]);
      const page = await ctx.newPage();
      page.on('pageerror', e => add('high', key, lang, 'global', 'pageerror', String(e.message).slice(0, 140)));
      await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
      await page.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT[key].email, ACCT[key].password]);
      await page.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
      await page.waitForTimeout(3000);
      const dismiss = async () => { for (let i = 0; i < 4; i++) { const done = await page.evaluate((uid) => { let hit = false; const btns = [...document.querySelectorAll('button, .sheet-close, [onclick]')].filter(b => b.offsetParent); const t = b => (b.textContent || '').trim(); const c = btns.find(b => /^Abhi nahi$/i.test(t(b))) || btns.find(b => /^✕$|^✖$|^×$/.test(t(b)) && (b.closest('[class*=sheet],[class*=modal],[role=dialog]'))) || btns.find(b => /Samajh gaya/i.test(t(b))); if (c) { c.click(); hit = true; } ['vnSheet', 'vnChip'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
          const tc1 = document.getElementById('_mes_tc1'), tc2 = document.getElementById('_mes_tc2');
          if (tc1 && tc2 && window.mesAcceptTC) { tc1.checked = true; tc2.checked = true; try { window.mesAcceptTC(uid); hit = true; } catch (e) {} }
          return hit; }, ACCT[key].uid); await page.waitForTimeout(500); if (!done) break; } };
      await dismiss();
      for (const scr of ['home', 'profile', 'rank', 'matches']) {
        await dismiss();
        await page.evaluate(s => window.navTo && window.navTo(s), scr);
        await page.waitForTimeout(2600);
        await page.evaluate(async () => { const sc = document.querySelector('.screen.active'); if (sc) { sc.scrollTop = sc.scrollHeight; await new Promise(r => setTimeout(r, 500)); sc.scrollTop = 0; await new Promise(r => setTimeout(r, 300)); } });
        const m = await page.evaluate(MEASURE);
        fs.appendFileSync(path.join(OUT, `_measure-${key}-${lang}.json`), JSON.stringify({ scr, m }, null, 1) + '\n');
        for (const s of m.surfaces) {
          if (s.missing) { if (s.id === 'pc2-chip' && scr === 'profile') add('high', key, lang, scr, 'prem-missing', 'premium user par profile chip nahi'); continue; }
          if (s.id === 'pc2-chip' && scr !== 'profile') continue; /* chip sirf profile card par expected */
          if (s.vis === false) add('high', key, lang, scr, 'prem-hidden', s.id + ' display:none/hidden');
          if (s.inViewport === false) add('high', key, lang, scr, 'prem-offscreen', s.id + ' ' + JSON.stringify(s.rect));
          if (s.insideHost === false) add('med', key, lang, scr, 'prem-clipped', s.id + ' chip host ke bahar ' + JSON.stringify(s.rect));
          if (s.starEmoji) add('med', key, lang, scr, 'vip-emoji', 'VIP chip me ⭐ emoji (asli crown asset hona chahiye)');
          if ((s.text || '').match(/Premium\s*(III|3)\b/)) add('high', key, lang, scr, 'prem-iii', s.text);
        }
        for (const ic of m.icons) {
          if (ic.vis && ic.complete && ic.nw === 0) add('high', key, lang, scr, 'prem-icon-broken', ic.id + ' ' + ic.src);
          if (ic.vis && ic.complete && ic.nw > 0 && ic.w > 0 && ic.w < 6) add('med', key, lang, scr, 'prem-icon-tiny', ic.id + ' w=' + ic.w);
        }
        if (scr === 'profile' || scr === 'home') { await dismiss(); await page.screenshot({ path: path.join(OUT, `prem-${key}-${lang}-${scr}.png`) }); }
      }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'findings-premium.json'), JSON.stringify(findings, null, 1));
  console.log('PREMIUM FINDINGS:', findings.length);
  findings.slice(0, 12).forEach(f => console.log(' ', f.sev, f.acct, f.lang, f.where, f.kind, String(f.detail).slice(0, 80)));
})();
