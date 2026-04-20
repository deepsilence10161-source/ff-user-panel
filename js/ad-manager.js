/* =============================================
   AD MANAGER — Rewarded Ads for Ad Matches
   Supports: Android WebView, Web fallback (simulation)
   ============================================= */
var AdManager = {
  rewardedAdUnitId: "ca-app-pub-REPLACE_YOUR_ADMOB_ID/REWARDED",
  interstitialAdUnitId: "ca-app-pub-REPLACE_YOUR_ADMOB_ID/INTERSTITIAL",
  bannerAdUnitId: "ca-app-pub-REPLACE_YOUR_ADMOB_ID/BANNER",

  /* Show a single rewarded ad */
  showRewardedAd: function(onReward, onFail) {
    // Android WebView SDK
    if (window.Android && window.Android.showRewardedAd) {
      window._adOnReward = onReward;
      window._adOnFail = onFail;
      window.Android.showRewardedAd();
      return;
    }
    // Web simulation fallback
    this._simulateAd(onReward, onFail);
  },

  /* Simulate ad for web testing */
  _simulateAd: function(onReward, onFail) {
    var sec = 5;
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff';
    var brands = ['🎮 Gaming Pro', '📱 App Update', '🛒 Shop Now', '🏆 Win Tournaments'];
    var brand = brands[Math.floor(Math.random() * brands.length)];
    overlay.innerHTML =
      '<div style="font-size:11px;color:#aaa;margin-bottom:8px">Advertisement</div>' +
      '<div style="font-size:26px;font-weight:900;margin-bottom:10px">' + brand + '</div>' +
      '<div style="width:72px;height:72px;border-radius:50%;background:rgba(0,255,156,.1);border:3px solid #00ff9c;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#00ff9c" id="_simAdTimer">' + sec + '</div>' +
      '<div style="font-size:10px;color:#444;margin-top:10px">Cannot skip</div>';
    document.body.appendChild(overlay);
    var iv = setInterval(function() {
      sec--;
      var el = document.getElementById('_simAdTimer');
      if (el) el.textContent = sec;
      if (sec <= 0) {
        clearInterval(iv);
        overlay.remove();
        if (onReward) onReward();
      }
    }, 1000);
  },

  /* For Ad Match: show required ads before joining */
  showForAdMatch: function(matchId, adsRequired, onComplete) {
    var count = 0;
    var self = this;
    var showNext = function() {
      if (count >= adsRequired) {
        sessionStorage.setItem('ad_' + matchId, 'true');
        if (onComplete) onComplete(true);
        return;
      }
      self.showRewardedAd(
        function() { count++; showNext(); },
        function() { if (onComplete) onComplete(false); }
      );
    };
    showNext();
  }
};

// Android callback bridge
window.onAdRewarded = function() {
  if (window._adOnReward) { window._adOnReward(); window._adOnReward = null; }
};
window.onAdFailed = function() {
  if (window._adOnFail) { window._adOnFail(); window._adOnFail = null; }
};

window.AdManager = AdManager;
