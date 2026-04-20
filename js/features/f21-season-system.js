/* =============================================
   FEATURE 21: Season System
   - Monthly seasons with leaderboard reset
   - Season badges on profile
   - Top 3 get special season rewards
   - Firebase: seasons/{seasonId}/leaderboard
   ============================================= */
(function() {
  'use strict';

  // Season = calendar month (Season 1 = Jan, etc.)
  function getCurrentSeason() {
    var d = new Date();
    var y = d.getFullYear();
    var m = d.getMonth() + 1; // 1-12
    return {
      id: y + '_' + String(m).padStart(2, '0'),
      name: 'Season ' + m + ' \'' + String(y).slice(2),
      month: m,
      year: y,
      label: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1] + ' ' + y,
      daysLeft: (function() {
        var last = new Date(y, m, 0).getDate();
        return last - d.getDate();
      })()
    };
  }

  window.getCurrentSeason = getCurrentSeason;

  // Update season stats when match result comes in
  window.updateSeasonStats = function(uid, kills, earnings, isWin) {
    if (!uid) return;
    var season = getCurrentSeason();
    var ref = window.db ? window.db.ref('seasons/' + season.id + '/players/' + uid) : null;
    if (!ref) return;
    ref.transaction(function(cur) {
      cur = cur || { uid: uid, kills: 0, earnings: 0, wins: 0, matches: 0, ign: '' };
      cur.kills = (cur.kills || 0) + (kills || 0);
      cur.earnings = (cur.earnings || 0) + (earnings || 0);
      cur.wins = (cur.wins || 0) + (isWin ? 1 : 0);
      cur.matches = (cur.matches || 0) + 1;
      if (window.UD) cur.ign = window.UD.ign || window.UD.displayName || cur.ign || '';
      cur.updatedAt = Date.now();
      return cur;
    });
  };

  // Get season leaderboard
  window.loadSeasonLeaderboard = function(callback) {
    var season = getCurrentSeason();
    var db = window.db;
    if (!db) return callback([]);
    db.ref('seasons/' + season.id + '/players')
      .orderByChild('earnings')
      .limitToLast(50)
      .once('value', function(s) {
        var list = [];
        if (s.exists()) s.forEach(function(c) { list.push(Object.assign({ _uid: c.key }, c.val())); });
        list.sort(function(a, b) { return (b.earnings || 0) - (a.earnings || 0); });
        callback(list, season);
      });
  };

  // Season badge for profile
  window.getSeasonBadge = function(seasonRank) {
    if (!seasonRank || seasonRank > 100) return null;
    if (seasonRank === 1) return { label: '🥇 Season #1', color: '#ffd700', bg: 'rgba(255,215,0,.15)' };
    if (seasonRank === 2) return { label: '🥈 Season #2', color: '#c0c0c0', bg: 'rgba(192,192,192,.15)' };
    if (seasonRank === 3) return { label: '🥉 Season #3', color: '#cd7f32', bg: 'rgba(205,127,50,.15)' };
    if (seasonRank <= 10) return { label: '⚡ Top 10', color: '#00eeff', bg: 'rgba(0,238,255,.1)' };
    if (seasonRank <= 25) return { label: '🔥 Top 25', color: '#ff6600', bg: 'rgba(255,102,0,.1)' };
    return { label: '#' + seasonRank + ' Season', color: 'var(--txt2)', bg: 'rgba(255,255,255,.05)' };
  };

  // Get current user's season rank
  window.getMySeasonRank = function(callback) {
    if (!window.U) return callback(null);
    window.loadSeasonLeaderboard(function(list) {
      var rank = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i]._uid === window.U.uid) { rank = i + 1; break; }
      }
      callback(rank, list);
    });
  };

  window.f21Season = { getCurrentSeason, loadSeasonLeaderboard, getMySeasonRank };
})();
