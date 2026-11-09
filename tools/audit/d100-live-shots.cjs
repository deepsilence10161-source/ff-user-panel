/* D100 LIVE evidence probe — released public build (same tree as APK) par
   logged-in mobile screenshots: premium chip (Gold icon+naam), clean title
   chip, dedupe profile, leaderboard medal IMAGES, city-gate + city board. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const CRED = process.env.CRED || 'tools/tri-e2e/.state/d100c.json';
const OUT = process.env.OUT || 'reports/release-evidence/20261109-0907/live-web-shots';
const BASE = process.env.BASE || 'https://deepsilence10161-source.github.io/ff-user-panel/';
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cred = JSON.parse(fs.readFileSync(CRED, 'utf8'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  /* ✅ onboarding Quick Tour boot se pehle hi disable (flag page scripts se pehle) */
  await ctx.addInitScript(() => { try { localStorage.setItem('ffOnbV1', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await page.evaluate(([em, pw]) => window.auth.signInWithEmailAndPassword(em, pw), [cred.player.email, cred.player.password]);
  await page.waitForFunction(() => window.UD && window.UD.ign, null, { timeout: 30000 });
  await page.evaluate(() => { try { localStorage.setItem('ffOnbV1', '1'); } catch (e) {} });
  await page.waitForTimeout(1500);
  /* onboarding/modals dismiss (referral sheet + verify nudge) — clean UI shots */
  const dismiss = async () => {
    await page.evaluate(() => {
      try { localStorage.setItem('ffOnbV1', '1'); } catch (e) {}
      const rp = document.getElementById('_refCodePopup'); if (rp) rp.remove();
      const vn = document.getElementById('vnNo'); if (vn) vn.click();
      document.querySelectorAll('.vnWrap,#vnWrap').forEach(el => el.remove());
      /* Quick Tour (5-step) — _tutDone modal band + seen-key set karta hai */
      if (window._tutDone) { try { window._tutDone(); } catch (e) {} }
      /* age-gate (18+) form bhar kar confirm — QA row only */
      const dob = document.getElementById('_mes_dob');
      const cbx = document.getElementById('_mes_age_cbx');
      if (dob && cbx) {
        dob.value = '1995-05-05'; cbx.checked = true;
        if (window.mesConfirmAge) { try { window.mesConfirmAge(); } catch (e) {} }
      }
    });
    await page.waitForTimeout(500);
  };
  await dismiss();

  /* 1) profile — premium Gold + clean title chip + dedupe */
  await page.evaluate(() => window.navTo('profile'));
  await page.waitForTimeout(1800);
  await dismiss();
  await page.screenshot({ path: OUT + '/01-profile-live.png' });

  /* 2) rank/leaderboard — medal images */
  await page.evaluate(() => window.navTo('rank'));
  await page.waitForTimeout(2200);
  await dismiss();
  await page.screenshot({ path: OUT + '/02-leaderboard-live.png' });

  /* 3) city gate (city unset) */
  await page.evaluate(() => { try { if (window.UD) { UD.city = null; UD.state = null; UD.locationSetAt = null; } } catch (e) {} window.showCityLeaderboard && window.showCityLeaderboard(); });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/03-citygate-live.png' });
  await page.evaluate(() => window.closeModal && window.closeModal());
  await page.waitForTimeout(400);

  /* 4) city set → My City board sirf apni city */
  await page.evaluate(async () => {
    await window._supa.from('users').update({ city: 'Ambala', state: 'Haryana' }).eq('id', window.U.uid);
    if (window.UD) { UD.city = 'Ambala'; UD.state = 'Haryana'; UD.locationSetAt = new Date().toISOString(); }
    window.showCityLeaderboard && window.showCityLeaderboard();
  });
  await page.waitForTimeout(1800);
  await dismiss();
  await page.screenshot({ path: OUT + '/04-cityboard-live.png' });

  console.log(JSON.stringify({ ok: true, shots: fs.readdirSync(OUT), pageErrors: errs.slice(0, 4) }));
  await browser.close();
})().catch(e => { console.error('FATAL', String(e).slice(0, 300)); process.exit(1); });
