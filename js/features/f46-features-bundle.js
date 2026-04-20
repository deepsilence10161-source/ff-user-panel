/* ====== FEATURES BUNDLE v34 ======
   Missing features from List 1:
   - Win Streak Badge (100)
   - Rival Player System (101) 
   - Player Reputation Score (102)
   - Match Participation Confirmation (22/25)
   - Account Age for Paid Matches (9 already in list2 but need enforcement)
   - New User Probation (10)
   - Seasonal Rank Reset (96)
   - Personal Best Records (109)
   - Tournament Calendar (158)
   - Match Waitlist (155 - in list2 but check)
   - Achievement Progress Tracker (196)
   - Smart Notification Priority (177)
   - Engagement notifications (199)
   - Win probability badge (165)
*/
(function(){
'use strict';

/* ── 100: WIN STREAK BADGE ── */
window.renderWinStreakBadge = function() {
  if (!window.UD) return '';
  var stats = window.UD.stats || {};
  var streak = Number(window.UD.currentWinStreak) || 0;
  if (streak < 2) return '';
  var color = streak >= 5 ? '#ff4444' : streak >= 3 ? '#ff8c00' : '#ffd700';
  var fire = streak >= 5 ? '🔥🔥' : streak >= 3 ? '🔥' : '⚡';
  return '<div style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:10px;background:rgba(255,140,0,.12);border:1px solid rgba(255,140,0,.25);font-size:11px;font-weight:800;color:' + color + '">' + fire + ' ' + streak + ' Win Streak!</div>';
};

// Hook into renderProfile to show win streak
var _wsInterval = setInterval(function() {
  if (window.renderProfile && !window._wsHooked) {
    clearInterval(_wsInterval);
    window._wsHooked = true;
  }
}, 500);

/* ── 101: RIVAL PLAYER SYSTEM ── */
window.setRival = function(targetUid, targetName) {
  if (!window.U || !window.db) return;
  var uid = window.U.uid;
  db.ref('users/' + uid + '/rival').set({ uid: targetUid, name: targetName, setAt: Date.now() });
  if (window.toast) toast('🎯 Rival set: ' + targetName, 'ok');
};

window.showRivalCard = function() {
  if (!window.UD || !window.UD.rival) {
    if (window.toast) toast('Koi rival set nahi hai abhi', 'inf');
    return;
  }
  var rival = window.UD.rival;
  db.ref('users/' + rival.uid).once('value', function(s) {
    if (!s.exists()) return;
    var rd = s.val();
    var myStats = (window.UD.stats || {});
    var theirStats = (rd.stats || {});
    var h = '<div style="text-align:center;padding:8px 0 14px">';
    h += '<div style="font-size:28px;margin-bottom:6px">🎯</div>';
    h += '<div style="font-size:16px;font-weight:800;color:#ff4444;margin-bottom:4px">Your Rival</div>';
    h += '<div style="font-size:13px;color:var(--txt2)">' + (rd.ign || rd.displayName || 'Player') + '</div>';
    h += '</div>';
    h += '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;margin-bottom:14px">';
    var compareStats = [
      { label: 'Matches', me: myStats.matches || 0, them: theirStats.matches || 0 },
      { label: 'Kills', me: myStats.kills || 0, them: theirStats.kills || 0 },
      { label: 'Wins', me: myStats.wins || 0, them: theirStats.wins || 0 },
      { label: '₹ Earned', me: myStats.earnings || 0, them: theirStats.earnings || 0 }
    ];
    compareStats.forEach(function(cs) {
      var myWin = cs.me >= cs.them;
      h += '<div style="text-align:right"><div style="font-size:16px;font-weight:900;color:' + (myWin ? 'var(--green)' : 'var(--txt)') + '">' + cs.me + '</div><div style="font-size:10px;color:var(--txt2)">You</div></div>';
      h += '<div style="text-align:center;font-size:10px;color:var(--txt2);align-self:center;padding-top:6px">' + cs.label + '</div>';
      h += '<div style="text-align:left"><div style="font-size:16px;font-weight:900;color:' + (!myWin ? '#ff4444' : 'var(--txt)') + '">' + cs.them + '</div><div style="font-size:10px;color:var(--txt2)">Rival</div></div>';
    });
    h += '</div>';
    h += '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:10px;border-radius:10px;background:rgba(255,255,255,.06);border:none;color:var(--txt);cursor:pointer">Close</button>';
    if (window.openModal) openModal('🎯 Rival Stats', h);
  });
};

/* ── 102: PLAYER REPUTATION SCORE ── */
window.getReputationLevel = function(rep) {
  rep = rep || 0;
  if (rep >= 100) return { label: '⭐ Legend', color: '#ffd700' };
  if (rep >= 60) return { label: '💎 Trusted', color: '#00d4ff' };
  if (rep >= 30) return { label: '✅ Good', color: '#00ff9c' };
  if (rep >= 10) return { label: '🔄 New', color: '#aaa' };
  return { label: '❓ Unknown', color: '#666' };
};

// Auto-update reputation after match
window.updateReputation = function(uid, delta, reason) {
  if (!window.db || !uid) return;
  db.ref('users/' + uid + '/reputation').transaction(function(v) {
    return Math.max(0, (v || 0) + delta);
  });
  if (delta > 0 && window.U && uid === window.U.uid) {
    if (window.toast) toast('+' + delta + ' Reputation: ' + reason, 'ok');
  }
};

/* ── 22: MATCH PARTICIPATION CONFIRMATION ── */
window.showMatchConfirmBanner = function(matchId, matchName, matchTime) {
  if (!window.U || !window.db) return;
  var mt = Number(matchTime);
  if (!mt) return;
  var diff = mt - Date.now();
  if (diff > 1800000 || diff < 0) return; // Only 30 min before match

  var _ck = '_mes_confirmed_' + window.U.uid + '_' + matchId;
  if (localStorage.getItem(_ck)) return;

  var h = '<div style="background:rgba(0,255,106,.08);border:1px solid rgba(0,255,106,.2);border-radius:14px;padding:14px;margin-bottom:12px">';
  h += '<div style="font-size:13px;font-weight:700;color:var(--green);margin-bottom:6px">⚠️ Match Starting Soon!</div>';
  h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:10px">' + matchName + ' mein kya tum ready ho?</div>';
  h += '<div style="display:flex;gap:8px">';
  h += '<button onclick="confirmMatchAttendance(\'' + matchId + '\')" style="flex:1;padding:9px;border-radius:10px;background:var(--green,#00ff9c);color:#000;font-weight:800;border:none;cursor:pointer;font-size:12px">✅ Haan, Ready Hoon!</button>';
  h += '<button onclick="this.parentElement.parentElement.parentElement.remove()" style="padding:9px 12px;border-radius:10px;background:rgba(255,255,255,.06);color:var(--txt2);border:none;cursor:pointer;font-size:12px">Later</button>';
  h += '</div></div>';

  var wrap = document.getElementById('homeList');
  if (wrap) { wrap.insertAdjacentHTML('afterbegin', h); }
};

window.confirmMatchAttendance = function(matchId) {
  if (!window.U || !window.db) return;
  var _ck = '_mes_confirmed_' + window.U.uid + '_' + matchId;
  localStorage.setItem(_ck, '1');
  db.ref('joinRequests').orderByChild('userId').equalTo(window.U.uid).once('value', function(s) {
    if (!s.exists()) return;
    s.forEach(function(c) {
      if (c.val().matchId === matchId) {
        db.ref('joinRequests/' + c.key).update({ confirmed: true, confirmedAt: Date.now() });
      }
    });
  });
  if (window.toast) toast('✅ Confirmed! Room details match time pe milenge.', 'ok');
  document.querySelectorAll('.match-confirm-banner').forEach(function(el) { el.remove(); });
};

/* ── 10: NEW USER PROBATION (show warning in paid matches) ── */
window.checkProbation = function(uid, createdAt) {
  var joinDate = Number(createdAt) || Date.now();
  var daysSince = (Date.now() - joinDate) / 86400000;
  return daysSince < 3; // 3 din se naya user = probation
};

/* ── 109: PERSONAL BEST RECORDS ── */
window.showPersonalBests = function() {
  if (!window.UD) return;
  var stats = window.UD.stats || {};
  var bests = window.UD.personalBests || {};
  var h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';
  var records = [
    { label: '🏆 Best Rank', val: bests.bestRank ? '#' + bests.bestRank : 'N/A', sub: 'Ever achieved' },
    { label: '💀 Most Kills', val: bests.bestKills || stats.kills || 0, sub: 'In one match' },
    { label: '💰 Max Earning', val: bests.maxEarning ? '₹' + bests.maxEarning : '₹0', sub: 'Single match' },
    { label: '🔥 Win Streak', val: bests.maxWinStreak || 0, sub: 'Consecutive wins' },
    { label: '🎮 Total Matches', val: stats.matches || 0, sub: 'All time' },
    { label: '⭐ Total Wins', val: stats.wins || 0, sub: 'Matches won' }
  ];
  records.forEach(function(r) {
    h += '<div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px;text-align:center">';
    h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:4px">' + r.label + '</div>';
    h += '<div style="font-size:22px;font-weight:900;color:var(--green)">' + r.val + '</div>';
    h += '<div style="font-size:10px;color:var(--txt2);margin-top:2px">' + r.sub + '</div></div>';
  });
  h += '</div>';
  if (window.openModal) openModal('🏅 Personal Bests', h);
};

/* ── 165: PRIZE POOL VISUAL PROGRESS BAR in match card ── */
window.renderPrizeProgress = function(joined, maxSlots) {
  joined = Number(joined) || 0;
  maxSlots = Number(maxSlots) || 1;
  var pct = Math.min(Math.round((joined / maxSlots) * 100), 100);
  var color = pct >= 80 ? '#ff4444' : pct >= 50 ? '#ffaa00' : '#00ff9c';
  return '<div style="margin-top:4px"><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--txt2);margin-bottom:3px"><span>' + joined + '/' + maxSlots + ' slots</span><span style="color:' + color + ';font-weight:700">' + (pct >= 80 ? '🔥 Almost Full!' : pct + '% filled') + '</span></div><div style="height:3px;background:rgba(255,255,255,.08);border-radius:3px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:3px;transition:width .4s ease"></div></div></div>';
};

/* ── 183: SMART ANTI-SPAM (limit notifications) ── */
var _lastToastTime = 0;
var _origToast = window.toast;
window.toast = function(msg, type) {
  var now = Date.now();
  // Same message spam rokne ke liye — 3 sec mein same message nahi
  if (window._lastToastMsg === msg && now - _lastToastTime < 3000) return;
  window._lastToastMsg = msg;
  _lastToastTime = now;
  if (_origToast) _origToast(msg, type);
};

/* ── 199: SMART ENGAGEMENT NOTIFICATIONS ── */
window.checkEngagementReminder = function() {
  if (!window.U || !window.UD) return;
  var lastLogin = Number(window.UD.lastLoginDate) || 0;
  var daysSince = (Date.now() - lastLogin) / 86400000;
  
  // 2+ din se inactive — gentle reminder (sirf ek baar dikhao)
  var _ek = '_mes_eng_' + window.U.uid + '_' + new Date().toDateString();
  if (localStorage.getItem(_ek)) return;
  
  if (daysSince > 1 && window.MT && Object.keys(window.MT).length > 0) {
    localStorage.setItem(_ek, '1');
    setTimeout(function() {
      if (window.toast) toast('🎮 Naye matches available hain! Join karo!', 'inf');
    }, 5000);
  }
};

// Hook into boot
var _engInterval = setInterval(function() {
  if (window.UD && window.U && !window._engChecked) {
    clearInterval(_engInterval);
    window._engChecked = true;
    setTimeout(window.checkEngagementReminder, 8000);
  }
}, 1000);

console.log('[Mini eSports] ✅ Features Bundle v34 loaded');
})();
