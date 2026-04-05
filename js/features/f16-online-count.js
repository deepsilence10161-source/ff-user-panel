/* =============================================
   FEATURE 16: Live Player Online Count
   - Header me "🟢 247 Online" dikhta hai
   - Firebase presence system se real count
   - Fallback: approximate count from recent logins
   ============================================= */
(function() {
  'use strict';

  var _onlineEl = null;
  var _presenceRef = null;

  function initPresence() {
    if (!window.db || !window.U) return;
    var uid = window.U.uid;
    _presenceRef = window.db.ref('presence/' + uid);

    // Use .info/connected for INSTANT online/offline detection
    window.db.ref('.info/connected').on('value', function(snap) {
      if (!snap.val()) return; // offline — Firebase will handle via onDisconnect
      var ign = (window.UD && window.UD.ign) || '';
      // Register onDisconnect FIRST — before set(), so it's atomic
      _presenceRef.onDisconnect().remove().then(function() {
        _presenceRef.set({ online: true, lastSeen: Date.now(), ign: ign });
      });
    });

    // Count online users — real-time listener
    window.db.ref('presence').on('value', function(s) {
      var count = 0;
      if (s.exists()) s.forEach(function() { count++; });
      updateOnlineDisplay(Math.max(count, 1));
    });
  }

  function updateOnlineDisplay(count) {
    var el = document.getElementById('f16OnlineCount');
    if (!el) return;
    el.textContent = '🟢 ' + count + ' Online';
  }

  function injectOnlineChip() {
    var hdrRight = document.querySelector('.hdr-right');
    if (!hdrRight || document.getElementById('f16OnlineCount')) return;

    var chip = document.createElement('div');
    chip.id = 'f16OnlineCount';
    chip.style.cssText = 'font-size:9px;font-weight:700;color:#00ff9c;padding:3px 7px;border-radius:8px;background:rgba(0,255,156,.08);border:1px solid rgba(0,255,156,.15);white-space:nowrap;flex-shrink:0';
    chip.textContent = '🟢 ...';

    // Insert before bell icon
    var bell = hdrRight.querySelector('.hdr-bell');
    if (bell) hdrRight.insertBefore(chip, bell);
    else hdrRight.appendChild(chip);
  }

  // Init
  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.db && window.U && window.UD) {
      clearInterval(_check);
      injectOnlineChip();
      initPresence();
    }
    if (_try > 30) clearInterval(_check);
  }, 1000);

  window.f16OnlineCount = { init: initPresence };
})();
