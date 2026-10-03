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

/* ── Check-In Miss / Auto-Refund System REMOVED per owner policy (2026-10-03) ──
   Players must join the custom room directly on time when Room ID/Password is released.
   No check-in button, no check-in miss auto-refund, and no slot release on check-in miss. */
window.isCheckInOpen = function() { return false; };
window.hasCheckedIn = function(matchId, callback) { if (callback) callback(true); };
window.doMatchCheckIn = function() {};
window.renderCheckInBtn = function() { return ''; };
window.releaseNoShows = function() {};
window.triggerNoShowRelease = function() {};
})();
