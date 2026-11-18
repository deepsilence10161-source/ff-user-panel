'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const ACCT = JSON.parse(fs.readFileSync(__dirname + '/../tri-e2e/.state/d103.json', 'utf8'));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 950 }, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  const bad = [];
  p.on('response', async r => { if (r.status() >= 400 && r.url().includes('supabase.co')) { let t = ''; try { t = (await r.text()).slice(0, 140); } catch (e) {} bad.push(r.status() + ' ' + r.url().slice(45, 165) + ' => ' + t); } });
  p.on('console', m => { const t = m.text(); if (/Bridge.*(FAILED|fallback)|42703/i.test(t)) bad.push('CONSOLE: ' + t.slice(0, 160)); });
  await p.goto('https://deepsilence10161-source.github.io/ff-admin-panel/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForFunction(() => window.auth || window.firebase, null, { timeout: 30000 });
  await p.evaluate(([e, w]) => window.auth.signInWithEmailAndPassword(e, w), [ACCT.adm1.email, ACCT.adm1.password]);
  await p.waitForTimeout(5000);
  for (let i = 0; i < 3; i++) { const d = await p.evaluate(mail => { const inp = [...document.querySelectorAll('input')].find(x => x.offsetParent && /admin email/i.test(x.placeholder || '')); const btn = [...document.querySelectorAll('button')].find(x => x.offsetParent && /Trust This Device/i.test(x.textContent || '')); if (btn) { if (inp) { const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; set.call(inp, mail); inp.dispatchEvent(new Event('input', { bubbles: true })); } btn.click(); return 1; } const acc = [...document.querySelectorAll('button,a')].find(x => x.offsetParent && /Access Admin Panel/i.test(x.textContent || '')); if (acc) { acc.click(); return 2; } return 0; }, ACCT.adm1.email); if (!d) break; await p.waitForTimeout(1500); }
  await p.waitForTimeout(3000);
  const ids = await p.evaluate(() => { const s = []; [...document.querySelectorAll('[onclick*="showSection("]')].forEach(e => { const m = String(e.getAttribute('onclick')).match(/showSection\(\s*'([^']+)'/); if (m && !s.includes(m[1])) s.push(m[1]); }); return s; });
  p.on('response', async r => { if (r.status() >= 400 && r.url().includes('admin_activity_log')) { let t=''; try{t=await r.text();}catch(e){} console.log('LOG400 BODY:', t.slice(0, 300)); const rq = r.request(); console.log('LOG400 METHOD:', rq.method(), 'POSTDATA:', (rq.postData()||'').slice(0, 300)); } });
  for (const sid of ids.slice(0, 6)) {
    await p.evaluate(i => { try { window.showSection(i); } catch (e) {} const el = [...document.querySelectorAll('[onclick]')].find(e => (e.getAttribute('onclick') || '').includes("showSection('" + i + "'")); if (el) el.click(); }, sid);
    await p.waitForTimeout(1300);
  }
  await p.waitForTimeout(2500);
  console.log('BAD(' + bad.length + '):'); [...new Set(bad)].slice(0, 30).forEach(x => console.log(' ', x));
  await b.close();
})();
