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
  await p.evaluate(() => window.navTo('profile')); await p.waitForTimeout(4000);
  const r = await p.evaluate(() => {
    const hits = [];
    const scan = (root, label) => {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = w.nextNode())) {
        const t = (n.nodeValue || '').trim();
        if (/SKY DIAMOND|GREEN DIAMOND|^COINS$|Win Rate|K\/M|^Matches$|^Kills$|^Wins$/i.test(t)) {
          const el = n.parentElement;
          hits.push({ t, label, tag: el.tagName, cls: (el.className||'').toString().slice(0,30) });
        }
      }
    };
    scan(document.body, 'body');
    document.querySelectorAll('*').forEach(el => { if (el.shadowRoot) scan(el.shadowRoot, 'shadow:' + el.tagName + '.' + (el.className||'').toString().split(' ')[0]); });
    /* CSS content check */
    document.querySelectorAll('*').forEach(el => {
      const cs = getComputedStyle(el, '::before');
      const c = cs && cs.content;
      if (c && /SKY DIAMOND|GREEN DIAMOND|COINS/i.test(c)) hits.push({ t: c.slice(0,40), label: 'before:' + el.tagName + '.' + (el.className||'').toString().split(' ')[0] });
    });
    return hits;
  });
  console.log(JSON.stringify(r, null, 1));
  await b.close();
})();
