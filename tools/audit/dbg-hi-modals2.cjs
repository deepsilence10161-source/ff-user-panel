const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync('/home/user/ff-user-panel/tools/tri-e2e/.state/d103.json','utf8'));
const ALLOW = /QA-|QA1|Ambala|TQ|Raistar|Bermuda|SOLO|DUO|SQUAD|ALL|COIN|UID|IGN|FF |Mini eSports|mini eSports|Tournament Platform|K\/M|XP|Lv|AM|PM|https|www|\d{3,}|₹|win by|vs|VS|HALAL|UPI|Free Fire|Battle Royale/gi;
(async () => {
  const b = await chromium.launch({ args: ['--disable-dev-shm-usage','--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('appLang','hi'); localStorage.setItem('tutorialSeen','1'); sessionStorage.setItem('vn_shown_this_launch','1'); } catch(e){} });
  const p = await ctx.newPage();
  await p.goto('https://deepsilence10161-source.github.io/ff-user-panel/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa1.email, ACCT.qa1.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(3000);
  const dismiss = async () => { try { const sg = p.locator('button:has-text("Samajh")'); const c = await sg.count(); for (let i=0;i<c;i++){ const el=sg.nth(i); if (await el.isVisible()) { await el.click({timeout:2000, force:true}).catch(()=>{}); await p.waitForTimeout(500);} } } catch(e){} };
  await dismiss();
  const dump = () => p.evaluate((allowSrc) => {
    const ALLOW = new RegExp(allowSrc, 'i');
    const out = [];
    document.querySelectorAll('.modal-sheet, [class*="sheet"], .modal, [class*="modal"]').forEach(sh => {
      const st = (sh.getAttribute && sh.getAttribute('style')) || '';
      if (/display:\s*none/.test(st)) return;
      const w2 = document.createTreeWalker(sh, NodeFilter.SHOW_TEXT, null); let m;
      while ((m = w2.nextNode())) { const t=(m.nodeValue||'').trim(); if (t && t.length>=4 && t.length<=70 && /[A-Za-z]{3,}/.test(t) && !ALLOW.test(t)) out.push(t); }
    });
    return [...new Set(out)].slice(0, 25);
  }, ALLOW.source);
  const res = {};
  const openers = ['showCoinHistory','showHowRankWorks','showAchievements','showCosmeticsStore','showCityLeaderboard','openSupport','showJoinClanByCode'];
  for (const fn of openers) {
    await p.evaluate(f => { try { window[f] && window[f](); } catch(e){} }, fn);
    await p.waitForTimeout(1800); await dismiss();
    res[fn] = await dump();
    await p.evaluate(() => { try { window.closeCoinShop && window.closeCoinShop(); window.closeModal && window.closeModal(); window.closeSupport && window.closeSupport(); document.querySelectorAll('.modal-bg,.overlay').forEach(o=>{ try{o.click();}catch(e){} }); } catch(e){} });
    await p.waitForTimeout(600);
  }
  console.log(JSON.stringify(res, null, 1));
  await b.close();
})();
