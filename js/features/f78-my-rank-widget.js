/* =============================================
   FEATURE 33: My Rank Widget - Special Screen only
   Slim bar showing rank + eligibility badge
   ============================================= */
(function() {
  'use strict';

  var _rank = null, _total = null;

  function fetchRank() {
    if (!window.db || !window.U) return;
    window.db.ref('users').orderByChild('stats/earnings').once('value', function(s) {
      var users = [];
      if (s.exists()) s.forEach(function(c) {
        users.push({ uid: c.key, e: (c.val().stats || {}).earnings || 0 });
      });
      users.sort(function(a, b) { return b.e - a.e; });
      _total = users.length;
      var idx = users.findIndex(function(u) { return u.uid === window.U.uid; });
      _rank = idx >= 0 ? idx + 1 : _total + 1;
      renderWidget();
    });
  }

  function badge() {
    if (!_rank) return '';
    if (_rank <= 96)  return '<span style="background:rgba(255,60,60,.2);color:#ff4500;border-radius:12px;padding:3px 10px;font-size:10px;font-weight:800">🔴 Sunday Eligible</span>';
    if (_rank <= 200) return '<span style="background:rgba(255,170,0,.15);color:#ffaa00;border-radius:12px;padding:3px 10px;font-size:10px;font-weight:700">🟡 Top 200</span>';
    if (_rank <= 400) return '<span style="background:rgba(0,212,255,.12);color:#00d4ff;border-radius:12px;padding:3px 10px;font-size:10px;font-weight:700">🔵 Top 400</span>';
    return '<span style="background:rgba(255,255,255,.06);color:#666;border-radius:12px;padding:3px 10px;font-size:10px">Keep playing!</span>';
  }

  function renderWidget() {
    var el = document.getElementById('f33RankWidget');
    if (!el || !_rank) return;
    el.style.display = 'flex';
    /* Slim row - full width */
    el.innerHTML =
      '<div style="display:flex;flex-direction:row;align-items:center;width:100%;gap:10px">' +
        '<div style="display:flex;align-items:center;gap:6px;flex:1">' +
          '<span style="font-size:11px;color:#888">Your Rank</span>' +
          '<span style="font-size:16px;font-weight:900;color:#00ff9c">#' + _rank + '</span>' +
          '<span style="font-size:11px;color:#555">of ' + _total + '</span>' +
        '</div>' +
        '<div>' + badge() + '</div>' +
      '</div>';
  }

  function injectWidget() {
    /* Inject into Special screen ONLY - before the toggle */
    var spScreen = document.getElementById('scrSpecial');
    if (!spScreen || document.getElementById('f33RankWidget')) return;
    var toggle = spScreen.querySelector('.sp-toggle');
    if (!toggle) return;

    var div = document.createElement('div');
    div.id = 'f33RankWidget';
    /* Slim height - just a bar */
    div.style.cssText = 'display:none;align-items:center;' +
      'background:rgba(0,255,156,.04);border:1px solid rgba(0,255,156,.1);' +
      'border-radius:12px;padding:8px 14px;margin:6px 12px 6px;';
    toggle.parentNode.insertBefore(div, toggle);
    fetchRank();
  }

  var _t = 0, _int = setInterval(function() {
    _t++;
    if (window.db && window.U && window.UD) {
      clearInterval(_int);
      setTimeout(injectWidget, 1200);
      setInterval(fetchRank, 5 * 60 * 1000);
    }
    if (_t > 60) clearInterval(_int);
  }, 1000);

  /* Hook renderSP */
  var _h = setInterval(function() {
    if (window.renderSP && !window._f33h) {
      clearInterval(_h); window._f33h = true;
      var o = window.renderSP;
      window.renderSP = function() {
        o.apply(this, arguments);
        setTimeout(function() { if (!document.getElementById('f33RankWidget')) injectWidget(); }, 200);
      };
    }
  }, 500);

  window.f33MyRank = { fetch: fetchRank, render: renderWidget };
})();
