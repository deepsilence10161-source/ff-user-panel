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
  /* ✅ FIX (live-testing): this script (battle-pass-xp.js) loads BEFORE
     js/features-user.js in index.html, which is where window.doCheckIn
     is actually defined. The old guard here (`if (!window.doCheckIn)
     return`) always failed silently on the first call from initBPXP()
     — and nothing ever retried it, because the outer init-poll only
     waits on window.awardPassXP + window.U, not on doCheckIn existing.
     Net effect: Battle Pass XP for daily check-in never fired, ever.
     Fixed by giving this its own independent retry loop, the same
     pattern premium-creator.js already uses correctly for its own
     doCheckIn wrap (see initPremiumCreator/_wrapCheckIn). */
  if (window._bpCheckInHooked) return;
  if (!window.doCheckIn) { setTimeout(hookCheckIn, 500); return; }
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
  /* ✅ FIX (consistency, live-testing): load order today happens to be
     safe (ads.js loads before this file), but the old code captured
     window.onAdRewarded and set the "hooked" flag unconditionally even
     if it were undefined — which would permanently break this hook with
     zero chance to recover. Made it retry-safe like the other two hooks
     in this file so a future load-order change can't silently kill it
     again. */
  if (window._bpAdHooked) return;
  if (!window.onAdRewarded) { setTimeout(hookAdReward, 500); return; }
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
  /* ✅ FIX (live-testing): window.joinMatch never existed as a global
     function anywhere in the codebase — the real join function is
     doJoin() in screens/join.js (window.joinMatch only ever appeared as
     analytics.joinMatch, a different namespace entirely). This hook was
     permanently dead from day one: the guard silently failed and never
     retried. Wrapping the actual doJoin(), with the same retry-safe
     pattern as hookCheckIn's fix above so load order can't break it
     again. */
  if (window._bpMatchHooked) return;
  if (!window.doJoin) { setTimeout(hookMatchJoin, 500); return; }
  window._bpMatchHooked = true;
  _origJoinMatch = window.doJoin;
  window.doJoin = function(matchId) {
    if (_origJoinMatch) _origJoinMatch.apply(this, arguments);
    setTimeout(function() {
      window.awardBPXP('match_participated');
    }, 2000);
  };
}

/* ── Hook: Watch & Earn → XP ── */
/* Fires every 10 min of watching */
function hookWatchEarn() {
  /* ✅ FIX (live-testing): features/watch-earn.js (where startWatching is
     defined) loads AFTER this file in index.html — so window.startWatching
     was always undefined here. The old code set _bpWatchHooked = true
     BEFORE checking that, so it never got a second chance. Same
     retry-safe pattern as the other three hooks in this file. */
  if (window._bpWatchHooked) return;
  if (!window.startWatching) { setTimeout(hookWatchEarn, 500); return; }
  window._bpWatchHooked = true;
  var _origStart = window.startWatching;
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
