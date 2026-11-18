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
  const ids = await p.evaluate(async () => {
    try {
      const r = await window._supa.from('match_results').select('match_id').limit(3);
      if (r && r.data && r.data.length) return r.data.map(x => x.match_id);
      const r2 = await window._supa.from('matches').select('id').limit(3);
      return (r2.data || []).map(x => x.id);
    } catch (e) { return []; }
  });
  let dump = null;
  if (ids.length) {
    await p.evaluate((id) => { try { window.showResultPage && window.showResultPage(id); } catch (e) {} }, ids[0]);
    await p.waitForTimeout(4500);
    dump = await p.evaluate(() => {
      const act = [...document.querySelectorAll('.screen')].find(s => getComputedStyle(s).display !== 'none') || document.body;
      const w = document.createTreeWalker(act, NodeFilter.SHOW_TEXT, null);
      const o = []; let n;
      while ((n = w.nextNode())) { const t = (n.nodeValue || '').trim(); if (t && t.length < 46 && /[A-Za-z]{3}/.test(t)) o.push(t); }
      return { ids: 1, screen: act.id, nodes: [...new Set(o)].slice(0, 50) };
    });
  }
  console.log(JSON.stringify({ ids, dump }));
  await b.close();
})();
