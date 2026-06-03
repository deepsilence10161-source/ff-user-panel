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
  var now  = Date.now();
  var start = Number(t.matchTime);
  var openAt  = start - openMins  * 60000;
  var closeAt = start - closeMins * 60000;
  return now >= openAt && now < closeAt;
};

/* ── Check if user has checked in ── */
window.hasCheckedIn = function(matchId, callback) {
  if (!window.db || !window.U) { callback(false); return; }
  window.db.ref('matches/' + matchId + '/checkIns/' + window.U.uid).once('value', function(snap) {
    callback(snap.exists());
  });
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

  window.db.ref('matches/' + matchId + '/checkIns/' + window.U.uid).set({
    uid:       window.U.uid,
    ign:       window.UD.ign || window.UD.displayName || 'Player',
    checkedAt: Date.now(),
    rank:      (window.calcRk ? window.calcRk(window.UD.stats||{}).badge : 'Bronze')
  }, function(err) {
    if (err) { toast('Error: ' + err.message, 'err'); return; }
    toast('✅ Check-in ho gaya! Match ke liye tayar raho 🎮', 'ok');
    // Update UI
    var btn = document.getElementById('checkinBtn_' + matchId);
    if (btn) {
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Checked In ✅';
      btn.style.background = 'rgba(0,255,156,.1)';
      btn.style.color = 'var(--green)';
      btn.disabled = true;
    }
  });
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
    var minsLeft = Math.ceil((openAt - Date.now()) / 60000);
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
  if (!window.db) return;
  var cfg = window.CFG || {};
  var closeMins = Number(cfg.checkInCloseMins || 5);
  var t = window.MT && window.MT[matchId];
  if (!t) return;

  var closeAt = Number(t.matchTime) - closeMins * 60000;
  if (Date.now() < closeAt) return; // Too early

  // Get who joined but didn't check in
  window.db.ref('matches/' + matchId + '/joinedPlayers').once('value', function(joinSnap) {
    window.db.ref('matches/' + matchId + '/checkIns').once('value', function(ciSnap) {
      var checkedIn = {};
      ciSnap.forEach(function(c) { checkedIn[c.key] = true; });

      var noShows = [];
      joinSnap.forEach(function(c) {
        if (!checkedIn[c.key]) noShows.push(c.key);
      });

      if (!noShows.length) return;

      // Remove no-shows (refund entry fee, free up slot)
      noShows.forEach(function(uid) {
        // Refund
        var joinData = joinSnap.child(uid).val();
        if (joinData && joinData.fee > 0 && joinData.feeType) {
          var path = joinData.feeType === 'coin' ? '/coins' :
                     joinData.feeType === 'paid' ? '/skyDiamonds' : '/coins';
          window.db.ref('users/' + uid + path).transaction(function(v) {
            return (v||0) + Number(joinData.fee);
          });
          // Notify
          window.db.ref('users/' + uid + '/notifications').push({
            type:      'no_show_refund',
            title:     '⚠️ Check-In Miss — Refund',
            message:   'Tum match mein check-in nahi kiya — slot release ho gaya aur entry fee refund ho gayi.',
            read:      false,
            timestamp: Date.now()
          });
        }
        // Remove from joinedPlayers
        window.db.ref('matches/' + matchId + '/joinedPlayers/' + uid).remove();
        window.db.ref('matches/' + matchId + '/joinedSlots').transaction(function(v) {
          return Math.max((v||0) - 1, 0);
        });
      });
      console.log('✅ Released ' + noShows.length + ' no-show slots for match ' + matchId);
    });
  });
};

/* ── Check-in reminder notification ── */
window.scheduleCheckInReminder = function(matchId, matchTime) {
  var cfg = window.CFG || {};
  var openMins = Number(cfg.checkInOpenMins || 30);
  var remindAt = Number(matchTime) - openMins * 60000;
  var delay = remindAt - Date.now();
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
