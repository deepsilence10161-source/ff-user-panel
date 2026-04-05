/* ============================================================
   FIX 10: SERVER TIME OFFSET — USER PANEL
   - Firebase .info/serverTimeOffset user panel mein bhi use karo
   - effSt() ab server-synced time use karta hai
   - Match timer bhi server time pe based hoga
   ============================================================ */

(function() {
  'use strict';

  var _serverOffset = 0;   // milliseconds: serverTime = Date.now() + _serverOffset
  var _offsetReady  = false;
  var _syncInterval = null;

  /* ── Fetch server time offset ── */
  function syncOffset() {
    if (!window.db) return;
    db.ref('.info/serverTimeOffset').once('value', function(s) {
      _serverOffset = Number(s.val()) || 0;
      _offsetReady  = true;
      console.log('[ServerTime] Offset synced:', _serverOffset, 'ms');
      /* Re-render after sync so match states are correct */
      if (window.renderHome) renderHome();
      if (window.renderMM)   renderMM();
    });
  }

  /* ── Real-time offset listener (updates if clock drifts) ── */
  function startOffsetListener() {
    if (!window.db) return;
    db.ref('.info/serverTimeOffset').on('value', function(s) {
      var newOffset = Number(s.val()) || 0;
      if (Math.abs(newOffset - _serverOffset) > 1000) {
        /* Significant drift — update and re-render */
        _serverOffset = newOffset;
        _offsetReady  = true;
        if (window.renderHome) renderHome();
        if (window.renderMM)   renderMM();
      } else {
        _serverOffset = newOffset;
        _offsetReady  = true;
      }
    });
  }

  /* ── Public API ── */
  window.serverNow = function() {
    return Date.now() + _serverOffset;
  };

  window.getServerOffset = function() { return _serverOffset; };

  /* ── Patch effSt() to use server time ── */
  function patchEffSt() {
    var _origEffSt = window.effSt;
    if (!_origEffSt || window._effStPatched) return;
    window._effStPatched = true;

    window.effSt = function(t) {
      if (!t) return 'upcoming';
      var st = (t.status || '').toString().toLowerCase().trim();

      /* Admin-controlled terminal states (HIGHEST PRIORITY) */
      if (st === 'cancelled' || st === 'canceled')               return 'cancelled';
      if (st === 'resultpublished' || st === 'result_published') return 'resultPublished';
      if (st === 'completed' || st === 'finished' || st === 'ended' || st === 'done') return 'completed';

      var mt = Number(t.matchTime);
      if (!mt || mt <= 0) return st || 'upcoming';

      /* ✅ FIX: Use server-synced time instead of Date.now() */
      var now    = window.serverNow();
      var relMin = Number(t.roomReleaseMinutes) || 5;
      var liveAt = mt - (relMin * 60000);

      if (t.roomStatus === 'released' || t.roomReleasedAt) {
        liveAt = Math.min(liveAt, Number(t.roomReleasedAt) || liveAt);
      }

      if (now < liveAt) return 'upcoming';
      if (now >= liveAt && now < mt + 3600000) return 'live';
      return 'completed';
    };

    console.log('[ServerTime] effSt() patched to use server time.');
  }

  /* ── Patch match countdown displays ── */
  window._serverCountdown = function(targetTime) {
    var remaining = targetTime - window.serverNow();
    if (remaining <= 0) return '00:00';
    var m = Math.floor(remaining / 60000);
    var s = Math.floor((remaining % 60000) / 1000);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  };

  /* ── Re-sync periodically to catch clock drift (every 5 min) ── */
  function startPeriodicSync() {
    clearInterval(_syncInterval);
    _syncInterval = setInterval(syncOffset, 5 * 60 * 1000);
  }

  /* ── Initialize ── */
  function init() {
    if (!window.db) {
      /* Wait for db to be available */
      var _wait = setInterval(function() {
        if (window.db) { clearInterval(_wait); init(); }
      }, 200);
      return;
    }
    startOffsetListener();
    startPeriodicSync();
    /* Patch effSt after a tick (let app.js define it first) */
    setTimeout(patchEffSt, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Mini eSports] ✅ Fix 10: Server Time Sync loaded.');
})();
