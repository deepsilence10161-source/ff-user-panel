/* ================================================================
   REWARDED ADS BONUS SYSTEM
   Premium users ke liye optional rewarded ads:
   "5 ads dekho → 1 Ad-Match free join karo (credit)"
   Non-premium: config ke mutabik coins bonus
   Har user rewarded ads se benefit le sakta hai
================================================================ */
(function(){
'use strict';

/* One counter for every rewarded-ad entry point. The server/RPC remains the
   authoritative cap; this is only the UX counter and must not be split. */
var BONUS_KEY    = '_adWatched_';
var MAX_ADS_DAY  = 5;
function _dailyLimit() {
  var n = window.CFG && Number(window.CFG.adDailyLimit);
  return n > 0 ? n : MAX_ADS_DAY;
}
function _adReward() {
  var n = window.CFG && Number(window.CFG.adCoinsPerWatch);
  return n > 0 ? n : 10;
}

function _todayKey() { return new Date().toISOString().split('T')[0]; }

function _getCount(uid) {
  var raw = localStorage.getItem(BONUS_KEY + _todayKey() + '_' + uid);
  return parseInt(raw || '0');
}

function _incCount(uid) {
  var key = BONUS_KEY + _todayKey() + '_' + uid;
  var val = parseInt(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, val);
  return val;
}


/* Coin rewards are implemented once in features/ads.js. Keeping a second
   window.watchAdForCoins here used to overwrite it and pay a hardcoded reward. */

/* ── Watch Ad for XP ── */
window.watchAdForXP = function() {
  var uid = window.U && window.U.uid;
  if (!uid) return;
  if (_getCount(uid) >= _dailyLimit()) { if(window.toast) toast('Aaj ki limit ho gayi!','inf'); return; }
  if (!window.AdManager) { if(window.toast) toast('Ad load nahi hua','err'); return; }
  if(window.closeModal) closeModal();
  setTimeout(function() {
    window.AdManager.showRewardedAd(function() {
      _incCount(uid);
      if(window.awardBPXP) window.awardBPXP('ad_watched');
      if(window.toast) toast('⚡ +5 Battle Pass XP mile!','ok');
    }, function() {
      if(window.toast) toast('Ad pura dekho reward ke liye!','inf');
    }, 'xp_bonus');
  }, 400);
};

/* ── Watch Ads for Match Credit (premium only, 5 ads = 1 credit) ── */
var _matchAdCount = 0;
window.watchAdForMatchCredit = function() {
  var uid = window.U && window.U.uid;
  if (!uid) return;
  var isPrem = window.getUserPremiumTier ? window.getUserPremiumTier() > 0 : false;
  if (!isPrem) { if(window.toast) toast('Yeh sirf premium users ke liye hai!','inf'); return; }
  if (_getCount(uid) >= _dailyLimit()) { if(window.toast) toast('Aaj ki limit ho gayi!','inf'); return; }
  if (!window.AdManager) return;
  if(window.closeModal) closeModal();
  setTimeout(function() {
    window.AdManager.showRewardedAd(function() {
      _incCount(uid);
      _matchAdCount++;
      if(window.awardBPXP) window.awardBPXP('ad_watched');
      if (_matchAdCount >= 5) {
        _matchAdCount = 0;
        _giveMatchCredit(uid);
        if(window.toast) toast('🎮 Ad-Match Credit mila! 1 match free join kar sakte ho.','ok');
      } else {
        if(window.toast) toast('⚡ Ad dekha! ' + (5 - _matchAdCount) + ' aur baaki match credit ke liye','ok');
        setTimeout(function(){ window.watchAdForMatchCredit(); }, 1000);
      }
    }, function() {
      if(window.toast) toast('Ad pura dekho!','inf');
    }, 'match_credit');
  }, 400);
};

/* ── Get/Give Match Credits ── */
window.getAdMatchCredits = function(uid) {
  return parseInt(localStorage.getItem('_mes_match_credits_' + uid) || '0');
};
function _giveMatchCredit(uid) {
  var c = window.getAdMatchCredits(uid) + 1;
  localStorage.setItem('_mes_match_credits_' + uid, c);
}

/* ── Add "Earn with Ads" button to relevant screens ──
   BUG FIX (2026-08): this "Ads Dekho — Bonus Pao" row used to sit at
   the very top of the Wallet screen. Per redesign: Daily Missions
   (previously a Profile-screen button) now takes this exact slot
   instead, and the ad-earn entry point lives inside the Coin Shop
   modal (see index.html #coinShopModal's "Watch Ad" row) and inside
   Daily Missions itself — so the feature isn't lost, just consolidated
   instead of having two separate "earn coins via ads" entry points. */
function injectEarnButton() {
  /* Intentionally now a no-op — see comment above. Daily Missions is
     injected in this slot instead by injectDailyMissionsButton(). */
}

/* ── Add "Daily Missions" button to Wallet (2026-08, moved from Profile) ── */
function injectDailyMissionsButton() {
  var existing = document.getElementById('_dailyMissionsBtn');
  if (existing) return;
  var wallet = document.getElementById('scrWallet');
  if (wallet) {
    var btn = document.createElement('div');
    btn.id = '_dailyMissionsBtn';
    btn.style.cssText = 'margin:12px 0;padding:14px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.2);border-radius:14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer';
    btn.innerHTML = '<div><div style="font-size:14px;font-weight:900;color:#00ff9c">🎯 Daily Missions</div><div style="font-size:11px;color:#888;margin-top:3px">Roz naye tasks poore karo, coins kamao</div></div><div style="font-size:18px;color:#00ff9c">→</div>';
    btn.onclick = function() { if (window.showMissionsPanel) showMissionsPanel(); };
    try { wallet.insertBefore(btn, wallet.firstChild); } catch (e) {}
  }
}

/* ── Init ── */
function initRewardedBonus() {
  if (!window.U) { setTimeout(initRewardedBonus, 1500); return; }
  setTimeout(injectDailyMissionsButton, 3000);
  console.log('[Mini eSports] Rewarded Bonus System v1.0 ✅');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(initRewardedBonus, 2000); });
} else {
  setTimeout(initRewardedBonus, 2000);
}
})();
