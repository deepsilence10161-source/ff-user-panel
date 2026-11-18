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
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.refseed.email, ACCT.refseed.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(2500);
  try { const sg = p.locator('button:has-text("Samajh gaya")'); if (await sg.count()) { await sg.first().click(); await p.waitForTimeout(800); } } catch (e) {}
  await p.evaluate(() => window.navTo('matches')); await p.waitForTimeout(4000);
  const opts = await p.evaluate(() => {
    const dd = document.getElementById('mmStatusDd'); if (!dd) return [];
    dd.click();
    return [];
  });
  await p.waitForTimeout(900);
  const picked = await p.evaluate(() => {
    const cands = [...document.querySelectorAll('#mmStatusDd *')].filter(e => e.children.length === 0 && (e.textContent || '').trim());
    const t = cands.map(e => (e.textContent || '').trim());
    const target = cands.find(e => /all|सभी/i.test(e.textContent || '')) || cands.find(e => /completed|result|पूरे/i.test(e.textContent || '')) || cands[1];
    if (target) target.click();
    return t;
  });
  await p.waitForTimeout(4000);
  const clicked = await p.evaluate(() => {
    const btn = [...document.querySelectorAll('#scrMatches button, #scrMatches [role="button"]')].find(b => /result|रिज़ल्ट/i.test(b.textContent || ''));
    if (btn) { btn.click(); return (btn.textContent || '').trim(); }
    return null;
  });
  await p.waitForTimeout(4500);
  const dump = await p.evaluate(() => {
    const rp = document.getElementById('_resultPage');
    const act = rp && getComputedStyle(rp).display !== 'none' ? rp : ([...document.querySelectorAll('.screen')].find(s => getComputedStyle(s).display !== 'none') || document.body);
    const w = document.createTreeWalker(act, NodeFilter.SHOW_TEXT, null);
    const o = []; let n;
    while ((n = w.nextNode())) { const t = (n.nodeValue || '').trim(); if (t && t.length < 46 && /[A-Za-z]{3}/.test(t)) o.push(t); }
    return { target: act.id || act.className, nodes: [...new Set(o)].slice(0, 60) };
  });
  console.log(JSON.stringify({ picked, clicked, dump }));
  await b.close();
})();
