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
  await p.evaluate(([e,w]) => window.auth.signInWithEmailAndPassword(e,w), [ACCT.qa2.email, ACCT.qa2.password]);
  await p.waitForFunction(() => window.U && window.curScr, null, { timeout: 30000 });
  await p.waitForTimeout(3000);
  const dismiss = async () => { try { const sg = p.locator('button:has-text("Samajh")'); const c = await sg.count(); for (let i=0;i<c;i++){ const el=sg.nth(i); if (await el.isVisible()) { await el.click({timeout:2500, force:true}).catch(()=>{}); await p.waitForTimeout(600);} } } catch(e){} };
  await dismiss();
  /* home: tap first match card */
  await p.evaluate(() => { const c = document.querySelector('.mc-card, [class*="mc-"][onclick]'); if (c) c.click(); });
  await p.waitForTimeout(2000); await dismiss();
  await p.screenshot({ path: 'reports/ui-sweep/z29-hi-joinsheet.png' });
  await p.evaluate(() => { try { window.closeModal && window.closeModal(); document.querySelectorAll('.modal-bg,.overlay').forEach(o=>o.click()); } catch(e){} });
  await p.waitForTimeout(700);
  /* matches: tap first completed row */
  await p.evaluate(() => window.navTo('matches')); await p.waitForTimeout(3000); await dismiss();
  const opened = await p.evaluate(() => {
    const els = [...document.querySelectorAll('#scrMatches [onclick]')];
    for (const el of els) {
      const oc = el.getAttribute('onclick') || '';
      const m = oc.match(/showResultPage\('([^']+)'\)/) || oc.match(/showDet\('([^']+)'\)/);
      if (m) { try { if (window.showDet) window.showDet(m[1]); else if (window.showResultPage) window.showResultPage(m[1]); return m[1]; } catch (e) {} }
    }
    return null;
  });
  await p.waitForTimeout(2500); await dismiss();
  await p.screenshot({ path: 'reports/ui-sweep/z29-hi-result.png' });
  console.log(JSON.stringify({ opened }));
  await b.close();
})();
