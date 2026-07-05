/* ================================================================
   BATTLE PASS XP SOURCES — Admin-independent XP earning
   Yeh file battle-pass.js ke saath kaam karti hai
   XP sources: Daily check-in, Ad watch, Referral, Clan join,
               Profile complete, Match participate, Watch & Earn
================================================================ */
(function(){
'use strict';

/* ── XP Source Amounts ── */
var XP_SOURCES = {
  daily_checkin:     10,   // Daily login
  ad_watched:         5,   // Rewarded ad dekha (max 3/day)
  friend_referred:   50,   // Ek dost refer kiya
  clan_joined:       25,   // Clan join kiya (one-time)
  profile_completed: 30,   // Profile complete (one-time)
  match_participated:20,   // Match mein khela (har match)
  watch_earn_10min:   8    // Watch & Earn 10 min
};

/* ── Award XP from any source ── */
window.awardBPXP = function(source, uid) {
  uid = uid || (window.U && window.U.uid);
  if (!uid || !window.awardPassXP) return;
  var xp = XP_SOURCES[source];
  if (!xp || xp <= 0) return;

  /* Daily cap check for ad_watched */
  if (source === 'ad_watched') {
    var today = new Date().toISOString().split('T')[0];
    var key = '_bpAdXP_' + today + '_' + uid;
    var count = parseInt(localStorage.getItem(key) || '0');
    if (count >= 3) return; /* Max 3 ads/day */
    localStorage.setItem(key, count + 1);
  }

  /* One-time sources */
  if (source === 'clan_joined' || source === 'profile_completed') {
    var doneKey = '_bpXP_' + source + '_' + uid;
    if (localStorage.getItem(doneKey)) return;
    localStorage.setItem(doneKey, '1');
  }

  window.awardPassXP(uid, xp);
  console.log('[BattlePass XP] +' + xp + ' XP from ' + source);
};

/* ── Hook: Daily Check-in → XP ── */
var _origCheckIn = null;
function hookCheckIn() {
  if (!window.doCheckIn || window._bpCheckInHooked) return;
  window._bpCheckInHooked = true;
  _origCheckIn = window.doCheckIn;
  window.doCheckIn = function() {
    if (_origCheckIn) _origCheckIn.apply(this, arguments);
    setTimeout(function() {
      window.awardBPXP('daily_checkin');
    }, 1000);
  };
}

/* ── Hook: Rewarded Ad Watched → XP ── */
var _origOnAdRewarded = null;
function hookAdReward() {
  if (window._bpAdHooked) return;
  window._bpAdHooked = true;
  _origOnAdRewarded = window.onAdRewarded;
  window.onAdRewarded = function(adUnitId) {
    if (_origOnAdRewarded) _origOnAdRewarded.apply(this, arguments);
    window.awardBPXP('ad_watched');
  };
}

/* ── Hook: Match Join → XP ── */
/* awardPassXP is already called from match result — this adds XP on JOIN too */
var _origJoinMatch = null;
function hookMatchJoin() {
  if (!window.joinMatch || window._bpMatchHooked) return;
  window._bpMatchHooked = true;
  _origJoinMatch = window.joinMatch;
  window.joinMatch = function(matchId) {
    if (_origJoinMatch) _origJoinMatch.apply(this, arguments);
    setTimeout(function() {
      window.awardBPXP('match_participated');
    }, 2000);
  };
}

/* ── Hook: Watch & Earn → XP ── */
/* Fires every 10 min of watching */
function hookWatchEarn() {
  if (window._bpWatchHooked) return;
  window._bpWatchHooked = true;
  var _origStart = window.startWatching;
  if (!_origStart) return;
  window.startWatching = function(matchId) {
    if (_origStart) _origStart.apply(this, arguments);
    /* Award XP every 10 min of watching */
    var wpTimer = setInterval(function() {
      if (!window._watchMatchId) { clearInterval(wpTimer); return; }
      window.awardBPXP('watch_earn_10min');
    }, 10 * 60 * 1000);
  };
}

/* ── Hook: Profile Complete → XP (one-time) ── */
window.checkProfileCompleteXP = function() {
  var ud = window.UD;
  if (!ud) return;
  /* Consider complete if: IGN + game ID + avatar all set */
  var isComplete = ud.ign && ud.ign.length > 2 &&
                   (ud.gameId || ud.freeFireId) &&
                   ud.photoURL && ud.photoURL !== '';
  if (isComplete) window.awardBPXP('profile_completed');
};

/* ── Init — run after all features load ── */
function initBPXP() {
  hookCheckIn();
  hookAdReward();
  hookMatchJoin();
  hookWatchEarn();
  /* Check profile complete on load */
  setTimeout(function() {
    if (window.UD) window.checkProfileCompleteXP();
  }, 4000);
}

/* Wait for core systems */
var _initAttempts = 0;
var _initTimer = setInterval(function() {
  _initAttempts++;
  if (_initAttempts > 30) { clearInterval(_initTimer); return; }
  if (window.awardPassXP && window.U) {
    clearInterval(_initTimer);
    initBPXP();
  }
}, 1000);

console.log('[Mini eSports] Battle Pass XP Sources v1.0 ✅');
})();
