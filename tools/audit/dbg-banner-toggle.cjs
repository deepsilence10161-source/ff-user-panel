'use strict';
/* ================================================================
   dbg-banner-toggle.cjs — OWNER ORDER 2026-11-24 ka end-to-end proof
   ----------------------------------------------------------------
   "banner change band kar dete hain usse ui bigadta hai" +
   "admin panel me setting section me ise on off karne ka option rakh dena"

   Ye probe TEEN cheezein asli cheezon par sabit karta hai (koi mock UI nahi):
     A. ADMIN panel  → Settings → App Settings me "Profile Banner Change"
        card dikhta hai (self-healing inject, kyunki _renderAppSettings async
        innerHTML wipe karta hai), default OFF, aur uska save MERGE-ONLY hai
        (live_config ki baaki keys ka count badalta nahi).
     B. USER panel (mobile viewport) → flag OFF par banner upload BLOCK:
        settings sheet me label "(OFF)", file choose karne par clear toast,
        aur uploader (window.uploadBannerImage) tak flow pahunchta hi nahi.
     C. ADMIN ON karta hai → DB flag 1 → USER par premium banner flow wapas
        (uploader stub call hota hai) → ADMIN OFF → DB 0 → USER phir block.
     D. Bonus: naya admin card MOBILE (360x800) par comfortable hai —
        koi horizontal overflow nahi, save button >= 40px tall.

   ⚠️ Production storage par QA ka banner likha nahi jata: uploader STUB hota
      hai (cb(null) → app ka apna "failed save restore" path). Isi wajah se
      QA residue cleanup me storage object nahi bachta.

   Env:  RUN (default bnrtgl2)  ADMIN_BASE  USER_BASE  STATE_DIR
   Run:  node tools/audit/dbg-banner-toggle.cjs
   Exit: 0 = sab PASS, 1 = koi FAIL, 2 = crash
   ================================================================ */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RUN        = process.env.RUN || 'bnrtgl2';
const ADMIN_BASE = process.env.ADMIN_BASE || 'http://127.0.0.1:8095';
const USER_BASE  = process.env.USER_BASE  || 'http://127.0.0.1:8092';
const STATE_DIR  = process.env.STATE_DIR  || 'tools/tri-e2e/.state';
/* DSF=1 → mobile contexts me deviceScaleFactor 1 (chhoti sandbox RAM me renderer
   'Target crashed' se bachne ke liye; assertions par koi asar nahi, sirf pixels). */
const DSF        = Number(process.env.DSF || 2);
const SB_URL     = 'https://hddhkculuyrfoevxmlwy.supabase.co';
const SB_KEY     = fs.readFileSync('/home/user/.secrets/supabase_service_role', 'utf8').trim();

const RESULTS = [];
function check(name, pass, detail) {
  RESULTS.push({ name, pass: !!pass, detail: detail === undefined ? '' : String(detail) });
  console.log((pass ? '  ✓ ' : '  ✗ ') + name + (detail !== undefined && detail !== '' ? '   [' + detail + ']' : ''));
}
function step(t) { console.log('\n── ' + t + ' ' + '─'.repeat(Math.max(0, 62 - t.length))); }

/* poll helper — CSP unsafe-eval ki wajah se waitForFunction avoid karte hain */
async function poll(page, fn, arg, timeout, label) {
  const t0 = Date.now();
  let last;
  while (Date.now() - t0 < (timeout || 20000)) {
    try { last = await page.evaluate(fn, arg); } catch (e) { last = { err: String(e.message || e).slice(0, 80) }; }
    if (last && last.ok) return last;
    await page.waitForTimeout(250);
  }
  throw new Error('poll timeout: ' + (label || 'fn') + ' last=' + JSON.stringify(last).slice(0, 200));
}

async function dbRead() {
  const r = await fetch(SB_URL + '/rest/v1/app_settings?key=eq.live_config&select=key,value', {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
  });
  const d = await r.json();
  if (!Array.isArray(d) || !d.length) return { flag: null, keys: 0, raw: JSON.stringify(d).slice(0, 120) };
  const v = d[0].value || {};
  return { flag: v.bannerChangeEnabled == null ? null : Number(v.bannerChangeEnabled), keys: Object.keys(v).length };
}

/* QA admin ka users.is_admin — admin panel ka admin-gateway shim Firebase token se
   privileged Supabase token tabhi banata hai jab ye true ho. False hone par client
   ANON key par reh jaata hai aur app_settings write RLS 42501 deta hai — ye APP ka
   defect nahi, harness (QA account) ki state hai, isliye alag se check karte hain. */
async function dbIsAdmin(uid) {
  const r = await fetch(SB_URL + '/rest/v1/users?id=eq.' + encodeURIComponent(uid) + '&select=id,is_admin', {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
  });
  const d = await r.json();
  return Array.isArray(d) && d.length ? !!d[0].is_admin : null;
}

/* 900x300 solid PNG (chhoti, valid image/* file) */
function pngBuffer() {
  const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FAP5FDvcfRYWgAAAAAElFTkSuQmCC';
  return Buffer.from(b64, 'base64');
}

(async () => {
  const state = JSON.parse(fs.readFileSync(path.join(STATE_DIR, RUN + '.json'), 'utf8'));
  console.log('RUN=' + RUN + '  admin=' + state.admin.email + '  player=' + state.player.email);
  console.log('ADMIN_BASE=' + ADMIN_BASE + '  USER_BASE=' + USER_BASE);

  const base = await dbRead();
  step('PHASE 0 — DB baseline');
  check('live_config.bannerChangeEnabled = 0 (owner default OFF)', base.flag === 0, 'flag=' + base.flag + ' keys=' + base.keys);
  const KEY_COUNT = base.keys;
  const isAdm = await dbIsAdmin(state.admin.uid);
  check('QA admin ka users.is_admin = true (admin-gateway isi se privileged token deta hai)', isAdm === true, 'uid=' + state.admin.uid + ' is_admin=' + isAdm);
  if (isAdm !== true) {
    console.log('\n❌ HARNESS PROBLEM (app defect NAHI): QA admin ka users.is_admin ' + isAdm + ' hai.\n' +
      '   Admin panel ka syncFirebaseToken/admin-gateway shim tabhi privileged Supabase token\n' +
      '   deta hai jab users.is_admin true ho; warna client anon key par rehta hai aur\n' +
      '   app_settings write RLS 42501 (new row violates row-level security) deta hai.\n' +
      '   Fix: update users set is_admin=true where id=\'' + state.admin.uid + '\';  (ya naya QA run banao)\n');
    process.exit(2);
  }

  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--js-flags=--max-old-space-size=384'] });
  const PNG = pngBuffer();

  /* ══════════ ADMIN ══════════ */
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const pa = await ctxA.newPage();
  const aerr = [];
  pa.on('pageerror', e => aerr.push(String(e.message || e).slice(0, 120)));

  step('PHASE 1 — ADMIN panel: card render (Settings → App Settings)');
  await pa.goto(ADMIN_BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await poll(pa, () => ({ ok: !!(window.auth && window.firebase) }), null, 40000, 'window.auth');
  await pa.evaluate(([e, p]) => window.auth.signInWithEmailAndPassword(e, p), [state.admin.email, state.admin.password]);
  await poll(pa, () => ({ ok: !!(document.getElementById('mainApp') && window._supa) }), null, 45000, 'mainApp+_supa');
  /* New-Device verify modal (QA session) */
  await pa.evaluate((em) => {
    var inp = Array.from(document.querySelectorAll('input')).find(i => (i.placeholder || '').toLowerCase().indexOf('admin email') > -1);
    if (inp) {
      inp.value = em; inp.dispatchEvent(new Event('input', { bubbles: true }));
      var btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').indexOf('Trust This Device') > -1);
      if (btn) btn.click();
    }
  }, state.admin.email);
  await pa.waitForTimeout(2500);

  await pa.evaluate(() => { window.showSection('settings', null); window.loadAppSettings(); });
  const card = await poll(pa, () => {
    const c = document.getElementById('bannerToggleCard');
    if (!c) return { ok: false };
    const box = document.getElementById('as_bannerChangeEnabled');
    const lbl = document.getElementById('as_bannerChangeEnabled_lbl');
    const host = document.getElementById('appSettingsContent');
    return {
      ok: !!box,
      checked: box ? box.checked : null,
      label: lbl ? lbl.textContent.trim() : '',
      saveBtn: !!document.getElementById('bannerToggleSave'),
      msg: (document.getElementById('bannerToggleMsg') || {}).textContent || '',
      first: host && host.firstElementChild ? (host.firstElementChild.id || host.firstElementChild.className || '?') : '',
      contentLen: host ? host.innerHTML.length : 0,
    };
  }, null, 40000, '#bannerToggleCard');
  check('admin card #bannerToggleCard render hua (self-healing inject)', true, 'appSettingsContent=' + card.contentLen + 'B, firstKid=' + card.first);
  check('toggle default UNCHECKED (OFF)', card.checked === false, 'checked=' + card.checked);
  check('label me OFF likha hai', /OFF/i.test(card.label), card.label);
  check('apna Save button hai (merge-only)', card.saveBtn === true);
  await poll(pa, () => {
    const m = (document.getElementById('bannerToggleMsg') || {}).textContent || '';
    return { ok: /DB me abhi/.test(m) || /❌/.test(m), msg: m };
  }, null, 20000, 'bannerToggleMsg db-read').then(r => check('card ne DB se value padh li', /DB me abhi OFF \(0\)/.test(r.msg), r.msg)).catch(e => check('card ne DB se value padh li', false, e.message));

  /* ══════════ USER (mobile) ══════════ */
  const ctxU = await browser.newContext({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: DSF,
  });
  await ctxU.addInitScript((uid) => {
    try {
      localStorage.setItem('ffOnbV1', '1');
      localStorage.setItem('tutorialSeen', '1');
      localStorage.setItem('tutorialSeen_' + uid, '1');
      /* referral-code popup sirf PEHLE login par aata hai (js/referral-system-fix.js
         _refDone_<uid> dekhta hai). QA player returning user ki tarah behave kare,
         warna screenshot me sheet/toast ke upar popup ka blur aa jaata hai. */
      localStorage.setItem('_refDone_' + uid, '1');
    } catch (e) {}
  }, state.player.uid);
  const pu = await ctxU.newPage();
  const uerr = [];
  pu.on('pageerror', e => uerr.push(String(e.message || e).slice(0, 120)));

  async function userBoot() {
    await pu.goto(USER_BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await poll(pu, () => ({ ok: !!(window.auth && window.firebase) }), null, 40000, 'u:window.auth');
    if (!(await pu.evaluate(() => !!(window.U && window.U.uid)))) {
      await pu.evaluate(([e, p]) => window.auth.signInWithEmailAndPassword(e, p), [state.player.email, state.player.password]);
    }
    await poll(pu, () => ({ ok: !!(window.UD && window.UD.ign) }), null, 45000, 'u:UD.ign');
    /* hooks: toast capture + uploader stub + rpc recorder */
    await pu.evaluate(() => {
      window.__toasts = []; window.__bannerCalls = []; window.__rpcs = [];
      const t = window.toast;
      window.toast = function (m, k) { try { window.__toasts.push(String(m)); } catch (e) {} return t ? t.apply(this, arguments) : undefined; };
      window.uploadBannerImage = function (d, cb) { window.__bannerCalls.push(String(d).slice(0, 24)); if (cb) cb(null); };
      try {
        const s = window._supa;
        if (s && !s.__rpcHooked) {
          const orig = s.rpc.bind(s);
          s.rpc = function (n) { try { window.__rpcs.push(String(n)); } catch (e) {} return orig.apply(null, arguments); };
          s.__rpcHooked = true;
        }
      } catch (e) {}
    });
    const cfg = await poll(pu, () => ({
      ok: !!(window.CFG && window.CFG.bannerChangeEnabled !== undefined),
      flag: window.CFG ? Number(window.CFG.bannerChangeEnabled || 0) : null,
      premium: window.isPremiumActive ? window.isPremiumActive() : null,
    }), null, 40000, 'u:CFG.bannerChangeEnabled');
    return cfg;
  }

  async function userTryBanner() {
    await pu.evaluate(() => { window.__toasts = []; window.__bannerCalls = []; window.__rpcs = []; });
    await pu.evaluate(() => { window.navTo('profile'); });
    await pu.waitForTimeout(1800);
    const sheet = await pu.evaluate(() => {
      window.showProfileSettings();
      const s = document.getElementById('profSettingsSheet');
      if (!s) return { ok: false };
      const rows = Array.from(s.querySelectorAll('div,span,button')).map(e => (e.textContent || '').trim());
      const row = rows.find(t => /^Change Banner Photo/.test(t) && t.length < 40);
      return { ok: true, row: row || '', input: !!document.getElementById('profBannerIn') };
    });
    if (!sheet.ok) throw new Error('profile settings sheet nahi khula');
    await pu.setInputFiles('#profBannerIn', { name: 'qa-banner.png', mimeType: 'image/png', buffer: PNG });
    await pu.waitForTimeout(2500);
    const out = await pu.evaluate(() => ({
      toasts: window.__toasts.slice(0, 6),
      calls: window.__bannerCalls.length,
      rpcs: window.__rpcs.slice(0, 8),
    }));
    out.row = sheet.row;
    out.input = sheet.input;
    return out;
  }

  step('PHASE 2 — USER (flag OFF): banner change block');
  const cfg0 = await userBoot();
  check('user app ko CFG flag mila = 0', cfg0.flag === 0, 'CFG.bannerChangeEnabled=' + cfg0.flag);
  check('QA player premium active hai (gate ka agla step prove karne ke liye)', cfg0.premium === true, 'isPremiumActive()=' + cfg0.premium);
  const off1 = await userTryBanner();
  check('settings sheet me label "Change Banner Photo (OFF)"', /\(OFF\)/.test(off1.row), off1.row);
  check('file input waise hi maujood (layout/DOM nahi toda)', off1.input === true);
  check('block toast dikha', off1.toasts.some(t => /Banner change abhi admin ne band kiya hai/.test(t)), JSON.stringify(off1.toasts));
  /* D93 owner rule: update ki Asli screenshot — ye LIVE user app (Pages/APK web view) ka
     OFF state hai: settings sheet me "Change Banner Photo (OFF)" + block toast. */
  await pu.screenshot({ path: 'reports/release-evidence/banner-off-user-live.png' }).catch(() => {});
  check('uploader tak flow NAHI pahuncha', off1.calls === 0, 'uploadBannerImage calls=' + off1.calls);
  /* ⚠️ 2026-11-24: app boot par premium monthly-bonus claim jaisa UNRELATED rpc
     chalta hai (QA player premium hai) — isliye sirf banner/upload related rpc
     ko violation maano, warna jhootha FAIL aata tha. */
  const badRpc = off1.rpcs.filter(n => /banner|upload|image|imgbb|storage|avatar/i.test(n));
  check('koi banner/upload RPC NAHI chala', badRpc.length === 0, 'banner-rpcs=' + JSON.stringify(badRpc) + ' (boot-rpcs=' + JSON.stringify(off1.rpcs) + ')');

  step('PHASE 3 — ADMIN ON karta hai (merge-only save)');
  await pa.evaluate(() => {
    const b = document.getElementById('as_bannerChangeEnabled');
    b.checked = true;
    b.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('bannerToggleSave').click();
  });
  const onMsg = await poll(pa, () => {
    const m = (document.getElementById('bannerToggleMsg') || {}).textContent || '';
    return { ok: /ON saved/.test(m) || /❌/.test(m), msg: m };
  }, null, 25000, 'save ON');
  check('admin save ON → status ✅', /ON saved/.test(onMsg.msg), onMsg.msg.slice(0, 90));
  const dbOn = await dbRead();
  check('DB flag = 1', dbOn.flag === 1, 'flag=' + dbOn.flag);
  check('MERGE-ONLY: live_config keys ka count same', dbOn.keys === KEY_COUNT, 'keys ' + KEY_COUNT + ' → ' + dbOn.keys);

  step('PHASE 4 — USER (flag ON): premium banner flow wapas');
  const cfg1 = await userBoot();
  check('user app ko CFG flag mila = 1 (realtime/refresh)', cfg1.flag === 1, 'CFG.bannerChangeEnabled=' + cfg1.flag);
  const on1 = await userTryBanner();
  check('settings sheet me label wapas "Change Banner Photo" (OFF hata)', !/\(OFF\)/.test(on1.row), on1.row);
  check('block toast NAHI aaya', !on1.toasts.some(t => /band kiya hai/.test(t)), JSON.stringify(on1.toasts));
  check('uploader tak flow PAHUNCHA (stub call = 1)', on1.calls === 1, 'uploadBannerImage calls=' + on1.calls);
  await pu.screenshot({ path: 'reports/release-evidence/banner-on-user-live.png' }).catch(() => {});  /* admin ON kare to wahi screen wapas */

  step('PHASE 5 — ADMIN wapas OFF (owner ka default)');
  await pa.evaluate(() => {
    const b = document.getElementById('as_bannerChangeEnabled');
    b.checked = false;
    b.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('bannerToggleSave').click();
  });
  const offMsg = await poll(pa, () => {
    const m = (document.getElementById('bannerToggleMsg') || {}).textContent || '';
    return { ok: /OFF saved/.test(m) || /❌/.test(m), msg: m };
  }, null, 25000, 'save OFF');
  check('admin save OFF → status ✅', /OFF saved/.test(offMsg.msg), offMsg.msg.slice(0, 90));
  const dbOff = await dbRead();
  check('DB flag wapas = 0', dbOff.flag === 0, 'flag=' + dbOff.flag);
  check('MERGE-ONLY (2nd save): keys same', dbOff.keys === KEY_COUNT, 'keys=' + dbOff.keys);

  const cfg2 = await userBoot();
  const off2 = await userTryBanner();
  check('user app phir block (flag 0)', off2.calls === 0 && off2.toasts.some(t => /band kiya hai/.test(t)), 'cfg=' + cfg2.flag + ' calls=' + off2.calls);
  check('label phir "(OFF)"', /\(OFF\)/.test(off2.row), off2.row);

  /* user page ka kaam khatam → context band karo taaki aage ke phases (admin mobile)
     ke liye RAM khali rahe. uerr array memory me hai, PHASE 8 me use hota rahega. */
  await ctxU.close().catch(() => {});

  step('PHASE 6 — v2 App Settings ka koi toot nahi gaya');
  const v2 = await pa.evaluate(() => {
    const host = document.getElementById('appSettingsContent');
    const ids = Array.from(host.querySelectorAll('[id^="as_"]')).map(e => e.id);
    return {
      cards: host.querySelectorAll(':scope > div').length,
      asIds: ids.length,
      hasForceUpdate: ids.indexOf('as_appLatestVersion') > -1,
      hasAutoSquad: ids.indexOf('as_autoSquadEnabled') > -1,
      hasWatchEarn: ids.indexOf('as_watchEarnEnabled') > -1,
      saveAll: !!Array.from(document.querySelectorAll('button')).find(b => /Save All Settings/i.test(b.textContent || '')),
      bannerIds: ids.filter(i => /banner/i.test(i)),
    };
  });
  check('v2 ke apne fields zinda (as_appLatestVersion)', v2.hasForceUpdate, 'as_* count=' + v2.asIds);
  check('v2 Auto Squad toggle zinda', v2.hasAutoSquad);
  check('v2 Watch & Earn toggle zinda', v2.hasWatchEarn);
  check('"Save All Settings" button zinda (v2 ka apna save)', v2.saveAll);
  check('banner ids sirf hamare hain', v2.bannerIds.join(',') === 'as_bannerChangeEnabled,as_bannerChangeEnabled_lbl', v2.bannerIds.join(','));

  /* desktop Save button ka size YAHIN nap lo: PHASE 7 me mobile se compare hota hai,
     aur tab tak desktop context band ho chuka hoga (chhoti sandbox RAM ke liye). */
  const deskBtn = await pa.evaluate(() => {
    const b = document.getElementById('bannerToggleSave');
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { h: Math.round(r.height), w: Math.round(r.width) };
  }).catch(() => null);
  await ctxA.close().catch(() => {});   /* desktop admin page band — RAM free (aerr array safe) */

  step('PHASE 7 — naya admin card MOBILE (360x800) par comfortable');
  /* ✅ 2026-11-24 fix: pehle desktop page ka viewport resize karke nap rahe the —
     admin ka mobile layout (media queries + d33-mobile-ui.js) tab apply hi nahi
     hota, isliye jhootha 240px overflow dikha. Ab ALAG mobile context
     (isMobile + hasTouch, viewport pehle se 360x800) me fresh login. */
  const ctxM = await browser.newContext({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: DSF });
  const pm = await ctxM.newPage();
  const merr = [];
  pm.on('pageerror', e => merr.push(String(e.message || e).slice(0, 120)));
  await pm.goto(ADMIN_BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await poll(pm, () => ({ ok: !!(window.auth && window.firebase) }), null, 40000, 'm:auth');
  await pm.evaluate(([e, p]) => window.auth.signInWithEmailAndPassword(e, p), [state.admin.email, state.admin.password]);
  await poll(pm, () => ({ ok: !!(document.getElementById('mainApp') && window._supa) }), null, 45000, 'm:mainApp');
  await pm.evaluate((em) => {
    var inp = Array.from(document.querySelectorAll('input')).find(i => (i.placeholder || '').toLowerCase().indexOf('admin email') > -1);
    if (inp) {
      inp.value = em; inp.dispatchEvent(new Event('input', { bubbles: true }));
      var btn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').indexOf('Trust This Device') > -1);
      if (btn) btn.click();
    }
  }, state.admin.email);
  await pm.waitForTimeout(2500);
  const mobHome = await pm.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, vw: window.innerWidth }));
  check('mobile: dashboard par koi horizontal overflow nahi', mobHome.over <= 1, 'overflowPx=' + mobHome.over + ' (vw=' + mobHome.vw + ')');
  await pm.evaluate(() => { window.showSection('settings', null); window.loadAppSettings(); });
  await poll(pm, () => ({ ok: !!document.getElementById('bannerToggleCard') }), null, 40000, 'm:card');
  await pm.waitForTimeout(1500);
  const mob = await pm.evaluate(() => {
    const c = document.getElementById('bannerToggleCard');
    const r = c.getBoundingClientRect();
    const btn = document.getElementById('bannerToggleSave').getBoundingClientRect();
    const sl = c.querySelector('.toggle-slider');
    const s = sl ? sl.getBoundingClientRect() : { width: 0, height: 0 };
    const wide = [];
    document.querySelectorAll('#appSettingsContent *').forEach(el => {
      const b = el.getBoundingClientRect();
      if (b.width > 0 && (b.right > window.innerWidth + 2 || b.width > window.innerWidth + 2)) wide.push((el.id || el.tagName) + ':' + Math.round(b.width));
    });
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      cardW: Math.round(r.width), cardLeft: Math.round(r.left), cardRight: Math.round(r.right),
      btnH: Math.round(btn.height), btnW: Math.round(btn.width),
      slH: Math.round(s.height), slW: Math.round(s.width),
      vw: window.innerWidth, wide: wide.slice(0, 5),
    };
  });
  check('mobile: settings par koi horizontal overflow nahi', mob.overflow <= 1, 'overflowPx=' + mob.overflow + ' wide=' + JSON.stringify(mob.wide));
  check('mobile: card viewport ke andar', mob.cardLeft >= 0 && mob.cardRight <= mob.vw + 1, 'left=' + mob.cardLeft + ' right=' + mob.cardRight + ' w=' + mob.cardW + ' vw=' + mob.vw);
  /* ⚠️ 2026-11-24 (root cause mila): admin ke APNE css me
       js/admin-ui-v10.css → @media(max-width) →
       "table button, .table-wrapper button, .btn, button.btn-ghost, .btn-xs {
          min-height: 38px !important; padding-top/bottom: 9px !important;
          font-size: 13px !important }"
     stylesheet !important inline style ko hara deta hai, isliye mobile par
     har admin button 38px ka hota hai — ye panel ka APNA tap-target standard
     hai (D33 mobile polish), hamare card ki kami nahi. Isliye mobile par
     house-standard (>=38) assert karte hain, aur desktop par apna 44px.
     Card ko jaan-boojh kar 44px !important se alag NAHI banaya — warna
     mobile par hamara button baaki sab admin buttons se bada dikhta. */
  check('mobile: Save button panel ke house standard ke barabar (>=38px)', mob.btnH >= 38, 'h=' + mob.btnH + ' w=' + mob.btnW + ' (admin-ui-v10.css mobile rule = 38px !important)');
  /* deskBtn upar (PHASE 6 ke baad) desktop context band hone se PEHLE nap liya gaya tha */
  check('desktop (1280): Save button >=44px tall (hamara inline min-height)', deskBtn && deskBtn.h >= 44, deskBtn ? 'h=' + deskBtn.h + ' w=' + deskBtn.w : 'button nahi mila');
  check('mobile: toggle switch tap-friendly (>=20px)', mob.slH >= 20 && mob.slW >= 20, 'slider h=' + mob.slH + ' w=' + mob.slW);
  check('mobile admin: koi pageerror nahi', merr.length === 0, JSON.stringify(merr.slice(0, 3)));
  await pm.screenshot({ path: 'reports/release-evidence/banner-toggle-admin-360.png' }).catch(() => {});

  step('PHASE 8 — page errors');
  check('admin panel: koi pageerror nahi', aerr.length === 0, JSON.stringify(aerr.slice(0, 3)));
  check('user panel: koi pageerror nahi', uerr.length === 0, JSON.stringify(uerr.slice(0, 3)));

  await browser.close();

  const failed = RESULTS.filter(r => !r.pass);
  console.log('\n══════════════════════════════════════════════════════════');
  console.log('BANNER-TOGGLE PROBE  PASS: ' + (RESULTS.length - failed.length) + ' | FAIL: ' + failed.length);
  if (failed.length) { console.log('FAILED:'); failed.forEach(f => console.log('  ✗ ' + f.name + '  [' + f.detail + ']')); }
  const fin = await dbRead();
  console.log('FINAL DB STATE: bannerChangeEnabled=' + fin.flag + ' (keys=' + fin.keys + ')  ← 0 hona chahiye');
  console.log('══════════════════════════════════════════════════════════');
  process.exit(failed.length || fin.flag !== 0 ? 1 : 0);
})().catch(e => { console.error('CRASH: ' + (e && e.stack || e)); process.exit(2); });
