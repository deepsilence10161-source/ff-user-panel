/* ================================================================
   APP CONFIG — features/app-config.js | MiniESports v3.0
   Source: Supabase app_settings table (key=live_config)
   Fallback: Firebase RTDB appSettings/liveConfig
================================================================ */

/* Default config values */
window.CFG = {
  // Defaults — Firebase se override hota hai
  commission:        0.15,
  roomReleaseMins:    10,
  matchReminderMins:  30,
  autoSquadEnabled:   1,
  autoSquadTimeout:   15,
  checkInEnabled:     1,
  checkInOpenMins:    30,
  checkInCloseMins:   5,
  watchEarnEnabled:   1,
  watchCoinsPerInterval: 2,
  watchIntervalMins:  5,
  watchDailyLimitMins:30,
  seasonName:         'Season 1',
  seasonActive:       1,
  shareCoins:        20,
  missions: {
    daily_login:     5,
    daily_match:     10,
    daily_kills3:    5,
    daily_checkin:   5,
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
  adDailyLimit:     5,
  checkinCoins:     5,
  checkinStreakBonus7: 50,
  // Creator & Video System defaults (loaded from adminConfig/ paths)
  videoEnabled:            1,
  videoWatchCoins:         5,
  videoDailyLimit:         10,
  videoAutoHideReports:    5,
  videoFalseReportPenalty: 3,
  videoBannedKeywords:     ['gandi','nangi','sexy','vulgar','18+','nude','porn','adult','xxx','explicit','hack tool','cheat','mod apk','aimbot','wallhack'],
  videoAllowedPlatforms:   'both',
  creatorMatchEnabled:     1,
  coinMatchCommissionPct:  10,
  sdMatchCommissionPct:    15,
  commissionHoldDays:      7,
  maxCreatorMatches:       3,
  minFollowersForSD:       1000,

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

/* Apply config from any source */
function _applyCfg(c) {
  if (!c) return;
  if (c.commission        != null) window.CFG.commission        = Number(c.commission);
  if (c.roomReleaseMins        != null) window.CFG.roomReleaseMins        = Number(c.roomReleaseMins);
  if (c.matchReminderMins      != null) window.CFG.matchReminderMins      = Number(c.matchReminderMins);
  if (c.autoSquadEnabled       != null) window.CFG.autoSquadEnabled       = Number(c.autoSquadEnabled);
  if (c.autoSquadTimeout       != null) window.CFG.autoSquadTimeout       = Number(c.autoSquadTimeout);
  if (c.checkInEnabled         != null) window.CFG.checkInEnabled         = Number(c.checkInEnabled);
  if (c.checkInOpenMins        != null) window.CFG.checkInOpenMins        = Number(c.checkInOpenMins);
  if (c.checkInCloseMins       != null) window.CFG.checkInCloseMins       = Number(c.checkInCloseMins);
  if (c.watchEarnEnabled       != null) window.CFG.watchEarnEnabled       = Number(c.watchEarnEnabled);
  if (c.watchCoinsPerInterval  != null) window.CFG.watchCoinsPerInterval  = Number(c.watchCoinsPerInterval);
  if (c.watchIntervalMins      != null) window.CFG.watchIntervalMins      = Number(c.watchIntervalMins);
  if (c.watchDailyLimitMins    != null) window.CFG.watchDailyLimitMins    = Number(c.watchDailyLimitMins);
  if (c.seasonName             != null) window.CFG.seasonName             = c.seasonName;
  if (c.seasonActive           != null) window.CFG.seasonActive           = Number(c.seasonActive);
  if (c.matchReminderMins != null) window.CFG.matchReminderMins = Number(c.matchReminderMins);
  if (c.shareCoins        != null) window.CFG.shareCoins        = Number(c.shareCoins);
  if (c.referralJoinCoins != null) window.CFG.referralJoinCoins = Number(c.referralJoinCoins);
  if (c.referralSDBonusDiamonds != null) window.CFG.referralSDBonusDiamonds = Number(c.referralSDBonusDiamonds);
  if (c.referralMatchCoins!= null) window.CFG.referralMatchCoins= Number(c.referralMatchCoins);
  if (c.creatorMinPayout  != null) window.CFG.creatorMinPayout  = Number(c.creatorMinPayout);
  if (c.adCoinsPerWatch   != null) window.CFG.adCoinsPerWatch   = Number(c.adCoinsPerWatch);
  if (c.adDailyLimit      != null) window.CFG.adDailyLimit      = Number(c.adDailyLimit);
  if (c.checkinCoins      != null) window.CFG.checkinCoins      = Number(c.checkinCoins);
  if (c.checkinStreakBonus7 != null) window.CFG.checkinStreakBonus7 = Number(c.checkinStreakBonus7);
  // Apply creator/video settings if present (when called from _loadCreatorConfig)
  if (c.videoEnabled           != null) window.CFG.videoEnabled           = Number(c.videoEnabled);
  if (c.videoWatchCoins        != null) window.CFG.videoWatchCoins        = Number(c.videoWatchCoins);
  if (c.videoDailyLimit        != null) window.CFG.videoDailyLimit        = Number(c.videoDailyLimit);
  if (c.videoAutoHideReports   != null) window.CFG.videoAutoHideReports   = Number(c.videoAutoHideReports);
  if (c.videoFalseReportPenalty!= null) window.CFG.videoFalseReportPenalty= Number(c.videoFalseReportPenalty);
  if (c.videoBannedKeywords    != null) window.CFG.videoBannedKeywords    = c.videoBannedKeywords;
  if (c.videoAllowedPlatforms  != null) window.CFG.videoAllowedPlatforms  = c.videoAllowedPlatforms;
  if (c.creatorMatchEnabled    != null) window.CFG.creatorMatchEnabled    = Number(c.creatorMatchEnabled);
  if (c.coinMatchCommissionPct != null) window.CFG.coinMatchCommissionPct = Number(c.coinMatchCommissionPct);
  if (c.sdMatchCommissionPct   != null) window.CFG.sdMatchCommissionPct   = Number(c.sdMatchCommissionPct);
  if (c.commissionHoldDays     != null) window.CFG.commissionHoldDays     = Number(c.commissionHoldDays);
  if (c.maxCreatorMatches      != null) window.CFG.maxCreatorMatches      = Number(c.maxCreatorMatches);
  if (c.minFollowersForSD      != null) window.CFG.minFollowersForSD      = Number(c.minFollowersForSD);
  /* ── Force Update Control ── */
  if (c.appLatestVersion       != null) window.CFG.appLatestVersion       = String(c.appLatestVersion);
  if (c.appMinSupportedVersion != null) window.CFG.appMinSupportedVersion = String(c.appMinSupportedVersion);
  if (c.appApkUrl              != null) window.CFG.appApkUrl              = String(c.appApkUrl);
  if (c.appForceUpdateEnabled  != null) window.CFG.appForceUpdateEnabled  = !!c.appForceUpdateEnabled;
  if (c.appSupportContact      != null) window.CFG.appSupportContact      = String(c.appSupportContact);
  if (c.appExpectedSigningHash != null) window.CFG.appExpectedSigningHash = String(c.appExpectedSigningHash);
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

  var html = '<div style="max-width:360px;width:100%;text-align:center">'
    + '<div style="font-size:52px;margin-bottom:18px">' + (tampered ? '⚠️' : '📲') + '</div>'
    + '<div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:10px">' + title + '</div>'
    + '<div style="font-size:13px;color:#999;line-height:1.7;margin-bottom:24px">' + msg + '</div>';

  if (apkUrl) {
    html += '<button id="fuUpdateBtn" style="width:100%;padding:15px;border-radius:14px;border:none;background:linear-gradient(135deg,#00ff9c,#00d4ff);color:#000;font-size:15px;font-weight:900;cursor:pointer;margin-bottom:10px">⬇️ Update Now</button>';
  }
  html += '<button id="fuRetryBtn" style="width:100%;padding:13px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:#ccc;font-size:13px;font-weight:700;cursor:pointer;margin-bottom:10px">🔄 Retry (check again)</button>';
  if (supportContact) {
    html += '<button id="fuSupportBtn" style="width:100%;padding:12px;border-radius:14px;background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.25);color:#25d366;font-size:13px;font-weight:700;cursor:pointer">💬 Contact Support</button>';
  }
  html += '<div style="font-size:10px;color:#444;margin-top:20px">Installed: ' + (installedVersion || 'unknown') + ' • Required: ' + (window.CFG.appMinSupportedVersion || '-') + '</div>';
  html += '</div>';
  ov.innerHTML = html;
  document.body.appendChild(ov);

  var updateBtn = document.getElementById('fuUpdateBtn');
  if (updateBtn) {
    updateBtn.addEventListener('click', function() {
      // Direct top-level navigation (not window.open) — MainActivity's
      // shouldOverrideUrlLoading already hands off any non-app http(s)
      // URL to the system browser, which knows how to actually download
      // and offer to install an .apk file.
      window.location.href = apkUrl;
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
        window._supa.from('app_settings').select('value').eq('key', 'live_config').single()
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
      window.location.href = 'whatsapp://send?phone=' + encodeURIComponent(supportContact) + '&text=' + encodeURIComponent(msgTxt);
    });
  }
}

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
    window._supa.from('app_settings').select('value').eq('key', 'live_config').single()
      .then(function(r) {
        if (r.data && r.data.value) {
          _applyCfg(r.data.value);
          window._cfgLoaded = true;
          try { localStorage.setItem('_appConfigCache', JSON.stringify({ config: r.data.value, timestamp: Date.now() })); } catch(e) {}
        }
      }).catch(function() { _loadFromFirebase(); });
  } else {
    setTimeout(function() {
      if (window._supa) window.loadAppConfig();
      else _loadFromFirebase();
    }, 1000);
  }
};

function _loadFromFirebase() {
  if (!window.db) return;
  window.db.ref('appSettings/liveConfig').once('value', function(snap) {
    if (snap && snap.exists()) _applyCfg(snap.val());
  });
}

/* Load creator/video config from separate Firebase paths (adminConfig/) */
function _loadCreatorConfig() {
  var rtdb = window.rtdb || window.db;
  if (!rtdb) return;
  rtdb.ref('adminConfig/videoModeration').once('value', function(vSnap) {
    if (vSnap && vSnap.exists()) _applyCfg(vSnap.val());
    rtdb.ref('adminConfig/creatorSystem').once('value', function(cSnap) {
      if (cSnap && cSnap.exists()) _applyCfg(cSnap.val());
    });
  });
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
