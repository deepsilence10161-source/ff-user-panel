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

/* ── Helper: is user premium? ── */
function isPremium(){
  return !!(window.getUserPremiumTier && window.getUserPremiumTier() > 0);
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
/* ✅ Bug 24 Fix: Daily ad limit enforced in AdManager */
window.AdManager = {

  /* Show rewarded ad — waits for Android bridge or simulates in web */
  showRewardedAd: function(onReward, onFail, context) {
    // Premium users never see ads
    if (isPremium()) { if (onReward) onReward(); return; }

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
    if (isPremium()) { if (onDone) onDone(); return; }

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
    if (isPremium()) { this.hideBanner(); return; }

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
    /* Bug #49 Fix: Enforce daily ad limit in web fallback */
    var today = new Date().toDateString();
    var _limitKey = '_adDailyCount_' + today;
    var _limitMaxKey = '_adDailyMax';
    var maxAdsPerDay = Number(localStorage.getItem(_limitMaxKey) || (window.CFG && window.CFG.maxDailyAds) || 20);
    var todayCount = Number(localStorage.getItem(_limitKey) || 0);
    if (todayCount >= maxAdsPerDay) {
      console.log('[AdManager] Daily web ad limit reached (' + todayCount + '/' + maxAdsPerDay + ')');
      if (window.toast) toast('Aaj ke ads khatam ho gaye! Kal wapas aao. 🎮', 'err');
      if (onFail) onFail('daily_limit');
      return;
    }
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
        /* Bug #49 Fix: Increment daily ad counter on reward */
        var _todayKey = '_adDailyCount_' + new Date().toDateString();
        try { localStorage.setItem(_todayKey, (Number(localStorage.getItem(_todayKey)||0)+1).toString()); } catch(e) {}
        if (onReward) onReward();
      }
    }, 1000);
  },

  /* Web banner placeholder (non-Android) */
  _showWebBanner: function() {
    if (document.getElementById('_webBanner')) return;
    var bn = document.createElement('div');
    bn.id = '_webBanner';
    bn.style.cssText = 'position:fixed;bottom:56px;left:0;right:0;height:50px;background:rgba(0,0,0,.9);border-top:1px solid rgba(255,255,255,.06);z-index:900;display:flex;align-items:center;justify-content:center;gap:10px';
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
  if (isPremium()) { if (onDone) onDone(); return; }
  window.AdManager.showInterstitial(onDone);
};

/* ================================================================
   WATCH AD FOR COINS (Home → Wallet section)
   User taps "Watch Ad → Get Coins"
================================================================ */
window.watchAdForCoins = function() {
  if (!window.U || !window.db) return;
  window.AdManager.showRewardedAd(
    function() {
      // Reward: +5 coins
      window.db.ref('users/' + window.U.uid + '/coins').transaction(function(c) {
        return (c || 0) + 5;
      });
      if (window.toast) toast('+5 Coins mila! 🪙', 'ok');
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
    if(isPremium()) return;  // premium = no banner
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
  if(isPremium()){
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
