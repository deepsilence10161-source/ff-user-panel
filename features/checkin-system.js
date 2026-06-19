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
      .then(function(r) { callback(r.data ? !!r.data.checked_in : false); })
      .catch(function()  { callback(false); });
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
  if (!window._supa) { toast('Service unavailable', 'err'); return; }
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
    }).catch(function(e) { toast('Check-in failed — retry karo', 'err'); });
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
window.releaseNoShows = function(matchId) {
  if (!window._supa) return;
  var cfg = window.CFG || {};
  var closeMins = Number(cfg.checkInCloseMins || 5);
  var t = window.MT && window.MT[matchId];
  if (!t) return;

  var closeAt = Number(t.matchTime) - closeMins * 60000;
  var _now = (window.serverNow && typeof window.serverNow === 'function') ? window.serverNow() : Date.now();
  if (_now < closeAt) return; /* Too early */

  /* ✅ Supabase: fetch all join_requests for this match */
  window._supa.from('join_requests')
    .select('id, user_id, status, checked_in, entry_fee_paid, entry_type')
    .eq('match_id', matchId)
    .in('status', ['pending', 'approved', 'joined'])
    .then(function(r) {
      var all = r.data || [];
      var noShows = all.filter(function(jr) { return !jr.checked_in; });
      if (!noShows.length) return;

      noShows.forEach(function(jr) {
        window._supa.from('join_requests')
          .update({ status: 'no_show' })
          .eq('id', jr.id)
          .catch(function(){});

        var fee   = Number(jr.entry_fee_paid || 0);
        var etype = jr.entry_type || 'free';
        if (fee > 0 && etype !== 'free' && etype !== 'ad') {
          var col = etype === 'coin' ? 'coins' : 'sky_diamonds';
          window._supa.rpc('increment_balance', { p_uid: jr.user_id, p_col: col, p_amount: fee }).catch(function(){});
          window._supa.from('wallet_transactions').insert({ user_id: jr.user_id, currency: col, txn_type: 'credit', amount: fee, reason: 'no_show_refund', ref_id: matchId }).catch(function(){});
        }

        window._supa.from('notifications').insert({
          user_id: jr.user_id, type: 'no_show_refund',
          title:   '⚠️ Check-In Miss — Refund',
          body:    'Tum match mein check-in nahi kiya — slot release ho gaya' + (fee > 0 ? ' aur entry fee refund ho gayi.' : '.')
        }).catch(function(){});
      });

      window._supa.from('matches').select('filled_slots').eq('id', matchId).single()
        .then(function(mr) {
          var updated = Math.max(((mr.data && mr.data.filled_slots) || 0) - noShows.length, 0);
          window._supa.from('matches').update({ filled_slots: updated }).eq('id', matchId).catch(function(){});
        }).catch(function(){});

      console.log('✅ Released ' + noShows.length + ' no-show slots for match ' + matchId);
    }).catch(function(e) { console.error('[releaseNoShows]', e); });
};

/* ── Check-in reminder notification ── */
window.scheduleCheckInReminder = function(matchId, matchTime) {
  var cfg = window.CFG || {};
  var openMins = Number(cfg.checkInOpenMins || 30);
  var remindAt = Number(matchTime) - openMins * 60000;
  var delay = remindAt - ((window.serverNow && typeof window.serverNow === "function") ? window.serverNow() : Date.now()); /* Bug H-2 Fix: serverNow */
  if (delay < 0 || delay > 4 * 3600000) return; // Skip if too far or past

  if (_checkInTimers[matchId]) clearTimeout(_checkInTimers[matchId]);
  _checkInTimers[matchId] = setTimeout(function() {
    if (!window.hasJ || !window.hasJ(matchId)) return;
    window.hasCheckedIn(matchId, function(checked) {
      if (!checked) {
        toast('⚠️ Match check-in khul gaya! Abhi check-in karo!', 'err');
        // Push local notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Mini eSports ⚠️', {
            body: 'Match check-in open ho gaya! Jaldi check-in karo!',
            icon: '/assets/green-diamond.png'
          });
        }
      }
    });
  }, delay);
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
