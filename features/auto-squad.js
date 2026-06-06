/* ================================================================
   AUTO SQUAD / DUO MATCHING — auto-squad.js
   
   Solo player queue mein jaata hai → jab enough players milein
   → auto team ban jaata hai → sab ko notification
   
   Firebase structure:
   autoMatchQueue/{matchId}/{uid}: { uid, ign, rank, rankPts, joinedAt }
   autoMatchTeams/{matchId}/{teamId}: { members: [uid1,uid2..], captainUid }
   ================================================================ */

(function() {
'use strict';

var db = function() { return window.db; };
var U  = function() { return window.U; };
var UD = function() { return window.UD; };

/* ── Show Auto-Squad Join Option ── */
window.showAutoSquadJoin = function(matchId, mode) {
  // mode: 'duo' (need 2) or 'squad' (need 4)
  var needed = (mode === 'duo') ? 2 : 4;
  var modeLabel = mode === 'duo' ? 'Duo' : 'Squad';

  var h = '<div style="text-align:center;padding:8px 0">';
  h += '<div style="font-size:36px;margin-bottom:10px">👥</div>';
  h += '<div style="font-size:16px;font-weight:900;margin-bottom:6px">Auto ' + modeLabel + ' Matching</div>';
  h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px;line-height:1.7">';
  h += 'Akele ho? Koi baat nahi!<br>';
  h += '<strong style="color:var(--green)">' + (needed-1) + ' aur ' + (mode==='duo'?'player':'players') + '</strong> dhundh ke tumhari team ban jaayegi.';
  h += '</div>';
  
  // Show current queue count
  h += '<div id="autoQueueStatus" style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;padding:12px;margin-bottom:14px">';
  h += '<div style="font-size:11px;color:var(--txt2)">Queue mein abhi</div>';
  h += '<div style="font-size:24px;font-weight:900;color:var(--green)" id="autoQueueCount">...</div>';
  h += '<div style="font-size:11px;color:var(--txt2)">/' + needed + ' players</div>';
  h += '</div>';

  h += '<div style="background:rgba(0,212,255,.05);border:1px solid rgba(0,212,255,.15);border-radius:12px;padding:10px;margin-bottom:14px;font-size:11px;color:var(--txt2);line-height:1.7">';
  h += '📋 Rules:<br>';
  h += '• Rank-based pairing — same rank ke log milenge<br>';
  h += '• Team ban jaane pe notification aayegi<br>';
  h += '• Captain auto-select hoga (highest rank)<br>';
  h += '• ' + (mode==='duo'?'Dono':'Sabhi ' + needed) + ' players ki entry fee lagegi';
  h += '</div>';

  h += '<button onclick="joinAutoQueue(\'' + matchId + '\',\'' + mode + '\',' + needed + ')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00cc7a);border:none;color:#000;font-size:14px;font-weight:800;cursor:pointer"><i class="fas fa-users"></i> Queue Join Karo</button>';
  h += '</div>';

  if (window.openModal) openModal('👥 Auto ' + modeLabel + ' Match', h);

  // Load queue count
  loadAutoQueueCount(matchId, needed);
};

function loadAutoQueueCount(matchId, needed) {
  if (!db()) return;
  db().ref('autoMatchQueue/' + matchId).once('value', function(snap) {
    var count = snap.numChildren();
    var el = document.getElementById('autoQueueCount');
    if (el) {
      el.textContent = count;
      el.style.color = count >= needed ? '#ffd700' : 'var(--green)';
    }
  });
}

/* ── Join Auto Queue ── */
window.joinAutoQueue = function(matchId, mode, needed) {
  if (!U() || !UD()) { toast('Login karo pehle', 'err'); return; }
  var t = window.MT && window.MT[matchId];
  if (!t) { toast('Match nahi mila', 'err'); return; }

  // Check if already in queue or team
  db().ref('autoMatchQueue/' + matchId + '/' + U().uid).once('value', function(snap) {
    if (snap.exists()) {
      toast('Tum pehle se queue mein ho! Wait karo 🕐', 'inf');
      closeModal();
      return;
    }

    // Add to queue
    var myRank = window.calcRk ? window.calcRk(UD().stats || {}) : { badge: 'Bronze', pts: 0 };
    var queueData = {
      uid:      U().uid,
      ign:      UD().ign || UD().displayName || 'Player',
      rank:     myRank.badge,
      rankPts:  myRank.pts || 0,
      mode:     mode,
      joinedAt: Date.now()
    };

    db().ref('autoMatchQueue/' + matchId + '/' + U().uid).set(queueData, function(err) {
      if (err) { toast('Error: ' + err.message, 'err'); return; }
      toast('✅ Queue mein aa gaye! Team banne ka wait karo 🎮', 'ok');
      closeModal();
      
      // Check if we can form a team now
      checkAndFormTeam(matchId, mode, needed, t);
      
      // Show queue status in matches screen
      showQueueWaiting(matchId, mode, needed);
    });
  });
};

/* ── Check & Form Team ── */
function checkAndFormTeam(matchId, mode, needed, matchData) {
  if (!db()) return;

  db().ref('autoMatchQueue/' + matchId).once('value', function(snap) {
    var players = [];
    snap.forEach(function(c) { players.push(c.val()); });

    if (players.length < needed) return; // Not enough yet

    // Sort by rank points (highest first for captain)
    players.sort(function(a,b) { return b.rankPts - a.rankPts; });

    // Take first 'needed' players
    var teamPlayers = players.slice(0, needed);
    var captain = teamPlayers[0];
    var teamId = db().ref('autoMatchTeams/' + matchId).push().key;

    var teamData = {
      teamId:     teamId,
      matchId:    matchId,
      mode:       mode,
      captainUid: captain.uid,
      members:    teamPlayers.map(function(p) { return p.uid; }),
      memberData: teamPlayers,
      formedAt:   Date.now(),
      status:     'formed'
    };

    // Save team
    db().ref('autoMatchTeams/' + matchId + '/' + teamId).set(teamData);

    // Remove from queue
    teamPlayers.forEach(function(p) {
      db().ref('autoMatchQueue/' + matchId + '/' + p.uid).remove();
    });

    // Notify all team members
    var memberNames = teamPlayers.map(function(p) { return p.ign; }).join(', ');
    teamPlayers.forEach(function(p) {
      db().ref('users/' + p.uid + '/notifications').push({
        type:      'team_formed',
        title:     '🎉 Tumhari Team Bani!',
        message:   mode.toUpperCase() + ' match ke liye team ready! Members: ' + memberNames + '. Captain: ' + captain.ign,
        matchId:   matchId,
        teamId:    teamId,
        read:      false,
        timestamp: Date.now()
      });
      // Also set team info in user's join data
      db().ref('users/' + p.uid + '/autoTeams/' + matchId).set({
        teamId:    teamId,
        captainUid: captain.uid,
        isCaptain: p.uid === captain.uid,
        members:   teamPlayers.map(function(m) { return { uid: m.uid, ign: m.ign }; }),
        matchId:   matchId,
        mode:      mode
      });
    });

    toast('🎉 Team ban gayi! Check notifications', 'ok');
  });
}

/* ── Queue Waiting UI ── */
function showQueueWaiting(matchId, mode, needed) {
  var modeLabel = mode === 'duo' ? 'Duo' : 'Squad';

  // Check if a waiting banner already exists
  var existing = document.getElementById('autoQueueBanner_' + matchId);
  if (existing) return;

  // Find the match card and add a banner below it
  var card = document.querySelector('[data-match-id="' + matchId + '"]');
  if (!card) return;

  var banner = document.createElement('div');
  banner.id = 'autoQueueBanner_' + matchId;
  banner.style.cssText = 'background:linear-gradient(135deg,rgba(0,255,156,.08),rgba(0,212,255,.05));border:1px solid rgba(0,255,156,.2);border-radius:12px;padding:10px 14px;margin-top:8px;display:flex;align-items:center;justify-content:space-between';

  function updateBanner() {
    if (!db() || !U()) return;
    db().ref('autoMatchQueue/' + matchId).once('value', function(snap) {
      var count = snap.numChildren();
      var inQueue = snap.child(U().uid).exists();
      if (!inQueue) {
        banner.remove();
        return;
      }
      banner.innerHTML = '<div style="font-size:12px"><span style="color:var(--green);font-weight:700">⏳ Queue: ' + count + '/' + needed + '</span><br><span style="font-size:10px;color:var(--txt2)">Team banne ka wait karo...</span></div>' +
        '<button onclick="leaveAutoQueue(\'' + matchId + '\')" style="padding:5px 10px;border-radius:8px;background:rgba(255,60,60,.1);border:1px solid rgba(255,60,60,.2);color:#ff6b6b;font-size:11px;cursor:pointer">Leave Queue</button>';
    });
  }

  card.parentNode.insertBefore(banner, card.nextSibling);
  updateBanner();
  setInterval(updateBanner, 10000);
}

/* ── Leave Queue ── */
window.leaveAutoQueue = function(matchId) {
  if (!U() || !db()) return;
  db().ref('autoMatchQueue/' + matchId + '/' + U().uid).remove();
  var banner = document.getElementById('autoQueueBanner_' + matchId);
  if (banner) banner.remove();
  toast('Queue se nikal gaye', 'inf');
};

/* ── Check if user is in auto team for a match ── */
window.getAutoTeam = function(matchId, callback) {
  if (!U() || !db()) { callback(null); return; }
  db().ref('users/' + U().uid + '/autoTeams/' + matchId).once('value', function(snap) {
    callback(snap.val());
  });
};

/* ── Admin: View Auto Queue Status ── */
window.loadAutoQueueAdmin = function(matchId, containerId) {
  var cont = document.getElementById(containerId);
  if (!cont || !(window.rtdb || window.db)) return;
  var db_ = window.rtdb || window.db;

  db_.ref('autoMatchQueue/' + matchId).on('value', function(snap) {
    var players = [];
    snap.forEach(function(c) { players.push(c.val()); });

    if (!players.length) {
      cont.innerHTML = '<div style="color:#666;font-size:12px;padding:8px">Queue khali hai</div>';
      return;
    }

    var html = '<div style="font-size:11px;color:#888;margin-bottom:6px">Auto Queue (' + players.length + ' waiting)</div>';
    players.forEach(function(p) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">';
      html += '<span style="font-size:12px;font-weight:700">' + (p.ign||'?') + '</span>';
      html += '<span style="font-size:10px;color:#888">' + (p.rank||'') + '</span>';
      html += '<button onclick="removeFromAutoQueue(\'' + matchId + '\',\'' + p.uid + '\')" style="margin-left:auto;padding:2px 8px;border-radius:6px;background:rgba(255,60,60,.1);border:1px solid rgba(255,60,60,.2);color:#ff6b6b;font-size:10px;cursor:pointer">Remove</button>';
      html += '</div>';
    });
    cont.innerHTML = html;
  });
};

window.removeFromAutoQueue = function(matchId, uid) {
  var db_ = window.rtdb || window.db;
  if (!db_) return;
  db_.ref('autoMatchQueue/' + matchId + '/' + uid).remove();
};

})();
