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

  /* ✅ R8 (2026-09-26c): check-in ab server-authoritative RPC se —
     check_in_match window ki real open/close server-side validate karta
     hai (client ab checked_in force nahi kar sakta — clamp trigger ne
     direct update freeze kar diya hai). */
  if (!window._supa || !window._supaReady) { toast('Service unavailable', 'err'); return; }
  window._supa.rpc('check_in_match', { p_match_id: matchId })
    .then(function(r) {
      if (r.error) { toast('Check-in error: ' + (r.error.message || ''), 'err'); return; }
      var d = r.data || {};
      if (d.success === false) { toast('Check-in: ' + (d.error || 'not allowed'), 'err'); return; }
      toast('✅ Check-in ho gaya! Match ke liye tayar raho 🎮', 'ok');
      /* Update JR local cache */
      if (window.JR) {
        for (var k in window.JR) {
          if (window.JR[k].matchId === matchId && window.JR[k].userId === window.U.uid) {
            window.JR[k].checkedIn = true; break;
          }
        }
      }
      /* Bug W: button modal (checkinBtn_) aur My Matches card
         (checkinCardBtn_) — dono par render hota hai, dono update karo. */
      ['checkinBtn_', 'checkinCardBtn_'].forEach(function(pfx) {
        var btn = document.getElementById(pfx + matchId);
        if (btn) {
          btn.innerHTML = '<i class="fas fa-check-circle"></i> Checked In ✅';
          btn.style.background = 'rgba(0,255,156,.1)';
          btn.style.color = 'var(--green)';
          btn.disabled = true;
        }
      });
    }, function(e) { toast('Check-in failed — retry karo', 'err'); });
};

/* ── Render check-in button for match card ──
   ⚠️ Bug W (2026-10-01): ismein do live fixes —
   (a) optional idPrefix: My Matches card aur Match Details modal dono par
       button chahiye, aur duplicate DOM id se dono ek dusre ko toot jaate
       (getElementById pehla hi deta hai) — isliye prefix alag.
   (b) window band hone par ab khamoshi nahi: pehle '' return hota tha, to
       user ko 5 min pehle pata hi nahi chalta tha ki uska check-in miss ho
       gaya aur entry refund + slot chala gaya. Ab explicit warning. */
window.renderCheckInBtn = function(matchId, t, idPrefix) {
  if (!window.hasJ || !window.hasJ(matchId)) return '';
  var _id = (idPrefix || 'checkinBtn') + '_' + matchId;
  var isOpen = window.isCheckInOpen(t);
  if (!isOpen) {
    var cfg = window.CFG || {};
    var openMins = Number(cfg.checkInOpenMins || 30);
    var openAt = Number(t.matchTime) - openMins * 60000;
    var nowMs = (window.serverNow && typeof window.serverNow === "function") ? window.serverNow() : Date.now();
    var minsLeft = Math.ceil((openAt - nowMs) / 60000);
    if (minsLeft > 0) {
      return '<div style="margin-top:6px;font-size:11px;color:#888;text-align:center">⏰ Check-in ' + minsLeft + ' min mein khulega</div>';
    }
    /* Window open ho chuka, close ho chuka, match abhi shuru nahi hua →
       user ko saaf batao, warna wo sochta hai check-in ho gaya hai aur uska
       entry refund ho jaata hai. */
    if (Number(t.matchTime) > nowMs) {
      return '<div style="margin-top:6px;font-size:11px;color:#ff9f43;text-align:center;font-weight:700">⚠️ Check-in window band ho chuka hai — entry refund ho sakti hai</div>';
    }
    return '';
  }

  return '<button id="' + _id + '" onclick="doMatchCheckIn(\'' + matchId + '\')" ' +
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
   ROUND-4 (2026-09-23): filled_slots decrement ab SERVER-side hota hai —
   internal_process_no_show_refunds (pg_cron, har minute) no_show flip ke
   saath hi player-slot decrement bhi atomic karta hai (mode-derived:
   solo 1 / duo 2 / squad 4). Client ab filled_slots ko NAHI chhedta —
   warna server + client DONO ghata dete = double-decrement (live-proven
   pattern: pehle server ghataata hi nahi tha, ab ghataata hai). Ye
   function ab pure NO-OP bookkeeping stub hai (callers ke liye API
   stable rakhta hai) — koi wallet column, koi status write, koi slot
   write nahi. */
window.releaseNoShows = function(matchId) {
  /* SERVER-AUTHORITATIVE — internal_process_no_show_refunds already
     decrements filled_slots (player-slots). Client-side decrement
     removed to avoid double-decrement. Stub retained so existing
     callers (auto watcher below) keep working unchanged. */
  if (!window._supa) return;
  if (!window.MT || !window.MT[matchId]) return;
  return;
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
