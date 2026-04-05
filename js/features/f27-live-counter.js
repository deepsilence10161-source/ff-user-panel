/* =============================================
   FEATURE 27: Live Match Counter on Homepage
   Shows "🔴 X players in live matches"
   Firebase: counts active joined players
   ============================================= */
(function() {
  'use strict';

  var _counter = 0;
  var _el = null;

  function updateCounter() {
    if (!window.db) return;
    window.db.ref('joinRequests').orderByChild('status').equalTo('joined').once('value', function(s) {
      var count = 0;
      if (s.exists()) {
        s.forEach(function(c) {
          var jr = c.val();
          // Count only recent joins (last 3 hours = likely in active match)
          var joinedAt = jr.joinedAt || jr.createdAt || 0;
          if ((Date.now() - joinedAt) < 3 * 60 * 60 * 1000) count++;
        });
      }
      _counter = count;
      renderCounter();
    });
  }

  function renderCounter() {
    var el = document.getElementById('liveMatchCounter');
    if (!el) return;
    if (_counter <= 0) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    el.innerHTML = '<span class="live-dot"></span><strong>' + _counter + '</strong>&nbsp;players ab matches mein hain 🎮';
  }

  // Inject counter HTML into home section if not exists
  function injectCounter() {
    var home = document.getElementById('section-home') || document.getElementById('homeContent');
    if (!home) return;
    if (document.getElementById('liveMatchCounter')) return;
    var div = document.createElement('div');
    div.id = 'liveMatchCounter';
    div.style.cssText = 'display:none;align-items:center;gap:8px;background:rgba(255,60,60,.08);border:1px solid rgba(255,60,60,.2);border-radius:12px;padding:10px 14px;margin:8px 0;font-size:13px;color:#ff6b6b;font-weight:600';
    home.insertBefore(div, home.firstChild);
    renderCounter();
  }

  var _try = 0;
  var _int = setInterval(function() {
    _try++;
    if (window.db) {
      clearInterval(_int);
      updateCounter();
      setInterval(updateCounter, 2 * 60 * 1000); // refresh every 2 min
    }
    if (_try > 30) clearInterval(_int);
  }, 1000);

  // Also hook renderHome
  var _h = setInterval(function() {
    if (window.renderHome && !window._f27Hooked) {
      window._f27Hooked = true;
      var orig = window.renderHome;
      window.renderHome = function() {
        orig.apply(this, arguments);
        setTimeout(injectCounter, 100);
        setTimeout(renderCounter, 200);
      };
    }
    clearInterval(_h);
  }, 500);

  window.f27LiveCounter = { update: updateCounter };
})();
