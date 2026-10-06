/* ================================================================
   APP CONFIG — features/app-config.js | MiniESports v3.0
   Source of truth: Supabase app_settings (key='live_config' + key='creator_system')
   ✅ B24/B26 (2026-10-07): Firebase fallback HATA diya (appSettings/liveConfig
   aur adminConfig/* dono mare hue paths the — admin panel 2026-08 se sirf
   Supabase likhta hai), aur video system ki saari keys gayi.
================================================================ */

/* Default config values */
window.CFG = {
  // Defaults — Firebase se override hota hai
  /* ✅ B31 (2026-10-07): `commission` default bhi hata — yeh marta hua key
     tha (upar _applyCfg me wajah likhi hai). Prize-calculator ka fee dikhane
     ka faisla alag hai (report me sawal khula hai). */
  matchReminderMins:  30,
  /* ✅ A9: purani admin broadcast naye users ko kitne din tak dikhe
     (0 = sab dikhe). Admin panel ke App Settings se badalta hai. */
  notifBroadcastDays: 7,
  autoSquadEnabled:   1,
  autoSquadTimeout:   15,
  watchEarnEnabled:   1,
  /* ✅ FIX (2026-10-06): interval 5 → 1. Pehle admin panel "2 coins / 5 min"
     deta tha par user panel "/min" dikhata tha — mismatch. Owner ne confirm
     kiya: 2 coins PER MINUTE hi sahi hai. Ab default 2 coins / 1 min hai aur
     user ko wahi dikhta hai (bina hardcode — config se). */
  watchCoinsPerInterval: 2,
  watchIntervalMins:  1,
  watchDailyLimitMins:30,
  seasonName:         'Season 1',
  seasonActive:       1,
  shareCoins:        20,
  missions: {
    /* ✅ BUG FIX (2026-09-16): daily_login and daily_checkin removed —
       see features/growth.js for the full explanation. Daily login /
       check-in ka reward ab dailyBonusRewards (neeche) se aata hai
       (B26, 2026-10-07 — pehle checkinCoins tha jo server padhta hi nahi
       tha); daily_match aur daily_kills3 alag, asli missions hain. */
    daily_match:     10,
    daily_kills3:    5,
    week_5matches:   50,
    week_top3:       30,
    week_share:      20,
  },
  streakMilestones: {
    3:  { coins: 20,   badge: null },
    7:  { coins: 100,  badge: '🔥 Unstoppable' },
    14: { coins: 200,  badge: null },
    30: { coins: 500,  badge: '⚡ Dedicated' },
    60: { coins: 1000, badge: '👑 Legend' },
    100:{ coins: 2000, badge: '🌟 Immortal' },
  },
  referralJoinCoins: 50,
  referralSDBonusDiamonds: 10,
  referralMatchCoins: 30,
  premium: {
    prices:  { 1: 49, 2: 99, 3: 199 },
    bonuses: { 1: 50, 2: 150, 3: 400 },
  },
  creatorMinPayout: 100,
  /* ✅ BUG 16 (2026-10-04): Manual payment (UPI QR) system — admin
     app_settings key='manual_payment' se configure karta hai
     (upiId, payeeName, qrImageUrl, instructions, minAmount).
     ✅ B22 (2026-10-06): qrImageUrl me ab aam taur par UPLOADED QR ka
     data-URI (data:image/png;base64,...) aata hai — admin panel me QR URL
     paste karne ki jagah seedha upload hota hai. http(s) link bhi chalta
     rahega (purani values tootni nahi chahiye). */
  manualPayment: {
    enabled: true,
    upiId: 'miniesports@upi',
    payeeName: 'Mini eSports',
    qrImageUrl: '',
    instructions: 'UPI app se paisa bhejo, phir screenshot + UTR number submit karo',
    minAmount: 10,
  },
  cosmetics: {
    frame_neon:   { name: 'Neon Frame',      price: 50,  icon: '🟢' },
    frame_fire:   { name: 'Fire Frame',       price: 75,  icon: '🔥' },
    frame_galaxy: { name: 'Galaxy Frame',     price: 100, icon: '🌌' },
    frame_gold:   { name: 'Gold Champion',    price: 150, icon: '🏆' },
    tag_beast:    { name: '⚡ BEAST MODE',    price: 30,  icon: '⚡' },
    tag_pro:      { name: '🎯 PRO PLAYER',    price: 30,  icon: '🎯' },
    tag_king:     { name: '👑 KING',          price: 50,  icon: '👑' },
    vip_slot:     { name: 'VIP Slot Pass',    price: 200, icon: '⭐' },
  },
  adCoinsPerWatch:  10,
  /* ── Paytm Instant Checkout (v32.6) ────────────────────────────────────
     Default: false — "Pay Instantly via Paytm" button hidden until admin
     enables it from Settings (after PAYTM_MID + PAYTM_MERCHANT_KEY secrets
     are set in Supabase). Toggle in Admin → Settings → Payment Settings.
     Admin ne enable kiya to yeh true ho jaata hai live config se. */
  paytmEnabled:     false,
  /* ✅ B23 (2026-10-06): Paytm (online) payment ki seema — ₹2000 se upar
     online payment allowed nahi (user ka niyam: ₹2000+ par shopkeeper
     charge/atki payment ka risk). Admin Settings se badli ja sakti hai. */
  paytmMaxTxn: 2000,
  adDailyLimit:     5,
  /* ✅ B26 (2026-10-07): checkinCoins / checkinStreakBonus7 hata diye — server
     (process_daily_checkin) inhe kabhi padhta hi nahi tha (params ignore).
     Daily check-in ka ek hi source: dailyBonusRewards (7-din cycle + day-30
     bonus) — admin Quick Tools ke "Daily Bonus Editor" se set hota hai. */
  dailyBonusRewards: {
    day1: 5, day2: 7, day3: 10, day4: 12, day5: 15, day6: 20, day7: 30,
    day30Bonus: 100,
  },
  /* ✅ B24 (2026-10-07): "Creator Video System" ki saari keys hata di gayi
     (videoEnabled, videoWatchCoins, videoDailyLimit, videoAutoHideReports,
     videoFalseReportPenalty, videoBannedKeywords, videoAllowedPlatforms) —
     wo feature live hi nahi tha (user panel me video dekhne wali screen nahi
     thi, admin me review page nahi thi, creator_videos khaali thi). User panel
     me sirf ASLI watch feature bacha: Watch & Earn (upar wali keys).
     ✅ coinMatchCommissionPct bhi hata (2026-10-04 se coin matches par
     commission nahi — koi ise padhta bhi nahi tha).
     Creator settings ab Supabase app_settings key='creator_system' se aati
     hain (_loadCreatorConfig neeche) — pehle yeh Firebase adminConfig/
     creatorSystem se aati thi jahan koi likhta hi nahi tha, isliye user ko
     admin ka set kiya hua rate kabhi milta hi nahi tha. */
  creatorMatchEnabled:     1,
  sdMatchCommissionPct:    15,
  commissionHoldDays:      7,
  maxCreatorMatches:       3,
  /* ✅ B25 (2026-10-06): minFollowersForSD hata diya — koi ise check nahi karta
     tha (admin row bhi hata di gayi hai), isliye dead setting rakhna galat tha. */

  /* ── Force Update Control (2026-07) ──────────────────────────────────
     Defaults are permissive (min version very low, force update OFF) so
     that if Supabase/Firebase are both unreachable on a fresh install,
     the app is NEVER accidentally locked out by a missing config. */
  appLatestVersion:        '1.0.0',
  appMinSupportedVersion:  '1.0.0',
  appApkUrl:               '',
  appForceUpdateEnabled:   false,
  appSupportContact:       '',
  appExpectedSigningHash:  '',
};

/* ✅ B26: daily check-in rewards ke do global — inse features-user.js ka asli
   Check-In button (window.doCheckIn) aur features/streak.js dono padhte hain.
   Defaults wahi hain jo server (process_daily_checkin) ke constants hain
   ([5,7,10,12,15,20,30] + day-30 par 100), taki config load hone se pehle bhi
   UI jhooth na bole. Live values _applyCfg() me live_config.dailyBonusRewards
   se aati hain (pehle yeh Firebase appSettings/dailyBonusRewards se aati thi —
   mara hua path). */
window._adminDailyBonusRewards = [5, 7, 10, 12, 15, 20, 30];
window._adminDay30Bonus = 100;

/* Apply config from any source */
function _applyCfg(c) {
  if (!c) return;
  /* ✅ B31 (2026-10-07): `commission` ki mapping HATA di gayi — admin panel
     2026-10-04 se yeh key likhta hi nahi ("single source = creator_system.
     sdMatchCommissionPct"), aur live_config me padi purani 0.15 ki value
     kisi live setting se judi nahi thi. Jo asli rate hai wahi dikhna chahiye;
     purani jami hui value par bharosa karna hi bug tha. */
  /* ✅ B31 (2026-10-07): `roomReleaseMins` ki mapping bhi hata di — B6/B21 ke
     baad room timing SIRF admin ke Room Manager me set hoti hai (client-side
     ise koi padhta hi nahi tha; row ke bina yeh mapping zinda laash thi). */
  if (c.matchReminderMins      != null) window.CFG.matchReminderMins      = Number(c.matchReminderMins);
  if (c.notifBroadcastDays     != null) window.CFG.notifBroadcastDays     = Number(c.notifBroadcastDays);   /* A9 */
  if (c.autoSquadEnabled       != null) window.CFG.autoSquadEnabled       = Number(c.autoSquadEnabled);
  if (c.autoSquadTimeout       != null) window.CFG.autoSquadTimeout       = Number(c.autoSquadTimeout);
  /* ✅ B30 (2026-10-07): checkInEnabled/checkInOpenMins/checkInCloseMins ki
     mapping hata di — pre-match check-in ka poora system nikal gaya
     (features/checkin-system.js delete, matches.js ke buttons gaye). */
  if (c.watchEarnEnabled       != null) window.CFG.watchEarnEnabled       = Number(c.watchEarnEnabled);
  if (c.watchCoinsPerInterval  != null) window.CFG.watchCoinsPerInterval  = Number(c.watchCoinsPerInterval);
  if (c.watchIntervalMins      != null) window.CFG.watchIntervalMins      = Number(c.watchIntervalMins);
  if (c.watchDailyLimitMins    != null) window.CFG.watchDailyLimitMins    = Number(c.watchDailyLimitMins);
  if (c.seasonName             != null) window.CFG.seasonName             = c.seasonName;
  if (c.seasonActive           != null) window.CFG.seasonActive           = Number(c.seasonActive);
  if (c.matchReminderMins != null) window.CFG.matchReminderMins = Number(c.matchReminderMins);
  if (c.notifBroadcastDays != null) window.CFG.notifBroadcastDays = Number(c.notifBroadcastDays);   /* A9 */
  if (c.shareCoins        != null) window.CFG.shareCoins        = Number(c.shareCoins);
  if (c.referralJoinCoins != null) window.CFG.referralJoinCoins = Number(c.referralJoinCoins);
  if (c.referralSDBonusDiamonds != null) window.CFG.referralSDBonusDiamonds = Number(c.referralSDBonusDiamonds);
  if (c.referralMatchCoins!= null) window.CFG.referralMatchCoins= Number(c.referralMatchCoins);
  if (c.creatorMinPayout  != null) window.CFG.creatorMinPayout  = Number(c.creatorMinPayout);
  if (c.adCoinsPerWatch   != null) window.CFG.adCoinsPerWatch   = Number(c.adCoinsPerWatch);
  if (c.adDailyLimit      != null) window.CFG.adDailyLimit      = Number(c.adDailyLimit);
  /* ✅ B26 (2026-10-07): daily check-in ka schedule — yahi ek source hai.
     Do globals set karta hai (asli consumers) aur poora object CFG me bhi
     rakhta hai (streak.js / future UI ke liye).
     ⚠️ GATE (jhooth se bachne ke liye): yeh schedule SIRF tab lagta hai jab
     live_config me `dailyBonusRewardsLive: true` ho — wo marker server-side
     migration (2026-10-07-b24-b26) set karti hai, jo process_daily_checkin ko
     bhi config padhna sikhhati hai. Warna aisa hota ki button naya amount
     dikhata par server purane constants (5,7,10...) de deta — bilkul wahi
     "UI jhooth bol rahi hai" wala bug jo hum theek kar rahe hain. Marker na
     ho to server constants hi dikhte hain (dono taraf ek hi sach). */
  if (c.dailyBonusRewards != null && c.dailyBonusRewardsLive === true) {
    window.CFG.dailyBonusRewards = c.dailyBonusRewards;
    var _dbrFallback = [5, 7, 10, 12, 15, 20, 30];
    var _dbrArr = [];
    for (var _dbrI = 1; _dbrI <= 7; _dbrI++) {
      _dbrArr.push(Number(c.dailyBonusRewards['day' + _dbrI]) || _dbrFallback[_dbrI - 1]);
    }
    window._adminDailyBonusRewards = _dbrArr;
    window._adminDay30Bonus = Number(c.dailyBonusRewards.day30Bonus) || 100;
  }
  /* Creator settings (Supabase app_settings key='creator_system') */
  if (c.creatorMatchEnabled    != null) window.CFG.creatorMatchEnabled    = Number(c.creatorMatchEnabled);
  if (c.sdMatchCommissionPct   != null) window.CFG.sdMatchCommissionPct   = Number(c.sdMatchCommissionPct);
  if (c.commissionHoldDays     != null) window.CFG.commissionHoldDays     = Number(c.commissionHoldDays);
  if (c.maxCreatorMatches      != null) window.CFG.maxCreatorMatches      = Number(c.maxCreatorMatches);
  /* ── Force Update Control ── */
  if (c.appLatestVersion       != null) window.CFG.appLatestVersion       = String(c.appLatestVersion);
  if (c.appMinSupportedVersion != null) window.CFG.appMinSupportedVersion = String(c.appMinSupportedVersion);
  if (c.appApkUrl              != null) window.CFG.appApkUrl              = String(c.appApkUrl);
  if (c.appForceUpdateEnabled  != null) window.CFG.appForceUpdateEnabled  = !!c.appForceUpdateEnabled;
  if (c.appSupportContact      != null) window.CFG.appSupportContact      = String(c.appSupportContact);
  if (c.appExpectedSigningHash != null) window.CFG.appExpectedSigningHash = String(c.appExpectedSigningHash);
  /* ✅ BUG FIX (2026-09-09), per Junaid's request to make "har chiz"
     admin-customizable — confirmed live that this function (the ONLY
     place that copies a freshly-fetched live_config row into
     window.CFG, which every screen actually reads) was silently
     dropping several fields the admin's App Settings screen can
     already Save: sdPackages, premium (prices+bonuses), missions,
     streakMilestones, cosmetics, and paytmEnabled. The admin's save
     button correctly wrote all of these to the database the whole
     time — nothing was actually broken on that side — but no code
     anywhere ever read them back out, so every one of those settings
     silently did nothing to the live app. Copied through as full
     objects (not field-by-field like the flat number configs above)
     since these are nested structures. */
  if (c.sdPackages        != null) window.CFG.sdPackages        = c.sdPackages;
  if (c.premium           != null) window.CFG.premium           = c.premium;
  if (c.missions          != null) window.CFG.missions          = c.missions;
  if (c.streakMilestones  != null) window.CFG.streakMilestones  = c.streakMilestones;
  if (c.cosmetics         != null) window.CFG.cosmetics         = c.cosmetics;
  if (c.paytmEnabled      != null) window.CFG.paytmEnabled      = !!c.paytmEnabled;
  if (c.paytmMaxTxn       != null) window.CFG.paytmMaxTxn       = Number(c.paytmMaxTxn) || 2000;
  if (c.battlePassPrice   != null) window.CFG.battlePassPrice   = Number(c.battlePassPrice);
  /* ✅ BUG 16 (2026-10-04): manual payment (UPI QR) settings — admin
     App Settings → Payment section se save hoti hain, quick-deposit.js
     inhi se QR image + UPI ID + instructions dikhata hai. */
  if (c.manualPayment     != null) window.CFG.manualPayment     = c.manualPayment;
  window._cfgLoaded = true;
  if (window.renderHome) window.renderHome();
  if (window.renderWallet) window.renderWallet();
  /* ✅ Re-check force-update EVERY time fresh config arrives (cache load,
     Supabase load, Firebase fallback, or a manual Retry) — never only
     once at boot. This is what makes "app restart/back/data reset can't
     dismiss it" actually true: the decision is recomputed live from the
     REAL installed APK version + the LATEST server config every single
     time, never trusted from a stored flag. */
  _checkForceUpdate();
}

/* ── Force Update: version compare + full-screen lock ── */
function _versionParts(v) {
  return String(v || '0').split('.').map(function(n) { return parseInt(n, 10) || 0; });
}
function _versionLessThan(a, b) {
  var pa = _versionParts(a), pb = _versionParts(b);
  var len = Math.max(pa.length, pb.length);
  for (var i = 0; i < len; i++) {
    var x = pa[i] || 0, y = pb[i] || 0;
    if (x < y) return true;
    if (x > y) return false;
  }
  return false;
}

function _checkForceUpdate() {
  var overlay = document.getElementById('forceUpdateOverlay');

  if (!window.CFG.appForceUpdateEnabled) {
    if (overlay) overlay.remove(); // emergency OFF switch takes effect immediately
    return;
  }
  // Only applies inside the actual Android APK — a browser/dev preview
  // has no "installed version" to check, so never block it.
  if (!(window.Android && window.Android.isAndroidApp && window.Android.isAndroidApp())) {
    if (overlay) overlay.remove();
    return;
  }

  var installed = '';
  try { installed = window.Android.getAppVersion() || ''; } catch (e) {}
  if (!installed) { if (overlay) overlay.remove(); return; } // couldn't read version — don't lock on our own bug

  var outdated = _versionLessThan(installed, window.CFG.appMinSupportedVersion);

  // Optional extra layer: signing-certificate check. Only enforced if the
  // admin has actually filled in appExpectedSigningHash — a tampered/
  // resigned APK could otherwise edit its own versionName string to look
  // "up to date" even though it isn't the real signed release build.
  var tampered = false;
  if (!outdated && window.CFG.appExpectedSigningHash) {
    try {
      var actualHash = window.Android.getSigningHash ? (window.Android.getSigningHash() || '') : '';
      if (actualHash && actualHash.toUpperCase() !== String(window.CFG.appExpectedSigningHash).toUpperCase()) {
        tampered = true;
      }
    } catch (e) {}
  }

  if (outdated || tampered) {
    _showForceUpdateOverlay(installed, tampered);
  } else if (overlay) {
    overlay.remove();
  }
}

function _showForceUpdateOverlay(installedVersion, tampered) {
  if (document.getElementById('forceUpdateOverlay')) return; // never stack duplicates
  var apkUrl = window.CFG.appApkUrl || '';
  var supportContact = window.CFG.appSupportContact || '';

  var ov = document.createElement('div');
  ov.id = 'forceUpdateOverlay';
  // Extremely high z-index, fixed full-viewport, opaque — sits above
  // EVERY screen/modal/toast the rest of the app can produce, and is
  // never removed by screen switches since it lives directly on
  // document.body, outside the SPA's own router/screen containers.
  ov.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#050507;'
    + 'display:flex;align-items:center;justify-content:center;padding:24px;'
    + 'box-sizing:border-box;-webkit-user-select:none;user-select:none';
  // Block the browser/WebView's own right-click / long-press context menu
  // on the overlay so there's no incidental escape hatch via "Open in new
  // tab" etc.
  ov.oncontextmenu = function() { return false; };

  var title = tampered ? '⚠️ App Verification Failed' : '🚫 Update Required';
  var msg = tampered
    ? 'Ye app ka version verify nahi ho paya. Kripya official APK se dobara install karein.'
    : 'Aapka app ka version bahut purana ho chuka hai (installed: ' + installedVersion + '). Aage badhne ke liye naya version install karna zaroori hai.';

  var targetVer = window.CFG.appLatestVersion || window.CFG.appMinSupportedVersion || 'latest';
  var hasCached = false;
  try {
    if (window.Android && typeof window.Android.hasCachedUpdateApk === 'function') {
      hasCached = !!window.Android.hasCachedUpdateApk(targetVer);
    }
  } catch (_ce) {}

  var html = '<div style="max-width:360px;width:100%;text-align:center">'
    + '<div style="font-size:52px;margin-bottom:18px">' + (tampered ? '⚠️' : '📲') + '</div>'
    + '<div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:10px">' + title + '</div>'
    + '<div style="font-size:13px;color:#999;line-height:1.7;margin-bottom:20px">' + msg + '</div>'
    + '<div id="fuProgressWrap" style="display:' + (hasCached ? 'block' : 'none') + ';margin-bottom:16px;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(0,255,156,.22);text-align:left">'
    + '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">'
    + '    <span id="fuProgressMsg" style="font-size:11px;font-weight:700;color:#00ff9c">' + (hasCached ? '✅ Update already downloaded — ready to install!' : 'Preparing download...') + '</span>'
    + '    <span id="fuProgressPct" style="font-size:12px;font-weight:900;color:#fff">' + (hasCached ? '100%' : '0%') + '</span>'
    + '  </div>'
    + '  <div style="width:100%;height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden">'
    + '    <div id="fuProgressBar" style="width:' + (hasCached ? '100%' : '0%') + ';height:100%;background:linear-gradient(90deg,#00ff9c,#00d4ff);border-radius:99px;transition:width .2s ease"></div>'
    + '  </div>'
    + '  <div id="fuProgressBytes" style="font-size:10px;color:#888;margin-top:5px;text-align:right">' + (hasCached ? 'Verified APK in cache' : '') + '</div>'
    + '</div>';

  if (apkUrl) {
    html += '<button id="fuUpdateBtn" style="width:100%;padding:15px;border-radius:14px;border:none;background:linear-gradient(135deg,#00ff9c,#00d4ff);color:#000;font-size:15px;font-weight:900;cursor:pointer;margin-bottom:10px">'
      + (hasCached ? '⚡ Install Downloaded Update' : '⬇️ Update Now (In-App)') + '</button>';
  }
  html += '<button id="fuRetryBtn" style="width:100%;padding:13px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#ccc;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:10px">🔄 Retry (check again)</button>';
  if (supportContact) {
    html += '<button id="fuSupportBtn" style="width:100%;padding:12px;border-radius:14px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.25);color:#25d366;font-size:13px;font-weight:700;cursor:pointer">💬 Contact Support</button>';
  }
  html += '<div style="font-size:10px;color:#444;margin-top:20px">Installed: ' + (installedVersion || 'unknown') + ' • Required: ' + (window.CFG.appMinSupportedVersion || '-') + '</div>';
  html += '</div>';
  ov.innerHTML = html;
  document.body.appendChild(ov);

  function _fmtMb(b) {
    if (!b || b <= 0) return '0.0 MB';
    return (b / (1024 * 1024)).toFixed(1) + ' MB';
  }

  window._onApkDownloadProgress = function(pct, downloadedBytes, totalBytes, state, statusMsg) {
    var wrap = document.getElementById('fuProgressWrap');
    var barEl = document.getElementById('fuProgressBar');
    var pctEl = document.getElementById('fuProgressPct');
    var bytesEl = document.getElementById('fuProgressBytes');
    var msgEl = document.getElementById('fuProgressMsg');
    var btn = document.getElementById('fuUpdateBtn');
    if (wrap) wrap.style.display = 'block';
    if (msgEl && statusMsg) {
      msgEl.textContent = statusMsg;
      msgEl.style.color = (state === 'error') ? '#ff6b6b' : '#00ff9c';
    }
    if (pct >= 0) {
      if (barEl) barEl.style.width = Math.min(100, Math.max(0, pct)) + '%';
      if (pctEl) pctEl.textContent = Math.min(100, Math.max(0, pct)) + '%';
    }
    if (bytesEl) {
      if (totalBytes > 0) {
        bytesEl.textContent = _fmtMb(downloadedBytes) + ' / ' + _fmtMb(totalBytes);
      } else if (downloadedBytes > 0) {
        bytesEl.textContent = _fmtMb(downloadedBytes) + ' downloaded';
      }
    }
    if (btn) {
      if (state === 'downloading' || state === 'connecting' || state === 'verifying') {
        btn.disabled = true;
        btn.style.opacity = '0.75';
        btn.textContent = (pct >= 0 ? ('⏳ Downloading... ' + pct + '%') : '⏳ Downloading...');
      } else if (state === 'ready' || state === 'installing' || state === 'permission') {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = '⚡ Install Downloaded Update';
      } else if (state === 'error') {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = (downloadedBytes > 0 ? '🔄 Resume Download' : '🔄 Retry Download');
      }
    }
  };

  var hasNativeUpdater = !!(window.Android && typeof window.Android.downloadAndInstallApk === 'function');
  var updateBtn = document.getElementById('fuUpdateBtn');
  if (updateBtn) {
    updateBtn.addEventListener('click', function() {
      var curApkUrl = window.CFG.appApkUrl || apkUrl;
      var curVer = window.CFG.appLatestVersion || window.CFG.appMinSupportedVersion || targetVer;
      /* ✅ IN-APP DIRECT DOWNLOAD & INSTALL:
         Inside the Android APK (v1.0.107+), download directly in-app with progress bar,
         256KB buffered streaming, HTTP Range resume, APK archive verification,
         and native Package Installer launch — NEVER open an external browser! */
      if (window.Android && typeof window.Android.downloadAndInstallApk === 'function') {
        window._onApkDownloadProgress(hasCached ? 100 : 0, 0, 0, 'connecting',
          hasCached ? 'Opening Android Installer...' : 'Starting fast in-app download...');
        window.Android.downloadAndInstallApk(curApkUrl, String(curVer || 'latest'));
        return;
      }
      /* Legacy APK fallback (only for users still on an older APK < 1.0.107 that lacked downloadAndInstallApk) */
      var wrap = document.getElementById('fuProgressWrap');
      var msgEl = document.getElementById('fuProgressMsg');
      if (wrap) wrap.style.display = 'block';
      if (msgEl) {
        msgEl.style.color = '#ffd700';
        msgEl.innerHTML = '📁 <b>Downloads folder में "MiniEsports.apk" पर tap करके Install करें!</b><br><span style="color:#ccc;font-weight:500">इस एक बार नया APK install करते ही आगे से हर update बिना ब्राउज़र खोले ऐप के अंदर ही live होगा।</span>';
      }
      if (!window._legacyApkOpenedOnce) {
        window._legacyApkOpenedOnce = true;
        window.location.href = curApkUrl;
      }
    });
  }
  var retryBtn = document.getElementById('fuRetryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', function() {
      retryBtn.textContent = '⏳ Checking...';
      retryBtn.disabled = true;
      // Force a completely fresh fetch (bypass the localStorage cache
      // read) in case the admin just fixed the link or flipped the
      // Force Update switch OFF.
      if (window._supa) {
        /* ✅ FIX (2026-09-30): .single() → .maybeSingle() (406 console-noise class) */
        window._supa.from('app_settings').select('value').eq('key', 'live_config').maybeSingle()
          .then(function(r) {
            if (r.data && r.data.value) {
              try { localStorage.setItem('_appConfigCache', JSON.stringify({ config: r.data.value, timestamp: Date.now() })); } catch (e) {}
              _applyCfg(r.data.value); // this calls _checkForceUpdate() again at the end
            }
            retryBtn.textContent = '🔄 Retry (check again)';
            retryBtn.disabled = false;
          }).catch(function() {
            retryBtn.textContent = '🔄 Retry (check again)';
            retryBtn.disabled = false;
          });
      } else {
        retryBtn.textContent = '🔄 Retry (check again)';
        retryBtn.disabled = false;
      }
    });
  }
  var supportBtn = document.getElementById('fuSupportBtn');
  if (supportBtn) {
    supportBtn.addEventListener('click', function() {
      var msgTxt = 'Hi, mera Mini eSports app update screen pe atka hua hai. Installed version: ' + installedVersion;
      /* BUG FIX (2026-08-21): wa.me/<phone> instead of native whatsapp://
         scheme — works in plain browser too, not just the wrapped app. */
      var _phoneDigits = String(supportContact || '').replace(/[^0-9]/g, '');
      window.openWhatsApp(msgTxt, _phoneDigits);
    });
  }
}

/* Shared single-flight + 15s TTL fetcher for app_settings?key=eq.live_config
   Defined at top-level so core/db.js, core/listeners.js, and features/app-config.js
   all share one request during boot while keeping realtime updates instant (force=true). */
window._fetchLiveConfigOnce = function(force) {
  if (!window._supa) return Promise.resolve({ data: null, error: null });
  var now = Date.now();
  if (!force && window._liveCfgPromise && (now - (window._liveCfgPromiseTs || 0) < 15000)) {
    return window._liveCfgPromise;
  }
  window._liveCfgPromiseTs = now;
  /* Convert PostgrestFilterBuilder (lazy thenable) into a real shared Promise */
  window._liveCfgPromise = Promise.resolve(
    window._supa.from('app_settings').select('value').eq('key', 'live_config').maybeSingle()
  ).then(function(r) { return r; });
  return window._liveCfgPromise;
};

/* Load config — Supabase primary, Firebase fallback, localStorage cache (Issue #18 Fix) */
window.loadAppConfig = function() {
  /* Issue #18 Fix: Read from localStorage cache first for instant startup,
     then load fresh config asynchronously. Prevents app showing hardcoded
     defaults when both Supabase and Firebase fail (e.g. offline start). */
  var _cached = null;
  try {
    var raw = localStorage.getItem('_appConfigCache');
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && parsed.config && (Date.now() - (parsed.timestamp || 0)) < 86400000) {
        _applyCfg(parsed.config);
        window._cfgLoaded = true;
        _cached = parsed.config;
      }
    }
  } catch(e) { /* corrupt cache — ignore */ }

  /* Always try fresh load regardless of cache */
  if (window._supa) {
    /* ✅ FIX (2026-09-30): .single() → .maybeSingle() (406 console-noise class) */
    window._fetchLiveConfigOnce(false)
      .then(function(r) {
        if (r && r.data && r.data.value) {
          _applyCfg(r.data.value);
          window._cfgLoaded = true;
          try { localStorage.setItem('_appConfigCache', JSON.stringify({ config: r.data.value, timestamp: Date.now() })); } catch(e) {}
        }
      }).catch(function() {
        /* ✅ B26: pehle yahan _loadFromFirebase() (appSettings/liveConfig) fallback
           tha — wo path mare hue Firebase mein tha (live me null), isliye fallback
           sirf jhoothi tasalli deta tha. Ab cache/default hi rehti hai. */
        console.warn('[AppConfig] live_config fetch fail — cache/default config chal rahi hai');
      });
  } else {
    setTimeout(function() {
      if (window._supa) window.loadAppConfig();
      else console.warn('[AppConfig] Supabase client abhi taiyar nahi — config retry app-resume par hoga');
    }, 1000);
  }
};

/* ✅ B26/B24 (2026-10-07): creator settings — Supabase app_settings
   key='creator_system' (admin panel 2026-08 se yahi likhta hai).
   PEHLE yeh Firebase adminConfig/creatorSystem se padhi jaati thi — mara hua
   path (live me kabhi likha hi nahi gaya), isliye admin ka set kiya hua
   SD commission % / hold days / max-matches user panel tak pahunchta hi nahi
   tha; sab default par chal raha tha (premium-creator.js ka "15% commission"
   text bhi). Ab admin Settings → "Creator Match Hosting" ka save seedha user
   panel tak aata hai. */
function _loadCreatorConfig() {
  if (!window._supa) { setTimeout(_loadCreatorConfig, 800); return; }
  window._supa.from('app_settings').select('value').eq('key', 'creator_system').limit(1)
    .then(function (r) {
      var v = r && r.data && r.data[0] && r.data[0].value;
      if (v) _applyCfg(v);
    }, function () { /* silent — defaults theek hain */ });
}

/* Auto-load on script load */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(window.loadAppConfig, 500);
    setTimeout(_loadCreatorConfig, 1500);
  });
} else {
  setTimeout(window.loadAppConfig, 500);
  setTimeout(_loadCreatorConfig, 1500);
}

/* ✅ FORCE UPDATE (2026-07): also re-check on app resume (not just cold
   boot) — if the admin turns Force Update ON while the app is sitting in
   the background, the user gets locked out as soon as they come back to
   it instead of only on their next full restart. */
document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible') window.loadAppConfig();
});
