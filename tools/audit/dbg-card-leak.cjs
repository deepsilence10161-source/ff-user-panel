const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('appLang','hi'); localStorage.setItem('tutorialSeen','1'); sessionStorage.setItem('vn_shown_this_launch','1'); } catch(e){} });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.text().includes('LEAK')) console.log('PAGE:', m.text()); });
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa1.email, ACCT.qa1.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    const out = {};
    const lbl = document.querySelector('.mc-cell label');
    out.before = lbl ? lbl.textContent : 'NO-LABEL';
    out.inMap = !!(window._i18nApplyRaw);
    try { window._i18nApplyRaw(); } catch (e) { out.err = String(e); }
    const lbl2 = document.querySelector('.mc-cell label');
    out.after = lbl2 ? lbl2.textContent : 'NO-LABEL';
    const vo = document.querySelector('.join-vo');
    out.vo = vo ? vo.textContent : 'no-vo';
    const pr = document.querySelector('.mc-prize-rank');
    out.pr = pr ? pr.textContent : 'no-pr';
    out.lang = localStorage.getItem('appLang');
    out._lang = window._lang || null;
    return out;
  });
  console.log(JSON.stringify(r));
  await b.close();
})();
