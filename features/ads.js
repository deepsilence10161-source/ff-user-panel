/* ================================================================
   MINI eSPORTS — AD MANAGER v3.0
   Real AdMob IDs integrated + Android WebView bridge
   ================================================================
   App ID:       ca-app-pub-1032532795123223~9674995485
   Rewarded:     ca-app-pub-1032532795123223/5092857849  (MatchJoinReward)
   Interstitial: ca-app-pub-1032532795123223/7817221971  (MatchEndInterstitial)
   Banner:       ca-app-pub-1032532795123223/9718498564  (AppBanner)
   ================================================================
   Rules (as per your model):
   · Rewarded ads ONLY — user khud dekhna chahta ho
   · Banner + Interstitial: sirf non-premium users ko
   · Premium users ko koi bhi ad nahi dikhega
   · Ad dekhne par: Coins milenge (Ad Match flow)
================================================================ */
(function(){
'use strict';

/* ── Real AdMob IDs ── */
var ADMOB = {
  appId:           'ca-app-pub-1032532795123223~9674995485',
  rewarded:        'ca-app-pub-1032532795123223/5092857849',   // MatchJoinReward
  interstitial:    'ca-app-pub-1032532795123223/7817221971',   // MatchEndInterstitial
  banner:          'ca-app-pub-1032532795123223/9718498564',   // AppBanner
};
window.ADMOB_IDS = ADMOB;

/* Bug 26 Fix: Cache TTL reduced from 30s → 5s.
   30s cache meant a newly-subscribed premium user still saw ads for up to 30 seconds.
   5s is fast enough to avoid excess reads while giving near-instant ad removal. */
var _premCache = { tier: 0, exp: 0, checked: 0 };

/* Called by premium.js after a successful purchase to instantly remove ads */
window._invalidateAdPremiumCache = function() {
  _premCache = { tier: 0, exp: 0, checked: 0 };
  /* Re-check immediately and hide banner if now premium */
  if (typeof _adIsPremium === 'function' && _adIsPremium()) {
    if (window.AdManager) window.AdManager.hideBanner();
    var ov = document.getElementById('_adOverlay');
    if (ov) ov.remove();
  }
};

function _adIsPremium() {
  var now = Date.now();
  if (now - _premCache.checked < 5000) { /* Bug 26 Fix: 30000 → 5000 */
    /* Serve from cache */
    return _premCache.tier > 0 && (_premCache.exp === 0 || _premCache.exp > now);
  }
  /* Refresh cache from UD */
  var ud = window.UD;
  if (!ud) { _premCache = { tier: 0, exp: 0, checked: now }; return false; }
  if (ud.isPremium === true) { _premCache = { tier: 1, exp: 0, checked: now }; return true; }
  var tier = Number(ud.premium_level || ud.premiumLevel || (ud.premium && ud.premium.tier) || 0);
  var exp  = (ud.premium && ud.premium.expiresAt) ? Number(ud.premium.expiresAt) : 0;
  _premCache = { tier: tier, exp: exp, checked: now };
  return tier > 0 && (exp === 0 || exp > now);
}

/* ── Helper: is Android WebView? ── */
function isAndroid(){
  return !!(window.Android && typeof window.Android.showRewardedAd === 'function');
}

/* ── Helper: is AdMob SDK loaded? (for native Android) ── */
function hasAdMobSDK(){
  return isAndroid();
}

/* ================================================================
   REWARDED AD — MatchJoinReward
   ca-app-pub-1032532795123223/5092857849
   Used in: Ad Match join flow, Watch Ad for Coins
================================================================ */
window.AdManager = {

  /* Show rewarded ad — waits for Android bridge or simulates in web */
  showRewardedAd: function(onReward, onFail, context) {
    // Premium users never see ads
    if (_adIsPremium()) { if (onReward) onReward(); return; }

    if (isAndroid()) {
      /* ── Android WebView bridge ──
         Android side must implement:
         - Android.showRewardedAd(adUnitId)
         - calls window.onAdRewarded() on success
         - calls window.onAdFailed(reason) on failure
      */
      window._adOnReward = onReward;
      window._adOnFail   = onFail;
      window._adContext  = context || null;
      try {
        // Pass actual AdMob unit ID to Android
        if (typeof window.Android.showRewardedAd === 'function') {
          window.Android.showRewardedAd(ADMOB.rewarded);
        } else {
          window.Android.showRewardedAd(); // legacy bridge
        }
      } catch(e) {
        console.warn('[AdManager] Android.showRewardedAd failed:', e);
        this._webFallback(onReward, onFail, 'rewarded');
      }
      return;
    }

    // Web/PWA fallback — simulate 5s ad countdown
    this._webFallback(onReward, onFail, 'rewarded');
  },

  /* Show interstitial at match end — non-premium only */
  showInterstitial: function(onDone) {
    if (_adIsPremium()) { if (onDone) onDone(); return; }

    if (isAndroid()) {
      window._intOnDone = onDone;
      try {
        if (typeof window.Android.showInterstitialAd === 'function') {
          window.Android.showInterstitialAd(ADMOB.interstitial);
        } else if (typeof window.Android.showInterstitial === 'function') {
          window.Android.showInterstitial(ADMOB.interstitial);
        }
      } catch(e) {
        console.warn('[AdManager] Interstitial failed:', e);
        if (onDone) onDone();
      }
      return;
    }
    // Web: skip silently (don't simulate interstitial in web)
    if (onDone) onDone();
  },

  /* Show banner — loads at bottom of screen for non-premium */
  showBanner: function() {
    if (_adIsPremium()) { this.hideBanner(); return; }

    if (isAndroid()) {
      try {
        if (typeof window.Android.showBannerAd === 'function') {
          window.Android.showBannerAd(ADMOB.banner);
        } else if (typeof window.Android.showBanner === 'function') {
          window.Android.showBanner(ADMOB.banner);
        }
      } catch(e) {
        console.warn('[AdManager] Banner failed:', e);
      }
      return;
    }
    // Web: show simple placeholder banner
    this._showWebBanner();
  },

  hideBanner: function() {
    if (isAndroid()) {
      try {
        if (typeof window.Android.hideBannerAd === 'function') window.Android.hideBannerAd();
        else if (typeof window.Android.hideBanner === 'function') window.Android.hideBanner();
      } catch(e) {}
    }
    var wb = document.getElementById('_webBanner');
    if (wb) wb.remove();
  },

  /* Ad Match: show N rewarded ads before join */
  showForAdMatch: function(matchId, adsRequired, onComplete) {
    var count = 0;
    var self  = this;
    function showNext() {
      if (count >= adsRequired) {
        sessionStorage.setItem('_adDone_' + matchId, Date.now());
        if (onComplete) onComplete(true);
        return;
      }
      self.showRewardedAd(
        function() { count++; showNext(); },
        function() { if (onComplete) onComplete(false); },
        'adMatch_' + matchId
      );
    }
    showNext();
  },

  /* ── Web fallback: realistic ad simulation ── */
  _webFallback: function(onReward, onFail, type) {
    var sec = 5;
    var adBrands = [
      { icon: '🎮', name: 'Gaming Pro App',    sub: 'Level up your game!' },
      { icon: '📱', name: 'App Store Pick',     sub: 'Top rated this week' },
      { icon: '🏆', name: 'Tournament Master', sub: 'Play. Win. Repeat.' },
      { icon: '🛡️', name: 'VPN Shield',        sub: 'Stay secure online' },
    ];
    var brand = adBrands[Math.floor(Math.random() * adBrands.length)];
    var ov = document.createElement('div');
    ov.id = '_adOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:inherit';

    ov.innerHTML =
      '<div style="position:absolute;top:14px;left:16px;font-size:10px;color:#555;letter-spacing:1px">ADVERTISEMENT</div>' +
      '<div style="position:absolute;top:10px;right:16px;padding:4px 10px;border-radius:6px;background:rgba(255,255,255,.08);font-size:10px;color:#888" id="_adSkipBtn">Skip in <span id="_adSkipSec">' + sec + '</span>s</div>' +
      '<div style="text-align:center;padding:0 32px">' +
        '<div style="font-size:64px;margin-bottom:12px">' + brand.icon + '</div>' +
        '<div style="font-size:22px;font-weight:900;margin-bottom:6px">' + brand.name + '</div>' +
        '<div style="font-size:13px;color:#888;margin-bottom:24px">' + brand.sub + '</div>' +
        '<div style="width:80px;height:80px;border-radius:50%;background:rgba(0,255,106,.08);border:3px solid #00ff9c;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#00ff9c;margin:0 auto" id="_adCountRing">' + sec + '</div>' +
        '<div style="font-size:11px;color:#444;margin-top:12px">Ad band nahi kar sakte — reward ke liye dekho</div>' +
      '</div>';

    document.body.appendChild(ov);

    var iv = setInterval(function() {
      sec--;
      var ring = document.getElementById('_adCountRing');
      var skipSec = document.getElementById('_adSkipSec');
      if (ring) ring.textContent = sec;
      if (skipSec) skipSec.textContent = sec > 0 ? sec : '✓';
      if (sec <= 0) {
        clearInterval(iv);
        ov.remove();
        if (onReward) onReward();
      }
    }, 1000);
  },

  /* Web banner placeholder (non-Android) */
  _showWebBanner: function() {
    if (document.getElementById('_webBanner')) return;
    var bn = document.createElement('div');
    bn.id = '_webBanner';
    bn.style.cssText = 'position:fixed;bottom:calc(56px + env(safe-area-inset-bottom));left:0;right:0;height:50px;background:rgba(0,0,0,.9);border-top:1px solid rgba(255,255,255,.06);z-index:900;display:flex;align-items:center;justify-content:center;gap:10px';
    bn.innerHTML = '<span style="font-size:10px;color:#555">AD</span><span style="font-size:12px;color:#888">Mini eSports — Tournament Platform</span><span style="font-size:10px;color:#555">AD</span>';
    document.body.appendChild(bn);
  }
};

/* ================================================================
   ANDROID → JS CALLBACKS
   Android native code calls these after ad events
================================================================ */

/* Rewarded ad completed → give reward */
window.onAdRewarded = function(adUnitId) {
  console.log('[AdManager] onAdRewarded called, unit:', adUnitId);
  if (window._adOnReward) {
    var cb = window._adOnReward;
    window._adOnReward = null;
    cb();
  }
};

/* Rewarded ad failed */
window.onAdFailed = function(reason) {
  console.warn('[AdManager] Ad failed:', reason);
  if (window._adOnFail) {
    var cb = window._adOnFail;
    window._adOnFail = null;
    cb(reason);
  }
};

/* Interstitial dismissed */
window.onInterstitialDismissed = function() {
  console.log('[AdManager] Interstitial dismissed');
  if (window._intOnDone) {
    var cb = window._intOnDone;
    window._intOnDone = null;
    cb();
  }
};

/* Banner loaded */
window.onBannerLoaded = function() {
  console.log('[AdManager] Banner loaded ✅');
};

/* ================================================================
   MATCH-END INTERSTITIAL
   Show after result is viewed — non-premium only
================================================================ */
window.showMatchEndAd = function(onDone) {
  if (_adIsPremium()) { if (onDone) onDone(); return; }
  window.AdManager.showInterstitial(onDone);
};

/* ================================================================
   WATCH AD FOR COINS (Home → Wallet section)
   User taps "Watch Ad → Get Coins"
================================================================ */
window.watchAdForCoins = function() {
  if (!window.U || !window.db) return;
  /* Cross-cutting #3 Fix: Ads require live network connection to the ad server.
     Show a clear message instead of silently failing when offline. */
  if (!navigator.onLine) {
    if (window.toast) toast('📡 Internet nahi hai. Online hone ke baad ads dekh sakte ho.', 'err');
    return;
  }

  /* Daily limit check — adDailyLimit from CFG (default 5) */
  var dailyLimit = (window.CFG && window.CFG.adDailyLimit) ? Number(window.CFG.adDailyLimit) : 5;
  var todayKey   = new Date().toISOString().split('T')[0];
  var _adStorKey = '_adWatched_' + todayKey + '_' + window.U.uid;
  var watchedToday = parseInt(localStorage.getItem(_adStorKey) || '0');
  if (watchedToday >= dailyLimit) {
    if (window.toast) toast('Aaj ke saare ' + dailyLimit + ' ads dekh chuke ho. Kal wapas aao! 🌙', 'err');
    return;
  }

  window.AdManager.showRewardedAd(
    function() {
      /* Increment daily count */
      try { localStorage.setItem(_adStorKey, String(watchedToday + 1)); } catch(e) {}
      /* Reward: use CFG value (default 10), fallback 5 */
      var coinReward = (window.CFG && window.CFG.adCoinsPerWatch) ? Number(window.CFG.adCoinsPerWatch) : 10;
      /* ✅ Supabase ONLY — no Firebase double-credit */
      if (window._supa && window.U) {
        window._supa.rpc('increment_balance', { p_uid: window.U.uid, p_col: 'coins', p_amount: coinReward }).then(null, function(){});
        if (window.UD) window.UD.coins = (window.UD.coins || 0) + coinReward;
        if (window.updateHdr) window.updateHdr();
      }
      if (window.analytics) window.analytics.adWatched();
      var remaining = dailyLimit - (watchedToday + 1);
      if (window.toast) toast('+' + coinReward + ' Coins mila! 🪙' + (remaining > 0 ? ' (' + remaining + ' ads baaki aaj)' : ' (Aaj ka limit complete! 🎉)'), 'ok');
    },
    function() {
      if (window.toast) toast('Ad load nahi hua, dobara try karo.', 'err');
    },
    'watchForCoins'
  );
};

/* Legacy bridge compat */
window.onAdReward = window.onAdRewarded;

/* ================================================================
   BANNER AUTO-SHOW
   Show banner on home screen for non-premium users
   Hide when navigating to premium-gated screens
================================================================ */
(function initBanner(){
  function tryShow(){
    if(!window.UD) { setTimeout(tryShow, 800); return; }
    if(_adIsPremium()) return;  // premium = no banner
    window.AdManager.showBanner();
  }
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(tryShow, 1500); });
  } else {
    setTimeout(tryShow, 1500);
  }
})();

/* ================================================================
   PREMIUM CHECK — hide all ads if user upgrades mid-session
================================================================ */
var _lastPremCheck = 0;
window.recheckAds = function(){
  var now = Date.now();
  if(now - _lastPremCheck < 10000) return;
  _lastPremCheck = now;
  if(_adIsPremium()){
    window.AdManager.hideBanner();
    // Remove any lingering ad overlays
    var ov = document.getElementById('_adOverlay');
    if(ov) ov.remove();
    var wb = document.getElementById('_webBanner');
    if(wb) wb.remove();
  }
};

/* ================================================================
   ADMOB HEALTH CHECK — verify IDs are correct on load
================================================================ */
(function healthCheck(){
  console.log(
    '[AdMob] IDs loaded:\n' +
    '  App:          ' + ADMOB.appId + '\n' +
    '  Rewarded:     ' + ADMOB.rewarded + ' (MatchJoinReward)\n' +
    '  Interstitial: ' + ADMOB.interstitial + ' (MatchEndInterstitial)\n' +
    '  Banner:       ' + ADMOB.banner + ' (AppBanner)\n' +
    '  Android SDK:  ' + (isAndroid() ? '✅ Connected' : '⚠️ Not connected (web mode)')
  );
})();

console.log('[Mini eSports] Ad Manager v3.0 ✅');
})();

/* ── showAdEarn: called from coin shop — opens watch-earn panel ── */
window.showAdEarn = function() {
  /* Watch & Earn: watch ads to earn coins */
  if (window.watchAdForCoins) {
    watchAdForCoins();
    return;
  }
  if (window.openModal) openModal('📺 Watch & Earn',
    '<div style="text-align:center;padding:20px">' +
    '<div style="font-size:40px;margin-bottom:12px">📺</div>' +
    '<p style="font-size:14px;color:var(--txt2)">Ad dekho aur +5 Coins pao!</p>' +
    '<button onclick="closeModal();if(window.watchAdForCoins)watchAdForCoins();" ' +
    'style="margin-top:14px;padding:12px 28px;border-radius:12px;border:none;' +
    'background:var(--primary);color:#000;font-weight:800;font-size:14px;cursor:pointer">▶ Watch Ad</button>' +
    '</div>');
};
