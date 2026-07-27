/* ================================================================
   FREE TRIAL SYSTEM — 7-Day Silver Premium Trial
   - Pehli baar premium dekho → "FREE try karo" button dikhega
   - Day 5: reminder notification
   - Day 7: "Trial khatam — ₹49 mein continue?"
   - Trial mein: banner ads band, Silver badge, green name
================================================================ */
(function(){
'use strict';

var TRIAL_DAYS = 7;
var TRIAL_KEY  = '_mes_trial_'; /* + uid */

/* ── Trial Status ── */
window.getTrialStatus = function() {
  var uid = window.U && window.U.uid;
  if (!uid) return null;
  var raw = localStorage.getItem(TRIAL_KEY + uid);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch(e) { return null; }
};

window.isTrialActive = function() {
  var t = window.getTrialStatus();
  if (!t || !t.startedAt) return false;
  var now = Date.now();
  var endAt = t.startedAt + (TRIAL_DAYS * 24 * 60 * 60 * 1000);
  return now < endAt;
};

window.isTrialExpired = function() {
  var t = window.getTrialStatus();
  if (!t || !t.startedAt) return false;
  var now = Date.now();
  var endAt = t.startedAt + (TRIAL_DAYS * 24 * 60 * 60 * 1000);
  return now >= endAt;
};

window.isTrialUsed = function() {
  var t = window.getTrialStatus();
  return !!(t && t.startedAt);
};

/* ── Start Trial ── */
window.startFreeTrial = function() {
  var uid = window.U && window.U.uid;
  if (!uid) { if(window.toast)toast('Pehle login karo!','err'); return; }
  if (!window._supa) { if(window.toast)toast('Connection error, retry karo.','err'); return; }

  /* BUG #34 FIX (2026-07): eligibility ("has this user ever used their trial") was ONLY
     checked via localStorage — clearing storage or opening a new browser/incognito session
     let the same account claim the trial repeatedly forever. start_free_trial() is now the
     server-authoritative gate (checks a permanent users.trial_used flag, row-locked) — the
     localStorage write below is now just a local cache for the UI perks, not the source of
     truth for eligibility. */
  window._supa.rpc('start_free_trial').then(function(r) {
    if (r.error || (r.data && r.data.success === false)) {
      var msg = (r.data && r.data.error) || (r.error && r.error.message) || 'Trial start failed';
      if(window.toast) toast(msg, 'inf');
      return;
    }
    var trialData = { startedAt: Date.now(), uid: uid, plan: 'silver_trial', reminderSent: false };
    localStorage.setItem(TRIAL_KEY + uid, JSON.stringify(trialData));
    if (window.UD) { window.UD.premium = window.UD.premium || {}; window.UD.premium.tier = 1; window.UD.premium.expiresAt = Date.now() + (TRIAL_DAYS*24*60*60*1000); }
    _applyTrialPerks();
    if (window.closeModal) closeModal();
    setTimeout(function(){ _showTrialWelcome(); }, 300);
  }).catch(function(e) {
    console.error('[free-trial] start failed:', e && e.message);
    if(window.toast) toast('Trial start failed, retry karo', 'err');
  });
};

/* ── Apply Trial Perks (Silver-level) ── */
function _applyTrialPerks() {
  if (!window.isTrialActive()) return;
  /* Hide banner ads */
  if (!document.getElementById('_trialNoAdsStyle')) {
    var s = document.createElement('style');
    s.id = '_trialNoAdsStyle';
    s.textContent = '.ad-banner,.ad-container,[id*="ad-"],[class*="adslot"]{display:none!important}';
    document.head.appendChild(s);
  }
  console.log('[Trial] Silver trial perks applied ✅');
}

function _removeTrialPerks() {
  var s = document.getElementById('_trialNoAdsStyle');
  if (s) s.remove();
}

/* ── Trial Welcome Modal ── */
function _showTrialWelcome() {
  var h = '<div style="text-align:center;padding:6px 0 20px">';
  h += '<div style="font-size:48px;margin-bottom:10px">🎉</div>';
  h += '<div style="font-size:20px;font-weight:900;color:#e0e0e0;margin-bottom:6px">Silver Trial Shuru!</div>';
  h += '<div style="font-size:13px;color:#888;margin-bottom:16px">' + TRIAL_DAYS + ' din bilkul free</div>';
  h += '<div style="background:rgba(224,224,224,.06);border:1px solid rgba(224,224,224,.15);border-radius:14px;padding:14px;margin-bottom:16px;text-align:left">';
  ['🚫 Koi Ads nahi — match join karte waqt','🥈 Silver Badge — profile par','💬 Green Name — lobby chat mein','📊 5 Green Diamonds bonus is mahine'].forEach(function(p){
    h += '<div style="font-size:12px;color:#ddd;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">' + p + '</div>';
  });
  h += '</div>';
  h += '<div style="font-size:12px;color:#555;margin-bottom:14px">Day 7 pe ₹49/month mein continue kar sakte ho</div>';
  h += '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:13px;border-radius:13px;border:none;background:linear-gradient(135deg,#e0e0e0,#aaa);color:#000;font-size:14px;font-weight:900;cursor:pointer">🎮 App Use Karo!</button>';
  h += '</div>';
  if (window.openModal) openModal('🥈 Silver Trial Active!', h);
}

/* ── Trial Expiry Modal ── */
function _showTrialExpiredModal() {
  var h = '<div style="text-align:center;padding:6px 0 16px">';
  h += '<div style="font-size:40px;margin-bottom:10px">⏰</div>';
  h += '<div style="font-size:18px;font-weight:900;color:#ffd700;margin-bottom:6px">Trial Khatam Ho Gaya!</div>';
  h += '<div style="font-size:13px;color:#888;margin-bottom:16px">Ads wapas aa jayenge — continue karo sirf ₹49/month mein</div>';
  h += '<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.2);border-radius:13px;padding:12px;margin-bottom:14px">';
  h += '<div style="font-size:24px;font-weight:900;color:#ffd700;margin-bottom:4px">₹49 <span style="font-size:13px;color:#888">/mahina</span></div>';
  h += '<div style="font-size:11px;color:#aaa">Ad-free + Silver Badge + 5 GD/month</div>';
  h += '</div>';
  h += '<button onclick="if(window.buyPremium)buyPremium(1,49)" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:8px">💳 Silver Kharido — ₹49/month</button>';
  h += '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:11px;border-radius:13px;border:none;background:rgba(255,255,255,.06);color:#666;font-size:13px;cursor:pointer">Baad mein</button>';
  h += '</div>';
  if (window.openModal) openModal('⏰ Trial Khatam', h);
}

/* ── Inject Free Trial button in Premium modal ── */
function injectTrialButton() {
  /* Wrap showPremiumUpgrade to inject trial option for non-trial users */
  if (window._trialInjected) return;
  window._trialInjected = true;

  var _orig = window.showPremiumUpgrade;
  window.showPremiumUpgrade = function() {
    /* If trial not used and not premium → show trial prompt first */
    var tier = window.getUserPremiumTier ? window.getUserPremiumTier() : 0;
    if (!tier && !window.isTrialUsed()) {
      _showTrialPrompt(function() {
        /* After trial prompt, also show full premium options */
        if (_orig) _orig.apply(this, arguments);
      });
      return;
    }
    if (_orig) _orig.apply(this, arguments);
  };
}

function _showTrialPrompt(onShowFull) {
  var h = '<div style="text-align:center;padding:8px 0 18px">';
  h += '<div style="font-size:42px;margin-bottom:8px">🎁</div>';
  h += '<div style="font-size:19px;font-weight:900;color:#e0e0e0;margin-bottom:6px">FREE Trial Milega!</div>';
  h += '<div style="font-size:13px;color:#888;margin-bottom:18px">Silver Premium ' + TRIAL_DAYS + ' din bilkul free try karo</div>';
  h += '<div style="background:rgba(224,224,224,.06);border:1px solid rgba(224,224,224,.2);border-radius:14px;padding:14px;margin-bottom:16px;text-align:left">';
  ['🚫 No Ads', '🥈 Silver Badge', '💬 Green Name Chat', '📊 5 GD Bonus'].forEach(function(p){
    h += '<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#ddd;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04)">' + p + '</div>';
  });
  h += '</div>';
  h += '<button onclick="window.startFreeTrial()" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,#e0e0e0,#aaa);color:#000;font-size:14px;font-weight:900;cursor:pointer;margin-bottom:10px">🎁 ' + TRIAL_DAYS + ' Din FREE Try Karo!</button>';
  h += '<button onclick="if(window.closeModal)closeModal();setTimeout(function(){' + (onShowFull ? 'window._origShowPremium&&window._origShowPremium()' : '') + '},300)" style="width:100%;padding:11px;border-radius:13px;border:none;background:rgba(255,255,255,.06);color:#888;font-size:12px;cursor:pointer">Seedha khareedna hai → Plans dekho</button>';
  h += '</div>';
  window._origShowPremium = window.showPremiumUpgrade;
  if (window.openModal) openModal('🎁 Free Trial', h);
}

/* ── Periodic Check: apply/remove perks, show expiry modal ── */
function checkTrialState() {
  var uid = window.U && window.U.uid;
  if (!uid) return;

  /* Real premium overrides trial */
  var realTier = window.getUserPremiumTier ? window.getUserPremiumTier() : 0;
  if (realTier > 0) { _removeTrialPerks(); return; }

  if (window.isTrialActive()) {
    _applyTrialPerks();

    /* Day 5 reminder */
    var t = window.getTrialStatus();
    if (t && !t.reminderSent) {
      var daysPassed = Math.floor((Date.now() - t.startedAt) / (24 * 60 * 60 * 1000));
      if (daysPassed >= 5) {
        t.reminderSent = true;
        localStorage.setItem(TRIAL_KEY + uid, JSON.stringify(t));
        if (window.toast) toast('⏰ Trial ke 2 din baaki — ₹49 mein continue karo!', 'inf');
      }
    }
  } else if (window.isTrialExpired()) {
    _removeTrialPerks();
    /* Show expiry modal once */
    var eKey = '_mes_trial_exp_shown_' + uid;
    if (!localStorage.getItem(eKey)) {
      localStorage.setItem(eKey, '1');
      setTimeout(_showTrialExpiredModal, 2000);
    }
  }
}

/* ── Override getUserPremiumTier to include trial ── */
var _origGetTier = null;
function wrapGetTier() {
  if (window._trialTierWrapped) return;
  window._trialTierWrapped = true;
  _origGetTier = window.getUserPremiumTier;
  window.getUserPremiumTier = function() {
    var real = _origGetTier ? _origGetTier() : 0;
    if (real > 0) return real;
    /* Trial counts as Silver (tier 1) */
    if (window.isTrialActive()) return 1;
    return 0;
  };
}

/* ── Init ── */
function initTrial() {
  if (!window.U || !window.getUserPremiumTier) {
    setTimeout(initTrial, 1000);
    return;
  }
  wrapGetTier();
  injectTrialButton();
  checkTrialState();
  /* Check every 30 min */
  setInterval(checkTrialState, 30 * 60 * 1000);
  console.log('[Mini eSports] Free Trial System v1.0 ✅');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(initTrial, 2500); });
} else {
  setTimeout(initTrial, 2500);
}
})();
