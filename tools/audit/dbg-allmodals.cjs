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
    const ov = document.getElementById('modalOv');
    if (!ov || getComputedStyle(ov).display === 'none') return null;
    const scr = document.getElementById('modalB') || document.body;
    const w = document.createTreeWalker(scr, NodeFilter.SHOW_TEXT, null);
    const out = []; let n;
    while ((n = w.nextNode())) { const t = (n.nodeValue || '').trim(); if (t && t.length < 46 && /[A-Za-z]{3}/.test(t)) out.push(t); }
    const tt = (document.getElementById('modalT') || {}).textContent || '';
    return { title: tt.trim().slice(0, 40), nodes: [...new Set(out)].slice(0, 30) };
  });
  const fns = ['showQRCode','showQuickRules','showRecentJoins','showRecentWinners','showReferralStats','showReportPlayer','showResultDispute','showSeasonStats','showSetBio','showTransactionSummary','showProfileViews','showClanLeaderboardFull','showJoinClanByCode','showClanChat','generateCertificate','showMatchCalendar','showMatchFeed'];
  const out = {};
  for (const f of fns) {
    try {
      await p.evaluate((f) => { window[f] && window[f](); }, f);
      await p.waitForTimeout(2600);
      out[f] = await dumpModal();
      await p.evaluate(() => { window.closeModal && window.closeModal(); });
      await p.waitForTimeout(700);
    } catch (e) { out[f] = 'ERR'; }
  }
  console.log(JSON.stringify(out));
  await b.close();
})();
