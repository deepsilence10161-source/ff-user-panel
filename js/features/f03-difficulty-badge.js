/* =============================================
   FEATURE 03: Match Difficulty Badge
   - Admin match me difficulty field set kare: beginner/intermediate/pro
   - Match card pe colored badge dikhta hai
   - Admin panel me difficulty dropdown add hota hai
   ============================================= */
(function() {
  'use strict';

  var LEVELS = {
    beginner:     { label: 'Beginner',     color: '#00ff9c', bg: 'rgba(0,255,156,.12)',   icon: '🟢' },
    intermediate: { label: 'Intermediate', color: '#ffaa00', bg: 'rgba(255,170,0,.12)',   icon: '🟡' },
    pro:          { label: 'Pro',          color: '#ff2d55', bg: 'rgba(255,45,85,.12)',    icon: '🔴' },
    expert:       { label: 'Expert',       color: '#b964ff', bg: 'rgba(185,100,255,.12)', icon: '💜' }
  };

  function getDiffBadge(match) {
    var diff = (match.difficulty || '').toLowerCase().trim();
    var cfg = LEVELS[diff];
    if (!cfg) return '';
    return '<span style="font-size:9px;padding:2px 8px;border-radius:20px;background:' + cfg.bg + ';color:' + cfg.color + ';font-weight:700;border:1px solid ' + cfg.color + '44;margin-left:4px">' + cfg.icon + ' ' + cfg.label + '</span>';
  }

  // Hook into mcHTML
  function hookMcHTML() {
    var orig = window.mcHTML;
    if (!orig || window._f03Hooked) return;
    window._f03Hooked = true;

    window.mcHTML = function(t) {
      var html = orig.call(this, t);
      if (!html || !t || !t.difficulty) return html;

      var badge = getDiffBadge(t);
      if (!badge) return html;

      // Add after mode badge
      html = html.replace(
        /(<div class="mc-badges">)([\s\S]*?)(<\/div>)/,
        function(m, p1, p2, p3) {
          return p1 + p2 + badge + p3;
        }
      );
      return html;
    };
  }

  // Hook after app loads
  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.mcHTML) { clearInterval(_check); hookMcHTML(); }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f03DifficultyBadge = { getLevels: function() { return LEVELS; }, getBadge: getDiffBadge };
})();
