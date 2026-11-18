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
  const dumpModal = () => p.evaluate(() => {
    const scr = document.getElementById('modalB') || document.body;
    const w = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT, null);
    const out = []; let n;
    while ((n = w.nextNode())) { const t = (n.nodeValue || '').trim(); if (t && t.length < 46 && /[A-Za-z]{3}/.test(t)) out.push(t); }
    const tt = (document.getElementById('modalT') || {}).textContent || '';
    return { title: tt.trim().slice(0, 40), nodes: [...new Set(out)].slice(0, 40) };
  });
  const dumpScr = (id) => p.evaluate((id) => {
    const scr = document.getElementById(id) || document.body;
    const w = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT, null);
    const out = []; let n;
    while ((n = w.nextNode())) { const t = (n.nodeValue || '').trim(); if (t && t.length < 46 && /[A-Za-z]{3}/.test(t)) out.push(t); }
    return [...new Set(out)].slice(0, 40);
  }, id);
  const out = {};
  /* notif screen */
  await p.evaluate(() => window.navTo('notif')); await p.waitForTimeout(4000);
  out.notif = await dumpScr('scrNotif');
  /* withdraw modal */
  await p.evaluate(() => window.navTo('wallet')); await p.waitForTimeout(2500);
  try { await p.evaluate(() => window.startWd && window.startWd()); await p.waitForTimeout(3500); out.wd = await dumpModal(); await p.evaluate(() => window.closeModal && window.closeModal()); await p.waitForTimeout(800); } catch (e) { out.wd = 'ERR'; }
  /* add-money modal */
  try { await p.evaluate(() => window.startAdd && window.startAdd()); await p.waitForTimeout(3500); out.add = await dumpModal(); await p.evaluate(() => window.closeModal && window.closeModal()); await p.waitForTimeout(800); } catch (e) { out.add = 'ERR'; }
  /* coin shop */
  try { await p.evaluate(() => window.showCoinShop && window.showCoinShop()); await p.waitForTimeout(3500); out.shop = await dumpModal(); await p.evaluate(() => window.closeCoinShop && window.closeCoinShop()); await p.waitForTimeout(800); } catch (e) { out.shop = 'ERR'; }
  /* match details: click first .mm-card on HOME */
  await p.evaluate(() => window.navTo('home')); await p.waitForTimeout(4000);
  try {
    const cnt = await p.evaluate(() => document.querySelectorAll('#scrHome .m-card').length);
    await p.evaluate(() => { const b = [...document.querySelectorAll('#scrHome .mc-info-btn')].find(x => (x.getAttribute('onclick')||'').includes('showDet')); if (b) b.click(); });
    await p.waitForTimeout(4000);
    const st = await p.evaluate(() => ({ cur: window.curScr, vis: [...document.querySelectorAll('.screen')].filter(s => s.classList.contains('active') || getComputedStyle(s).display !== 'none').map(s => s.id) }));
    out.match = { cnt, ...st, ...(await dumpModal()) };
    await p.evaluate(() => { window.closeModal && window.closeModal(); window.goBack && window.goBack(); });
  } catch (e) { out.match = 'ERR:' + e.message.slice(0, 80); }
  /* extra modals: checkin, ad-earn, user-search */
  for (const [key, fn] of [['checkin','doCheckIn'],['adearn','showAdEarn'],['usrsearch','showUserSearch']]) {
    try {
      await p.evaluate((fn) => { window[fn] && window[fn](); }, fn);
      await p.waitForTimeout(3500);
      out[key] = await dumpModal();
      await p.evaluate(() => { window.closeModal && window.closeModal(); window.closeCoinShop && window.closeCoinShop(); });
      await p.waitForTimeout(800);
    } catch (e) { out[key] = 'ERR'; }
  }
  console.log(JSON.stringify(out));
  await b.close();
})();
