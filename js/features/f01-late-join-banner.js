/* =============================================
   FEATURE 01: Late Join Urgent Banner
   - Jab match me sirf 10% slots bache ya 15 min bacha ho
   - Home screen ke upar ek flashing red banner aata hai
   - User tap kare to match detail khulti hai
   ============================================= */
(function() {
  'use strict';

  var _lateInterval = null;
  var _lastLateMatchId = null;

  function checkLateJoin() {
    if (!window.MT || !window.UD) return;
    var now = Date.now();
    var bestMatch = null;
    var bestScore = 0;

    for (var id in window.MT) {
      var t = window.MT[id];
      if (!t || !t.maxSlots) continue;
      var es = window.effSt ? window.effSt(t) : (t.status || 'upcoming');
      if (es !== 'upcoming' && es !== 'live') continue;
      if (window.hasJ && window.hasJ(id)) continue; // already joined

      var slots = Number(t.maxSlots) || 1;
      var joined = Number(t.joinedSlots) || 0;
      var remaining = slots - joined;
      var slotPct = remaining / slots;
      var timeDiff = (Number(t.matchTime) || 0) - now;
      var minsLeft = Math.floor(timeDiff / 60000);

      // Score: urgent if <10% slots left OR <15 min left
      if (remaining <= 0) continue;
      var urgent = (slotPct <= 0.1 || (minsLeft > 0 && minsLeft <= 15));
      if (!urgent) continue;

      var score = (1 - slotPct) * 50 + Math.max(0, 15 - minsLeft);
      if (score > bestScore) { bestScore = score; bestMatch = t; }
    }

    var banner = document.getElementById('lateJoinBanner');
    if (!banner) return;

    if (bestMatch) {
      var slots2 = Number(bestMatch.maxSlots) || 1;
      var joined2 = Number(bestMatch.joinedSlots) || 0;
      var rem = slots2 - joined2;
      var minsLeft2 = Math.max(0, Math.floor(((Number(bestMatch.matchTime) || 0) - now) / 60000));
      var msg = '';
      if (rem <= 3) msg = '🚨 Sirf ' + rem + ' slot bacha! — ' + (bestMatch.name || 'Match');
      else if (minsLeft2 <= 15) msg = '⚡ ' + minsLeft2 + ' min mein start! — ' + (bestMatch.name || 'Match');
      else msg = '🔥 Jaldi karo! ' + rem + ' slots bache — ' + (bestMatch.name || 'Match');

      banner.textContent = msg;
      banner.style.display = 'block';
      banner.onclick = function() {
        if (window.showDet) window.showDet(bestMatch.id);
      };
      _lastLateMatchId = bestMatch.id;

      // Flash animation
      banner.style.animation = 'none';
      banner.offsetHeight; // reflow
      banner.style.animation = 'lateFlash 1s ease infinite';
    } else {
      banner.style.display = 'none';
      _lastLateMatchId = null;
    }
  }

  function injectBannerHTML() {
    var homeScreen = document.getElementById('scrHome');
    if (!homeScreen) return;
    if (document.getElementById('lateJoinBanner')) return;

    var banner = document.createElement('div');
    banner.id = 'lateJoinBanner';
    banner.style.cssText = 'display:none;padding:10px 14px;background:linear-gradient(135deg,#ff2d55,#ff6b35);color:#fff;font-size:13px;font-weight:800;border-radius:12px;margin:8px 0;cursor:pointer;text-align:center;letter-spacing:0.3px;box-shadow:0 4px 15px rgba(255,45,85,.4)';

    // Inject CSS
    if (!document.getElementById('lateJoinCSS')) {
      var style = document.createElement('style');
      style.id = 'lateJoinCSS';
      style.textContent = '@keyframes lateFlash{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.85;transform:scale(1.01)}}';
      document.head.appendChild(style);
    }

    var homeList = document.getElementById('homeList');
    if (homeList) homeScreen.insertBefore(banner, homeList);
  }

  function init() {
    injectBannerHTML();
    checkLateJoin();
    if (_lateInterval) clearInterval(_lateInterval);
    _lateInterval = setInterval(checkLateJoin, 30000);
  }

  // Wait for app to be ready
  var _initTry = 0;
  var _initCheck = setInterval(function() {
    _initTry++;
    if (window.MT && window.UD && document.getElementById('scrHome')) {
      clearInterval(_initCheck);
      init();
    }
    if (_initTry > 30) clearInterval(_initCheck);
  }, 1000);

  // Re-check when matches update
  window._f01_check = checkLateJoin;
  var _origRenderHome = window.renderHome;
  if (_origRenderHome) {
    window.renderHome = function() {
      _origRenderHome.apply(this, arguments);
      injectBannerHTML();
      checkLateJoin();
    };
  }

  window.f01LateJoinBanner = { check: checkLateJoin, init: init };
})();
