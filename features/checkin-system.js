/* ================================================================
   PRE-MATCH CHECK-IN SYSTEM — checkin-system.js
   
   Admin sets:
   - checkInOpenMins: kitne min pehle check-in khulega (default 30)
   - checkInCloseMins: kitne min pehle check-in band (default 5)
   
   Firebase:
   matches/{matchId}/checkIns/{uid}: { uid, ign, checkedAt }
   matches/{matchId}/checkInOpen: boolean
   ================================================================ */

(function() {
'use strict';

var _checkInTimers = {};

/* ── Check if check-in window is open ── */
window.isCheckInOpen = function(t) {
  if (!t || !t.matchTime) return false;
  var cfg = window.CFG || {};
  var openMins  = Number(cfg.checkInOpenMins  || 30);
  var closeMins = Number(cfg.checkInCloseMins || 5);
  /* Bug H-2 Fix: Use server time to prevent client clock manipulation */
  var now = (window.serverNow && typeof window.serverNow === 'function')
    ? window.serverNow()
    : Date.now();
  var start = Number(t.matchTime);
  var openAt  = start - openMins  * 60000;
  var closeAt = start - closeMins * 60000;
  return now >= openAt && now < closeAt;
};

/* ── Check if user has checked in ── */
window.hasCheckedIn = function(matchId, callback) {
  if (!window.U) { callback(false); return; }
  /* ✅ Supabase direct query (not Firebase) */
  if (window._supa) {
    window._supa.from('join_requests')
      .select('checked_in')
      .eq('match_id', matchId)
      .eq('user_id', window.U.uid)
      .maybeSingle()
      .then(function(r) { callback(r.data ? !!r.data.checked_in : false); }, function()  { callback(false); });
    return;
  }
  callback(false);
};

/* ── Do Check-in ── */
window.doMatchCheckIn = function(matchId) {
  if (!window.db || !window.U || !window.UD) {
    toast('Login karo pehle', 'err'); return;
  }
  var t = window.MT && window.MT[matchId];
  if (!t) { toast('Match nahi mila', 'err'); return; }
  if (!window.isCheckInOpen(t)) {
    toast('Check-in window abhi open nahi hai', 'inf'); return;
  }
  // Check if joined
  if (!window.hasJ || !window.hasJ(matchId)) {
    toast('Pehle match join karo', 'err'); return;
  }

  /* ✅ Supabase check-in (not Firebase) */
  if (!window._supa || !window._supaReady) { toast('Service unavailable', 'err'); return; }
  window._supa.from('join_requests')
    .update({
      checked_in: true,
      checkin_at: new Date().toISOString()
    })
    .eq('match_id', matchId)
    .eq('user_id', window.U.uid)
    .then(function(r) {
      if (r.error) { toast('Check-in error: ' + (r.error.message || ''), 'err'); return; }
      toast('✅ Check-in ho gaya! Match ke liye tayar raho 🎮', 'ok');
      /* Update JR local cache */
      if (window.JR) {
        for (var k in window.JR) {
          if (window.JR[k].matchId === matchId && window.JR[k].userId === window.U.uid) {
            window.JR[k].checkedIn = true; break;
          }
        }
      }
      var btn = document.getElementById('checkinBtn_' + matchId);
      if (btn) {
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Checked In ✅';
        btn.style.background = 'rgba(0,255,156,.1)';
        btn.style.color = 'var(--green)';
        btn.disabled = true;
      }
    }, function(e) { toast('Check-in failed — retry karo', 'err'); });
};

/* ── Render check-in button for match card ── */
window.renderCheckInBtn = function(matchId, t) {
  if (!window.hasJ || !window.hasJ(matchId)) return '';
  var isOpen = window.isCheckInOpen(t);
  if (!isOpen) {
    // Show countdown to check-in
    var cfg = window.CFG || {};
    var openMins = Number(cfg.checkInOpenMins || 30);
    var openAt = Number(t.matchTime) - openMins * 60000;
    var minsLeft = Math.ceil((openAt - ((window.serverNow && typeof window.serverNow === "function") ? window.serverNow() : Date.now())) / 60000);
    if (minsLeft > 0) {
      return '<div style="margin-top:6px;font-size:11px;color:#888;text-align:center">⏰ Check-in ' + minsLeft + ' min mein khulega</div>';
    }
    return '';
  }

  return '<button id="checkinBtn_' + matchId + '" onclick="doMatchCheckIn(\'' + matchId + '\')" ' +
    'style="width:100%;margin-top:8px;padding:10px;border-radius:12px;background:linear-gradient(135deg,#ff8c00,#ffd700);border:none;color:#000;font-size:13px;font-weight:800;cursor:pointer">' +
    '<i class="fas fa-clipboard-check"></i> Match Check-In Karo!</button>';
};

/* ── Auto-release no-show slots ── */
/* ✅ SECURITY FIX (2026-09-08): "server-authoritative wallet RPC"
   audit found this credited OTHER users' wallets (jr.user_id, not
   the calling browser's own uid) directly from client code that runs
   in ANY regular user's browser whenever a match goes live — a
   textbook arbitrary-credit vector. This part now runs entirely
   server-side via a scheduled job (internal_process_no_show_refunds,
   pg_cron, service_role-only — no client can ever call it) that does
   the exact same status-flip + wallet-credit + notification, safely.
   This client function now only handles filled_slots bookkeeping
   (not money, harmless to leave client-triggered) and reads back the
   already-processed no_show rows for the slot-count update — it no
   longer touches join_requests.status or any wallet column itself. */
window.releaseNoShows = function(matchId) {
  if (!window._supa) return;
  var cfg = window.CFG || {};
  var closeMins = Number(cfg.checkInCloseMins || 5);
  var t = window.MT && window.MT[matchId];
  if (!t) return;

  var closeAt = Number(t.matchTime) - closeMins * 60000;
  var _now = (window.serverNow && typeof window.serverNow === 'function') ? window.serverNow() : Date.now();
  if (_now < closeAt) return; /* Too early */

  /* Count rows the server-side cron job has already flipped to
     'no_show' for this match, to keep filled_slots in sync. This is
     read-only from the client's perspective — no credit, no status
     write happens here anymore. */
  window._supa.from('join_requests')
    .select('id', { count: 'exact', head: true })
    .eq('match_id', matchId)
    .eq('status', 'no_show')
    .then(function(r) {
      var noShowCount = r.count || 0;
      if (!noShowCount) return;
      window._supa.from('matches').select('filled_slots').eq('id', matchId).single()
        .then(function(mr) {
          var current = (mr.data && mr.data.filled_slots) || 0;
          var updated = Math.max(current - noShowCount, 0);
          if (updated !== current) {
            window._supa.from('matches').update({ filled_slots: updated }).eq('id', matchId).then(null, function(){});
          }
        }, function(){});
    }, function(e) { console.error('[releaseNoShows]', e); });
};


})();

/* ── Bug 14 Fix: Auto-trigger releaseNoShows when match goes live ── */
(function() {
  var _releasedMatches = {};

  function _checkAndReleaseNoShows() {
    var MT = window.MT;
    var CFG = window.CFG || {};
    if (!MT || !window.U) return;
    if (!CFG.checkInEnabled) return;

    Object.keys(MT).forEach(function(mid) {
      var t = MT[mid];
      if (!t || _releasedMatches[mid]) return;
      var st = (t.status || '').toLowerCase();
      var matchTime = Number(t.matchTime) || 0;
      var now = window.serverNow ? window.serverNow() : Date.now();
      var isLive = st === 'live' || st === 'ongoing' || st === 'started';
      var isPastStart = matchTime > 0 && now >= matchTime && now <= matchTime + 10 * 60000;

      if (isLive || isPastStart) {
        _releasedMatches[mid] = true;
        console.log('[CheckIn] Auto-releasing no-shows for match:', mid);
        if (window.releaseNoShows) setTimeout(function() { window.releaseNoShows(mid); }, 2000);
      }
    });
  }

  setInterval(_checkAndReleaseNoShows, 60000);
  setTimeout(_checkAndReleaseNoShows, 8000);
  window.triggerNoShowRelease = _checkAndReleaseNoShows;
  console.log('[CheckIn] Auto no-show release watcher active');
})();
