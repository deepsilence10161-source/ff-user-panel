#!/usr/bin/env node
/* tools/audit/stray-where.cjs — xss-pass ke "stray" nodes KAHAN hain, ye batata hai.
   xss-pass count deta hai (img[src="x"], svg[onload]); ye tool har node ka
   ancestor-chain + attribute-state + CSP dump karta hai taaki pata chale ki
   node inert hai (CSP/escaping) ya asli sink.
   Usage: VBASE=http://127.0.0.1:8090 CRED=tools/tri-e2e/.state/<run>.json node tools/audit/stray-where.cjs */
const { chromium } = require('playwright');
const fs = require('fs');
const VBASE = process.env.VBASE || 'http://127.0.0.1:8090';
const cred = JSON.parse(fs.readFileSync(process.env.CRED || 'tools/tri-e2e/.state/d99a.json', 'utf8'));

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(VBASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.auth && window.firebase, null, { timeout: 20000 });
  await page.evaluate(async ([em, pw]) => { await window.auth.signInWithEmailAndPassword(em, pw); }, [cred.player.email, cred.player.password]);
  await page.waitForFunction(() => window.UD && window.UD.ign, null, { timeout: 25000 });
  await page.waitForTimeout(4000);
  /* xss-pass jaisa hi CLIENT-SIDE payload (DB chhuye bina) — UD.bio/ign me PAY
     daal kar render karwao, phir dekho stray nodes kahan aur kis haalat me hain. */
  const PAY = '<img src=x onerror="window.__xss=(window.__xss||0)+1"><svg onload="window.__xss=(window.__xss||0)+10">';
  await page.evaluate(p => {
    window.UD.bio = p; window.UD.ign = p;
    if (window.renderProfile) window.renderProfile();
    if (window.renderHome) window.renderHome();
  }, PAY);
  await page.waitForTimeout(2500);
  const SNAP = () => page.evaluate(() => {
    const chain = (el) => { const p = []; let n = el; for (let i = 0; i < 7 && n; i++) { p.push(n.tagName + (n.id ? '#' + n.id : '') + (n.className && typeof n.className === 'string' ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : '')); n = n.parentElement; } return p.join(' < '); };
    const nodes = [...document.querySelectorAll('img[src="x"],svg[onload]')];
    return {
      count: nodes.length,
      xss: window.__xss || 0,
      csp: (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || 'none',
      nodes: nodes.map(n => ({
        tag: n.tagName,
        attrs: [...n.attributes].map(a => a.name + '=' + String(a.value).slice(0, 60)),
        hasOnerrorAttr: n.hasAttribute('onerror'),
        hasOnloadAttr: n.hasAttribute('onload'),
        onerrorProp: typeof n.onerror,
        connected: n.isConnected,
        visible: !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length),
        chain: chain(n),
        parentText: (n.parentElement ? n.parentElement.textContent : '').slice(0, 120),
      })),
    };
  });
  const out = { steps: [] };
  out.steps.push({ step: 'after-payload-render', ...(await SNAP()) });
  for (const scr of ['home', 'rank', 'matches', 'wallet', 'profile', 'chat']) {
    try { await page.evaluate(s => window.navTo(s), scr); } catch (e) { out.steps.push({ step: scr, navError: String(e).slice(0, 120) }); continue; }
    await page.waitForTimeout(900);
    out.steps.push({ step: scr, ...(await SNAP()) });
  }
  try {
    await page.evaluate(async () => { if (window.openShareCard) window.openShareCard(); else if (window.shareProfile) window.shareProfile(); await new Promise(r => setTimeout(r, 900)); });
    await page.waitForTimeout(600);
    out.steps.push({ step: 'share-card', ...(await SNAP()) });
  } catch (e) { out.steps.push({ step: 'share-card', err: String(e).slice(0, 120) }); }
  console.log(JSON.stringify(out, null, 1));
  await b.close();
})();
