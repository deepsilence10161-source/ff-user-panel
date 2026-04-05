/* =============================================
   FEATURE 02: Match Popularity Badge
   - Har match card pe auto badge lagta hai
   - 80%+ slots = 🔥 Hot, 50-79% = 📈 Trending, <30% = ✨ New
   - mcHTML function ke baad automatically inject hota hai
   ============================================= */
(function() {
  'use strict';

  function getPopularityBadge(match) {
    var slots = Number(match.maxSlots) || 1;
    var joined = Number(match.joinedSlots) || 0;
    var pct = joined / slots;
    var now = Date.now();
    var timeDiff = (Number(match.matchTime) || 0) - now;
    var minsLeft = timeDiff / 60000;

    if (joined === 0) return '<span style="font-size:9px;padding:2px 7px;border-radius:20px;background:rgba(0,255,156,.12);color:#00ff9c;font-weight:700;margin-left:4px">✨ New</span>';
    if (pct >= 0.8) return '<span style="font-size:9px;padding:2px 7px;border-radius:20px;background:rgba(255,45,85,.15);color:#ff2d55;font-weight:700;margin-left:4px;animation:hotPulse 1.5s ease infinite">🔥 Hot</span>';
    if (pct >= 0.5) return '<span style="font-size:9px;padding:2px 7px;border-radius:20px;background:rgba(255,170,0,.12);color:#ffaa00;font-weight:700;margin-left:4px">📈 Trending</span>';
    if (minsLeft > 0 && minsLeft <= 60) return '<span style="font-size:9px;padding:2px 7px;border-radius:20px;background:rgba(0,212,255,.12);color:#00d4ff;font-weight:700;margin-left:4px">⚡ Soon</span>';
    return '';
  }

  // Inject CSS
  function injectCSS() {
    if (document.getElementById('f02CSS')) return;
    var s = document.createElement('style');
    s.id = 'f02CSS';
    s.textContent = '@keyframes hotPulse{0%,100%{opacity:1}50%{opacity:.6}}';
    document.head.appendChild(s);
  }

  // Hook into mcHTML to add badge
  function hookMcHTML() {
    var orig = window.mcHTML;
    if (!orig || window._f02Hooked) return;
    window._f02Hooked = true;

    window.mcHTML = function(t) {
      var html = orig.call(this, t);
      if (!html || !t) return html;

      var badge = getPopularityBadge(t);
      if (!badge) return html;

      // Inject after match name
      html = html.replace(
        /(<span class="mc-name"[^>]*>)(.*?)(<\/span>)/,
        '$1$2$3' + badge
      );
      return html;
    };
  }

  injectCSS();

  // Hook after app loads
  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.mcHTML) {
      clearInterval(_check);
      hookMcHTML();
    }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f02PopularityBadge = { getBadge: getPopularityBadge };
})();
