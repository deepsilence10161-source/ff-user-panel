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
    const ov = document.getElementById('modalOv');
    const ovVis = ov ? getComputedStyle(ov).display !== 'none' : false;
    if (!ovVis) {
      const act = [...document.querySelectorAll('.screen')].find(s => getComputedStyle(s).display !== 'none') || document.body;
      const w2 = document.createTreeWalker(act, NodeFilter.SHOW_TEXT, null);
      const o2 = []; let n2;
      while ((n2 = w2.nextNode())) { const t2 = (n2.nodeValue || '').trim(); if (t2 && t2.length < 46 && /[A-Za-z]{3}/.test(t2)) o2.push(t2); }
      return { title: 'SCREEN:' + (act.id || ''), nodes: [...new Set(o2)].slice(0, 40) };
    }
    return { title: tt.trim().slice(0, 40), nodes: [...new Set(out)].slice(0, 40) };
  });
  const out = {};
  const step = async (key, fn, arg) => {
    try {
      await p.evaluate(([fn, arg]) => { window[fn] && window[fn](arg); }, [fn, arg]);
      await p.waitForTimeout(4000);
      out[key] = await dumpModal();
      await p.evaluate(() => { window.closeModal && window.closeModal(); });
      await p.waitForTimeout(900);
    } catch (e) { out[key] = 'ERR'; }
  };
  await step('clanhome', 'showClanHome');
  await step('clancreate', 'showCreateClan');
  await step('pubprof', 'viewPublicProfile', ACCT.qa2.uid);
  console.log(JSON.stringify(out));
  await b.close();
})();
