/* D97 AUDIT — stored-XSS sink pass: bio/ign/chat/ticket payload, sab screens par render check */
const { chromium } = require('playwright');
const fs = require('fs');
const CRED = process.env.CRED || '/home/user/ff-user-panel/tools/tri-e2e/.state/d97a.json';
const VBASE = process.env.VBASE || 'http://127.0.0.1:8090';
const PAY = '<img src=x onerror="window.__xss=(window.__xss||0)+1"><svg onload="window.__xss=(window.__xss||0)+10">';
const cred = JSON.parse(fs.readFileSync(CRED, 'utf8'));
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await page.goto(VBASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.auth && window.firebase, null, { timeout: 20000 });
  await page.evaluate(([em, pw]) => window.auth.signInWithEmailAndPassword(em, pw), [cred.player.email, cred.player.password]);
  await page.waitForFunction(() => window.UD && window.UD.ign, null, { timeout: 25000 });
  // onboarding dismiss
  await page.evaluate(() => { try { localStorage.setItem('ffOnbV1', '1'); } catch (e) {} });
  const out = {};
  // 1) bio+ign payload via app's own save path? direct UD mutation + save fn if exists, else DB-side already set; yahan DOM render test:
  await page.evaluate(p => { window.UD.bio = p; window.UD.ign = p; if (window.renderProfile) window.renderProfile(); if (window.renderHome) window.renderHome(); }, PAY);
  await page.waitForTimeout(600);
  out.afterProfileRender = await page.evaluate(() => ({ xss: window.__xss || 0, stray: document.querySelectorAll('img[src="x"],svg[onload]').length }));
  for (const scr of ['home', 'rank', 'matches', 'wallet', 'profile', 'chat']) {
    await page.evaluate(s => window.navTo(s), scr);
    await page.waitForTimeout(500);
  }
  // share card canvas path
  out.share = await page.evaluate(async p => {
    try { if (window.openShareCard) window.openShareCard(); else if (window.shareProfile) window.shareProfile(); await new Promise(r => setTimeout(r, 800)); return { ok: true, xss: window.__xss || 0 }; } catch (e) { return { ok: false, e: String(e).slice(0, 120) }; }
  }, PAY);
  // chat payload
  out.chat = await page.evaluate(p => { const i = document.getElementById('chatIn'); if (!i || !window.sendChat) return { ok: false }; i.value = p; window.sendChat(); return { ok: true }; }, PAY);
  await page.waitForTimeout(1200);
  out.final = await page.evaluate(() => ({ xss: window.__xss || 0, stray: document.querySelectorAll('img[src="x"],svg[onload]').length, chatHtml: (document.querySelector('.chat-box,.chat-msgs,[id*=chat]') || {}).innerHTML ? 'has-chat-dom' : 'no' }));
  out.pageErrors = errs.slice(0, 5);
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1); });
