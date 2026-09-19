/* ====== FEATURE 1: LIVE COUNTDOWN TIMER ON MATCH CARDS ====== */
/* Shows real-time countdown on every match card, updates every second */
/* Bug 68 Fix: _timerInterval exposed as window._timerInterval so renderHome()
   can check !window._timerInterval before calling startMatchTimers() again.
   Without this, every renderHome() call creates a NEW interval → multiple intervals
   run simultaneously (effectively running "twice per second" or more). */

(function() {
  var _timerInterval = null;

  function startMatchTimers() {
    /* Bug 24 Fix: Guard against multiple concurrent intervals */
    if (_timerInterval) {
      clearInterval(_timerInterval);
      window._timerInterval = null;
    }
    _timerInterval = setInterval(function() {
      for (var mid in MT) {
        var el = document.getElementById('timer-' + mid);
        if (!el) continue;
        var t = MT[mid];
        /* L7 Fix: Stop timer for completed/cancelled matches immediately */
        var st = (t.status || t.matchStatus || '').toLowerCase();
        if (st === 'completed' || st === 'cancelled' || t.resultPublished) {
          el.textContent = st === 'cancelled' ? 'Cancelled' : 'Ended';
          el.style.color = '#666';
          el.style.animation = '';
          continue;
        }
        var mt = Number(t.matchTime);
        if (!mt) { el.textContent = ''; continue; }
        var diff = mt - (window.serverNow ? window.serverNow() : Date.now());

        if (diff > 86400000) {
          var days = Math.floor(diff / 86400000);
          el.textContent = days + 'd ' + Math.floor((diff % 86400000) / 3600000) + 'h';
          el.style.color = '#00d4ff';
        } else if (diff > 3600000) {
          var h = Math.floor(diff / 3600000);
          var m = Math.floor((diff % 3600000) / 60000);
          el.textContent = h + 'h ' + m + 'm';
          el.style.color = '#00d4ff';
        } else if (diff > 60000) {
          var m = Math.floor(diff / 60000);
          var s = Math.floor((diff % 60000) / 1000);
          el.textContent = m + 'm ' + s + 's';
          el.style.color = diff < 300000 ? '#ffaa00' : '#00d4ff';
        } else if (diff > 0) {
          var s = Math.floor(diff / 1000);
          el.textContent = '⚡ ' + s + 's';
          el.style.color = '#ff003c';
          el.style.fontWeight = '900';
          el.style.animation = 'pulse 0.5s infinite';
        } else if (diff > -1200000) {
          el.innerHTML = '<span style="color:#ff003c;animation:pulse 1.2s infinite">🔴 LIVE</span>';
        } else {
          el.textContent = 'Ended';
          el.style.color = '#666';
        }
      }
    }, 1000);
    /* Bug 68 Fix: Expose interval ID as window._timerInterval so home.js guard works */
    window._timerInterval = _timerInterval;
  }

  /* Bug 24 Fix: Debounced wrapper prevents rapid re-calls after each renderHome
     (listeners.js calls renderHome on every MT change — each would restart timers) */
  var _timerDebounce = null;
  function debouncedStartTimers() {
    clearTimeout(_timerDebounce);
    _timerDebounce = setTimeout(startMatchTimers, 150);
  }

  /* Hook into renderHome to start timers after cards are rendered.
     Use debounced version to coalesce rapid successive render calls. */
  var _origRenderHome = window.renderHome;
  if (_origRenderHome) {
    window.renderHome = function() {
      _origRenderHome();
      debouncedStartTimers();
    };
  }

  var _origRenderSP = window.renderSP;
  if (_origRenderSP) {
    window.renderSP = function() {
      _origRenderSP();
      debouncedStartTimers();
    };
  }

  /* Export for manual use */
  window.startMatchTimers = startMatchTimers;

  console.log('[Mini eSports] ✅ Feature 1: Match Timer loaded (Bug 68/24 fixed)');
})();
