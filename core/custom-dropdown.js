/* ================================================================
   CUSTOM DROPDOWN — core/custom-dropdown.js
   BUG FIX (2026-08): native <select> dropdowns render as a plain
   WHITE, unstyleable OS-level popup on Android Chrome/WebView — no
   amount of CSS can theme them, which clashed hard with the app's
   dark theme (screenshots showed a jarring white popover over Status
   and Rank filters). Replaced with fully custom, dark-themed popover
   menus that behave the same way (tap → pick → closes) but stay
   entirely within our own styled DOM.
================================================================ */

var _DD_CONFIG = {
  homeStatusDd: {
    options: [
      { v: 'upcoming', l: '⏱️ Upcoming' },
      { v: 'live',     l: '🔴 Live' },
      { v: 'completed',l: '✅ Completed' }
    ],
    onSelect: function(v) { if (window.setST) setST('home', v); }
  },
  homeRankDd: {
    options: [
      { v: 'all',      l: 'All Ranks' },
      { v: 'Bronze',   l: '🏅 Bronze' },
      { v: 'Silver',   l: '🥈 Silver' },
      { v: 'Gold',     l: '🥇 Gold' },
      { v: 'Platinum', l: '🔷 Platinum' },
      { v: 'Diamond',  l: '💎 Diamond' },
      { v: 'Legend',   l: '👑 Legend' }
    ],
    onSelect: function(v) { window._rankFilter = v; if (window.renderHome) renderHome(); }
  },
  mmStatusDd: {
    options: [
      { v: 'upcoming', l: '⏱️ Upcoming' },
      { v: 'live',     l: '🔴 Live' },
      { v: 'completed',l: '✅ Completed' }
    ],
    onSelect: function(v) { if (window.setST) setST('mm', v); }
  }
};

var _ddOpenId = null;

function _closeAllCustomDd() {
  document.querySelectorAll('.dd-popover').forEach(function(p) { p.remove(); });
  _ddOpenId = null;
}

window._toggleCustomDd = function(id) {
  if (_ddOpenId === id) { _closeAllCustomDd(); return; }
  _closeAllCustomDd();

  var el = document.getElementById(id);
  var cfg = _DD_CONFIG[id];
  if (!el || !cfg) return;

  var pop = document.createElement('div');
  pop.className = 'dd-popover';
  pop.style.cssText = 'position:absolute;top:calc(100% + 6px);left:0;right:0;background:#151520;border:1.5px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.5);z-index:200;overflow:hidden';

  cfg.options.forEach(function(opt) {
    var row = document.createElement('div');
    row.textContent = opt.l;
    row.style.cssText = 'padding:12px 16px;font-size:13px;font-weight:700;color:#fff;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.05)';
    row.onmousedown = function(e) { e.preventDefault(); }; /* prevent blur races on touch */
    row.onclick = function(e) {
      e.stopPropagation();
      var cur = el.querySelector('.dd-current');
      if (cur) cur.textContent = opt.l;
      cfg.onSelect(opt.v);
      _closeAllCustomDd();
    };
    pop.appendChild(row);
  });

  el.style.position = 'relative';
  el.appendChild(pop);
  _ddOpenId = id;
};

/* Close popover when tapping anywhere outside it */
document.addEventListener('click', function(e) {
  if (!_ddOpenId) return;
  var openEl = document.getElementById(_ddOpenId);
  if (openEl && !openEl.contains(e.target)) _closeAllCustomDd();
});
