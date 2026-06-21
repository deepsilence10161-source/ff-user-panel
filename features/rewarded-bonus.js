/* ================================================================
   REWARDED ADS BONUS SYSTEM
   Premium users ke liye optional rewarded ads:
   "5 ads dekho → 1 Ad-Match free join karo (credit)"
   Non-premium: "3 ads dekho → 50 coins bonus"
   Har user rewarded ads se benefit le sakta hai
================================================================ */
(function(){
'use strict';

var BONUS_KEY    = '_mes_rew_bonus_';
var MAX_ADS_DAY  = 5;   /* max rewarded ads per day */

function _todayKey() { return new Date().toISOString().split('T')[0]; }

function _getCount(uid) {
  var raw = localStorage.getItem(BONUS_KEY + uid + '_' + _todayKey());
  return parseInt(raw || '0');
}

function _incCount(uid) {
  var key = BONUS_KEY + uid + '_' + _todayKey();
  var val = parseInt(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, val);
  return val;
}

/* ── Show "Earn with Ads" modal ── */
window.showRewardedBonusModal = function() {
  var uid = window.U && window.U.uid;
  if (!uid) { if(window.toast) toast('Pehle login karo!','err'); return; }

  var count   = _getCount(uid);
  var isPrem  = window.getUserPremiumTier ? window.getUserPremiumTier() > 0 : false;
  var remaining = MAX_ADS_DAY - count;

  var h = '<div style="text-align:center;padding:8px 0 18px">';
  h += '<div style="font-size:40px;margin-bottom:8px">🎬</div>';
  h += '<div style="font-size:17px;font-weight:900;color:#fff;margin-bottom:4px">Ads Dekho — Bonus Pao!</div>';
  h += '<div style="font-size:12px;color:#888;margin-bottom:16px">Aaj ke ' + remaining + ' ads baaki hain (max ' + MAX_ADS_DAY + '/day)</div>';

  /* Progress bar */
  var pct = Math.min(100, (count / MAX_ADS_DAY) * 100);
  h += '<div style="background:rgba(255,255,255,.06);border-radius:20px;height:8px;margin-bottom:6px;overflow:hidden">';
  h += '<div style="background:linear-gradient(90deg,#00ff9c,#00bcd4);height:100%;border-radius:20px;width:' + pct + '%;transition:width .4s"></div></div>';
  h += '<div style="font-size:10px;color:#555;margin-bottom:16px">' + count + '/' + MAX_ADS_DAY + ' ads aaj dekhe gaye</div>';

  /* Rewards */
  h += '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">';

  /* Non-premium: coins bonus */
  if (!isPrem) {
    h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:14px;display:flex;align-items:center;justify-content:space-between">';
    h += '<div><div style="font-size:13px;font-weight:700;color:#e0e0e0">🪙 Coin Bonus</div>';
    h += '<div style="font-size:11px;color:#888;margin-top:3px">Ek ad = +50 Coins</div></div>';
    h += '<button onclick="window.watchAdForCoins()" style="padding:9px 16px;border-radius:11px;border:none;background:linear-gradient(135deg,#e0e0e0,#aaa);color:#000;font-size:12px;font-weight:900;cursor:pointer' + (remaining<=0?';opacity:.4;pointer-events:none':'') + '">' + (remaining<=0?'Aaj limit!':'Ad Dekho →') + '</button>';
    h += '</div>';
  }

  /* Battle Pass XP */
  h += '<div style="background:rgba(255,215,0,.04);border:1px solid rgba(255,215,0,.15);border-radius:14px;padding:14px;display:flex;align-items:center;justify-content:space-between">';
  h += '<div><div style="font-size:13px;font-weight:700;color:#ffd700">⚡ Battle Pass XP</div>';
  h += '<div style="font-size:11px;color:#888;margin-top:3px">Ek ad = +5 XP (max 3/day)</div></div>';
  h += '<button onclick="window.watchAdForXP()" style="padding:9px 16px;border-radius:11px;border:none;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:12px;font-weight:900;cursor:pointer' + (remaining<=0?';opacity:.4;pointer-events:none':'') + '">' + (remaining<=0?'Aaj limit!':'Ad Dekho →') + '</button>';
  h += '</div>';

  /* Premium users: Ad-Match credit */
  if (isPrem) {
    var credits = window.getAdMatchCredits ? window.getAdMatchCredits(uid) : 0;
    h += '<div style="background:rgba(0,255,156,.04);border:1px solid rgba(0,255,156,.15);border-radius:14px;padding:14px;display:flex;align-items:center;justify-content:space-between">';
    h += '<div><div style="font-size:13px;font-weight:700;color:#00ff9c">🎮 Match Credit</div>';
    h += '<div style="font-size:11px;color:#888;margin-top:3px">5 ads dekho → 1 Ad-Match free</div>';
    h += '<div style="font-size:10px;color:#00ff9c;margin-top:2px">Abhi: ' + credits + ' credit(s)</div></div>';
    h += '<button onclick="window.watchAdForMatchCredit()" style="padding:9px 14px;border-radius:11px;border:none;background:linear-gradient(135deg,#00ff9c,#009688);color:#000;font-size:12px;font-weight:900;cursor:pointer' + (remaining<=0?';opacity:.4;pointer-events:none':'') + '">' + (remaining<=0?'Aaj limit!':'5 Ads Dekho') + '</button>';
    h += '</div>';
  }

  h += '</div></div>';
  if (window.openModal) openModal('🎬 Ad Bonus', h);
};

/* ── Watch Ad for Coins (non-premium) ── */
window.watchAdForCoins = function() {
  var uid = window.U && window.U.uid;
  if (!uid) return;
  if (_getCount(uid) >= MAX_ADS_DAY) { if(window.toast) toast('Aaj ki limit ho gayi!','inf'); return; }
  if (!window.AdManager) { if(window.toast) toast('Ad load nahi hua','err'); return; }
  if(window.closeModal) closeModal();
  setTimeout(function() {
    window.AdManager.showRewardedAd(function() {
      /* Rewarded */
      _incCount(uid);
      /* Give 50 coins */
      _giveCoins(uid, 50, function() {
        if(window.toast) toast('🪙 +50 Coins mile! Aaj aur ads dekho.','ok');
        if(window.awardBPXP) window.awardBPXP('ad_watched');
      });
    }, function() {
      if(window.toast) toast('Ad pura dekho reward ke liye!','inf');
    }, 'coins_bonus');
  }, 400);
};

/* ── Watch Ad for XP ── */
window.watchAdForXP = function() {
  var uid = window.U && window.U.uid;
  if (!uid) return;
  if (_getCount(uid) >= MAX_ADS_DAY) { if(window.toast) toast('Aaj ki limit ho gayi!','inf'); return; }
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
  if (_getCount(uid) >= MAX_ADS_DAY) { if(window.toast) toast('Aaj ki limit ho gayi!','inf'); return; }
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
window.useAdMatchCredit = function(uid) {
  var c = window.getAdMatchCredits(uid);
  if (c <= 0) return false;
  localStorage.setItem('_mes_match_credits_' + uid, c - 1);
  return true;
};

/* ── Give Coins helper ── */
function _giveCoins(uid, amount, cb) {
  if (window._supa) {
    window._supa.rpc('increment_coins', { p_uid: uid, p_amount: amount })
      .then(function() { if(cb) cb(); })
      .catch(function() {
        /* Fallback: local track */
        if(cb) cb();
      });
  } else {
    if(cb) cb();
  }
}

/* ── Add "Earn with Ads" button to relevant screens ── */
function injectEarnButton() {
  /* Add button to watch-earn section or profile */
  var existing = document.getElementById('_earnWithAdsBtn');
  if (existing) return;
  /* Find a good spot — wallet or home bottom */
  var wallet = document.getElementById('scrWallet');
  if (wallet) {
    var btn = document.createElement('div');
    btn.id = '_earnWithAdsBtn';
    btn.style.cssText = 'margin:12px 0;padding:14px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.2);border-radius:14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer';
    btn.innerHTML = '<div><div style="font-size:14px;font-weight:900;color:#00ff9c">🎬 Ads Dekho — Bonus Pao</div><div style="font-size:11px;color:#888;margin-top:3px">Coins, XP, ya Match Credits kamao</div></div><div style="font-size:18px;color:#00ff9c">→</div>';
    btn.onclick = function() { window.showRewardedBonusModal(); };
    wallet.insertBefore(btn, wallet.firstChild);
  }
}

/* ── Init ── */
function initRewardedBonus() {
  if (!window.U) { setTimeout(initRewardedBonus, 1500); return; }
  setTimeout(injectEarnButton, 3000);
  console.log('[Mini eSports] Rewarded Bonus System v1.0 ✅');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(initRewardedBonus, 2000); });
} else {
  setTimeout(initRewardedBonus, 2000);
}
})();
