'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
(async () => {
  const cred = JSON.parse(fs.readFileSync('tools/tri-e2e/.state/d102a.json', 'utf8'));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem('ffOnbV1', '1'); } catch (e) {} });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([em, pw]) => window.auth.signInWithEmailAndPassword(em, pw), [cred.player.email, cred.player.password]);
  await p.waitForFunction(() => window.UD && window.UD.ign, null, { timeout: 30000 });
  await p.waitForTimeout(2000);
  await p.evaluate(() => {
    try { localStorage.setItem('ffOnbV1', '1'); } catch (e) {}
    const rp = document.getElementById('_refCodePopup'); if (rp) rp.remove();
    const vn = document.getElementById('vnNo'); if (vn) vn.click();
    if (window._tutDone) { try { window._tutDone(); } catch (e) {} }
    const dob = document.getElementById('_mes_dob'); const cbx = document.getElementById('_mes_age_cbx');
    if (dob && cbx) { dob.value = '1995-05-05'; cbx.checked = true; if (window.mesConfirmAge) mesConfirmAge(); }
  });
  const scan = async (label) => {
    const hits = await p.evaluate((medals) => {
      var out = [];
      var walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      var n;
      while ((n = walk.nextNode())) {
        var t = n.textContent || '';
        for (var i = 0; i < medals.length; i++) {
          if (t.indexOf(medals[i]) > -1) {
            var el = n.parentElement; var chain = [];
            var cur = el;
            for (var k = 0; k < 5 && cur; k++) { chain.push(cur.tagName + (cur.id ? '#' + cur.id : '') + (cur.className && typeof cur.className === 'string' ? '.' + cur.className.split(' ').slice(0, 2).join('.') : '')); cur = cur.parentElement; }
            out.push({ medal: medals[i], text: t.trim().slice(0, 60), chain: chain.join(' < ') });
          }
        }
      }
      return out;
    }, MEDALS);
    console.log('== ' + label + ': ' + hits.length + ' hits');
    hits.slice(0, 8).forEach(h => console.log('   ', h.medal, JSON.stringify(h.text), '|', h.chain));
    return hits;
  };
  await p.evaluate(() => window.navTo('profile'));
  await p.waitForTimeout(2500);
  await scan('PROFILE');
  await p.screenshot({ path: 'reports/release-evidence/20261109-d102/trace-profile.png' });
  await p.evaluate(() => window.navTo('home'));
  await p.waitForTimeout(2000);
  await scan('HOME');
  await b.close();
})();
