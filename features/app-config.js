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
  window._cfgLoaded = true;
  if (window.renderHome) window.renderHome();
  if (window.renderWallet) window.renderWallet();
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
