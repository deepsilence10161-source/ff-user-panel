'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const cred = JSON.parse(fs.readFileSync('tools/tri-e2e/.state/d102a.json', 'utf8'));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('ffOnbV1', '1'); } catch (e) {} });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([em, pw]) => window.auth.signInWithEmailAndPassword(em, pw), [cred.player.email, cred.player.password]);
  await p.waitForFunction(() => window.UD && window.UD.ign, null, { timeout: 30000 });
  await p.waitForTimeout(1800);
  await p.evaluate(() => { const rp = document.getElementById('_refCodePopup'); if (rp) rp.remove(); const vn = document.getElementById('vnNo'); if (vn) vn.click(); if (window._tutDone) _tutDone(); const d = document.getElementById('_mes_dob'), c = document.getElementById('_mes_age_cbx'); if (d && c) { d.value = '1995-05-05'; c.checked = true; mesConfirmAge(); } });
  await p.evaluate(() => window.navTo('profile'));
  await p.waitForTimeout(2500);
  const dump = await p.evaluate(() => {
    var out = [];
    document.querySelectorAll('*').forEach(el => {
      var t = (el.childElementCount === 0 ? (el.textContent || '') : '');
      if (/Bronze|Gold|Silver/.test(t) && t.length < 30 && el.closest('[data-pc2]')) {
        var par = el.parentElement;
        out.push({ txt: t.trim(), selfHTML: el.outerHTML.slice(0, 300), parentHTML: par ? par.outerHTML.slice(0, 700) : '' });
      }
    });
    return out.slice(0, 6);
  });
  dump.forEach(d => console.log('TXT:', d.txt, '\n  SELFHTML:', d.selfHTML, '\n  PARENT:', d.parentHTML, '\n---'));
  await b.close();
})();
