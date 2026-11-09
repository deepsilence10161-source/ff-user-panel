/* D102 LIVE evidence probe — released public build par:
   (1) pc2 tier-pill: baked medal-emoji COVER + dynamic ASLI rank asset (Gold user),
   (2) cosmetics title purchase+equip → title CENTER,
   (3) home premium chip clean, (4) leaderboard medal images + emoji zero,
   (5) GPS-off guide modal, (6) global medal sweep.
   Usage: CRED=... OUT=... BASE=... node tools/audit/d102-live-shots.cjs */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const CRED = process.env.CRED || 'tools/tri-e2e/.state/d102a.json';
const OUT = process.env.OUT || 'reports/release-evidence/20261109-d102/live-web-shots';
const BASE = process.env.BASE || 'https://deepsilence10161-source.github.io/ff-user-panel/';
const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
const results = [];
function check(name, pass, extra) { results.push({ name, pass, extra: extra || '' }); console.log((pass ? '  ✓ ' : '  ✗ ') + name + (extra ? ' — ' + extra : '')); }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cred = JSON.parse(fs.readFileSync(CRED, 'utf8'));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => { try { localStorage.setItem('ffOnbV1', '1'); } catch (e) {} try { window.confirm = () => true; } catch (e) {} });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept().catch(() => {}));
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 150)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.auth && window.firebase, null, { timeout: 30000 });
  await page.evaluate(([em, pw]) => window.auth.signInWithEmailAndPassword(em, pw), [cred.player.email, cred.player.password]);
  await page.waitForFunction(() => window.UD && window.UD.ign, null, { timeout: 30000 });
  await page.evaluate(() => { try { localStorage.setItem('ffOnbV1', '1'); } catch (e) {} });
  await page.waitForTimeout(1500);
  const dismiss = async () => {
    await page.evaluate(() => {
      try { localStorage.setItem('ffOnbV1', '1'); } catch (e) {}
      const rp = document.getElementById('_refCodePopup'); if (rp) rp.remove();
      const vn = document.getElementById('vnNo'); if (vn) vn.click();
      document.querySelectorAll('.vnWrap,#vnWrap').forEach(el => el.remove());
      if (window._tutDone) { try { window._tutDone(); } catch (e) {} }
      const dob = document.getElementById('_mes_dob');
      const cbx = document.getElementById('_mes_age_cbx');
      if (dob && cbx) { dob.value = '1995-05-05'; cbx.checked = true; if (window.mesConfirmAge) { try { window.mesConfirmAge(); } catch (e) {} } }
    });
    await page.waitForTimeout(500);
  };
  await dismiss();

  /* ── 1) profile pc2: tier-pill cover + dynamic rank asset + title center ── */
  await page.evaluate(() => window.navTo('profile'));
  await page.waitForTimeout(2200); await dismiss();
  const pc2 = await page.evaluate(() => {
    var wrap = document.querySelector('[data-pc2="1"]');
    if (!wrap) return { has: false };
    var cov = wrap.querySelector('[data-pc2tiercover]');
    var ico = wrap.querySelector('[data-pc2tiericon]');
    var ttl = wrap.querySelector('[data-pc2lbl="title"]');
    var wr = wrap.getBoundingClientRect();
    var out = { has: true, cover: !!cov, icon: !!ico, iconSrc: ico ? (ico.getAttribute('src') || '') : '', iconLoaded: ico ? (ico.complete && ico.naturalWidth > 0) : false };
    if (ttl) { var tr = ttl.getBoundingClientRect(); out.titleText = (ttl.textContent || '').trim(); out.titleCenterPct = Math.round(((tr.left + tr.width / 2) - wr.left) / wr.width * 1000) / 10; }
    var tier = wrap.querySelector('[data-pc2lbl="tier"]');
    out.tierText = tier ? (tier.textContent || '').trim() : '';
    /* cover ke andar baked emoji pixel nahi: cover box me icon img hi hai */
    if (cov && ico) { var cr = cov.getBoundingClientRect(), ir = ico.getBoundingClientRect(); out.iconInsideCover = ir.left >= cr.left - 2 && ir.right <= cr.right + 2; }
    return out;
  });
  check('pc2: tier cover + dynamic icon', pc2.has && pc2.cover && pc2.icon && pc2.iconLoaded && /assets\/img\/ranks\//.test(pc2.iconSrc || ''),
        'src=' + (pc2.iconSrc || '').split('?')[0] + ' loaded=' + pc2.iconLoaded + ' insideCover=' + pc2.iconInsideCover);
  check('pc2: tier text = Gold (rank_points 700)', pc2.tierText === 'Gold', 'tier="' + pc2.tierText + '"');
  /* title purchase+equip (tag_beast) → center measure */
  const bought = await page.evaluate(async () => {
    try {
      var t = { id: 'tag_beast', price: 30, name: '\u26a1 BEAST MODE' };
      var owned = !!(window.UD.cosmetics && window.UD.cosmetics[t.id]);
      if (!owned) {
        var rpc = await window._supa.rpc('purchase_cosmetic', { p_cosmetic_key: t.id, p_price: t.price, p_display_name: t.name });
        if (!rpc.data || !rpc.data.ok) return { ok: false, why: 'rpc:' + JSON.stringify(rpc.data || rpc.error).slice(0, 80) };
      }
      if (window._loadExtras) window._loadExtras();
      await new Promise(r => setTimeout(r, 2500));
      var cur = null; try { cur = window.getEquippedCosmetic ? getEquippedCosmetic('tag') : null; } catch (e) {}
      if (!cur || cur.id !== t.id) {
        await window.toggleCosmeticEquip(t.id, null);
        await new Promise(r => setTimeout(r, 2000));
        if (window._loadExtras) window._loadExtras();
        await new Promise(r => setTimeout(r, 2000));
      }
      var eq = ''; try { eq = window.getEquippedTagText ? (getEquippedTagText() || '') : ''; } catch (e) {}
      var cur2 = null; try { cur2 = window.getEquippedCosmetic ? getEquippedCosmetic('tag') : null; } catch (e) {}
      return { ok: true, equipped: eq, eqId: cur2 ? cur2.id : '' };
    } catch (e) { return { ok: false, why: String(e).slice(0, 100) }; }
  });
  check('cosmetics title purchase+equip', bought.ok && bought.eqId !== '' && bought.equipped !== '', bought.ok ? 'eqId=' + bought.eqId + ' text="' + bought.equipped + '"' : bought.why);
  await page.evaluate(() => window.navTo('profile'));
  await page.waitForTimeout(2200); await dismiss();
  const pc2b = await page.evaluate(() => {
    var wrap = document.querySelector('[data-pc2="1"]'); if (!wrap) return {};
    var ttl = wrap.querySelector('[data-pc2lbl="title"]'); if (!ttl) return {};
    var wr = wrap.getBoundingClientRect(), tr = ttl.getBoundingClientRect();
    return { text: (ttl.textContent || '').trim(), centerPct: Math.round(((tr.left + tr.width / 2) - wr.left) / wr.width * 1000) / 10 };
  });
  check('pc2 title CENTER 48-52%', pc2b.centerPct >= 48 && pc2b.centerPct <= 52, 'text="' + pc2b.text + '" center=' + pc2b.centerPct + '%');
  await page.screenshot({ path: OUT + '/01-profile-gold-tiericon.png' });

  /* ── 2) home premium chip clean ── */
  await page.evaluate(() => window.navTo('home'));
  await page.waitForTimeout(2000); await dismiss();
  await page.screenshot({ path: OUT + '/02-home.png' });
  const homeTxt = await page.evaluate(() => document.body.innerText || '');
  check('home: Premium III literal zero', homeTxt.indexOf('Premium III') === -1);

  /* ── 3) leaderboard medals images ── */
  await page.evaluate(() => window.navTo('rank'));
  await page.waitForTimeout(2500); await dismiss();
  await page.screenshot({ path: OUT + '/03-leaderboard.png' });
  const rankInfo = await page.evaluate((medals) => {
    var txt = document.body.innerText || '';
    var hit = medals.filter(m => txt.indexOf(m) > -1);
    var imgs = Array.from(document.querySelectorAll('img[src*="assets/img/ranks/"]'));
    return { emojiHits: hit, n: imgs.length, loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length };
  }, MEDALS);
  check('leaderboard: emoji zero + images', rankInfo.emojiHits.length === 0 && rankInfo.loaded === rankInfo.n && rankInfo.n > 0, rankInfo.loaded + '/' + rankInfo.n);

  /* ── 4) loc guide modal ── */
  const guide = await page.evaluate(() => { try { window._locOffGuide(); return true; } catch (e) { return false; } });
  await page.waitForTimeout(700);
  const guideTxt = await page.evaluate(() => {
    var t = document.body.innerText || '';
    return { ok: t.indexOf('Location ON karo') > -1 && t.indexOf('Location Settings Kholo') > -1 };
  });
  await page.screenshot({ path: OUT + '/04-loc-guide.png' });
  check('loc-guide modal', guide && guideTxt.ok);
  await page.evaluate(() => { try { window.closeModal && closeModal(); } catch (e) {} });

  /* ── 5) global sweep ── */
  const sweep = await page.evaluate((medals) => medals.filter(m => (document.body.innerText || '').indexOf(m) > -1), MEDALS);
  check('global medal sweep (home)', sweep.length === 0, sweep.join(','));
  check('page errors zero', errs.length === 0, errs.slice(0, 3).join(' | '));

  const fail = results.filter(r => !r.pass).length;
  console.log('D102 LIVE PROBE: PASS ' + (results.length - fail) + ' | FAIL ' + fail);
  fs.writeFileSync(OUT + '/probe-results.json', JSON.stringify({ results, errs }, null, 2));
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('PROBE CRASH:', e.message); process.exit(2); });
