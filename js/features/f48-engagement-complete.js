/* ====== ENGAGEMENT FEATURES COMPLETE (User Panel) ======
   - Seasonal Rank Reset
   - Clan Ranking Leaderboard  
   - Player Stat Cards (shareable)
   - Tournament History Timeline
   - Personal Best Records (full)
   - Achievement Progress Tracker
   - Win Streak tracking + update
*/
(function(){
'use strict';

/* ══ SEASONAL RANK RESET ══ */
window.checkSeasonReset = function() {
  if (!window.U || !window.db) return;
  db.ref('appSettings/currentSeason').once('value', function(s) {
    var season = s.val() || { id: 1, resetAt: 0 };
    var userSeasonKey = '_mes_season_' + window.U.uid;
    var lastSeason = parseInt(localStorage.getItem(userSeasonKey) || '0', 10);
    if (season.id > lastSeason && season.resetAt && Date.now() > season.resetAt) {
      // New season — save last season stats as history
      var uid = window.U.uid;
      var stats = (window.UD && window.UD.stats) || {};
      db.ref('users/' + uid + '/seasonHistory/season' + lastSeason).set({
        matches: stats.matches || 0,
        wins: stats.wins || 0,
        kills: stats.kills || 0,
        earnings: stats.earnings || 0,
        finalRank: window.UD && window.UD.seasonRank || 0,
        endedAt: Date.now()
      });
      localStorage.setItem(userSeasonKey, season.id);
      // Show season reset announcement
      setTimeout(function() {
        if (window.openModal) {
          var h = '<div style="text-align:center;padding:10px 0">';
          h += '<div style="font-size:48px;margin-bottom:10px">🏆</div>';
          h += '<div style="font-size:20px;font-weight:900;color:#ffd700;margin-bottom:6px">Season ' + lastSeason + ' Ended!</div>';
          h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:14px">Tera Season ' + lastSeason + ' performance save ho gaya. Naya Season ' + season.id + ' shuru!</div>';
          h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">';
          h += '<div style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.15);border-radius:10px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:900;color:#ffd700">' + (stats.wins||0) + '</div><div style="font-size:10px;color:var(--txt2)">Wins</div></div>';
          h += '<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.12);border-radius:10px;padding:10px;text-align:center"><div style="font-size:22px;font-weight:900;color:#00ff9c">₹' + (stats.earnings||0) + '</div><div style="font-size:10px;color:var(--txt2)">Earned</div></div>';
          h += '</div>';
          h += '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:11px;border-radius:10px;background:linear-gradient(135deg,#ffd700,#ffaa00);color:#000;font-weight:800;border:none;cursor:pointer">Let\'s Go Season ' + season.id + '! 🔥</button>';
          h += '</div>';
          window.openModal('🔄 New Season!', h);
        }
      }, 3000);
    }
  });
};

/* ══ CLAN RANKING LEADERBOARD ══ */
window.showClanLeaderboard = function() {
  if (!window.db) return;
  db.ref('clans').orderByChild('totalEarnings').limitToLast(20).once('value', function(s) {
    if (!s.exists()) {
      if (window.openModal) window.openModal('🏰 Clan Rankings', '<div style="text-align:center;padding:20px;color:var(--txt2)">Abhi koi clans nahi hain.<br>Coming soon!</div>');
      return;
    }
    var clans = [];
    s.forEach(function(c) { var d = c.val(); d._key = c.key; clans.push(d); });
    clans.sort(function(a,b) { return (b.totalEarnings||0) - (a.totalEarnings||0); });

    var h = '<div>';
    clans.forEach(function(clan, idx) {
      var rank = idx + 1;
      var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
      var memberCount = clan.members ? Object.keys(clan.members).length : 0;
      h += '<div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:10px;background:rgba(255,255,255,' + (rank<=3?'.06':'.03') + ');border:1px solid rgba(255,255,255,' + (rank<=3?'.1':'.06') + ');margin-bottom:6px">';
      h += '<div style="font-size:20px;width:32px;text-align:center;font-weight:900">' + medal + '</div>';
      h += '<div style="flex:1"><div style="font-size:13px;font-weight:700">' + (clan.name||'Clan') + '</div>';
      h += '<div style="font-size:10px;color:var(--txt2)">' + memberCount + ' members • ' + (clan.totalWins||0) + ' wins</div></div>';
      h += '<div style="text-align:right"><div style="font-size:13px;font-weight:800;color:#ffd700">₹' + (clan.totalEarnings||0) + '</div><div style="font-size:10px;color:var(--txt2)">earned</div></div>';
      h += '</div>';
    });
    h += '</div>';
    if (window.openModal) window.openModal('🏰 Clan Rankings', h);
  });
};

/* ══ PLAYER STAT CARDS (Shareable) ══ */
window.generateStatCard = function() {
  if (!window.UD || !window.U) return;
  var ud = window.UD;
  var stats = ud.stats || {};
  var winRate = stats.matches > 0 ? Math.round((stats.wins / stats.matches) * 100) : 0;
  var level = ud.level || 1;
  var rep = window.getUserRiskLevel ? window.getUserRiskLevel(ud) : { icon: '✅', level: 'LOW' };

  // Create canvas-based stat card
  var canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 220;
  var ctx = canvas.getContext('2d');

  // Background gradient
  var grad = ctx.createLinearGradient(0, 0, 400, 220);
  grad.addColorStop(0, '#0a0a0a');
  grad.addColorStop(1, '#111');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 400, 220);

  // Border glow
  ctx.strokeStyle = '#00ff9c';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 398, 218);

  // Title
  ctx.fillStyle = '#00ff9c';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('🎮 Mini eSports', 16, 22);
  ctx.fillStyle = '#666';
  ctx.font = '9px Arial';
  ctx.fillText('student-4356.github.io', 300, 22);

  // Player name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px Arial';
  ctx.fillText(ud.ign || ud.displayName || 'Player', 16, 55);

  // UID
  ctx.fillStyle = '#aaa';
  ctx.font = '11px Arial';
  ctx.fillText('UID: ' + (ud.ffUid || '---'), 16, 72);

  // Level badge
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('Level ' + level, 16, 95);

  // Stats grid
  var statItems = [
    { label: 'Matches', value: stats.matches || 0 },
    { label: 'Wins', value: stats.wins || 0 },
    { label: 'Win Rate', value: winRate + '%' },
    { label: 'Kills', value: stats.kills || 0 },
    { label: 'Earnings', value: '₹' + (stats.earnings || 0) },
    { label: 'Kill/Match', value: stats.matches > 0 ? ((stats.kills||0)/stats.matches).toFixed(1) : '0' }
  ];

  var cols = 3, colW = 400 / cols;
  statItems.forEach(function(si, i) {
    var col = i % cols, row = Math.floor(i / cols);
    var x = col * colW + 16, y = 120 + row * 45;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(col * colW + 8, y - 18, colW - 16, 38, 6) : ctx.rect(col * colW + 8, y - 18, colW - 16, 38);
    ctx.fill();
    ctx.fillStyle = '#00ff9c';
    ctx.font = 'bold 16px Arial';
    ctx.fillText(si.value, x, y);
    ctx.fillStyle = '#666';
    ctx.font = '9px Arial';
    ctx.fillText(si.label, x, y + 14);
  });

  // Watermark
  ctx.fillStyle = 'rgba(0,255,156,0.15)';
  ctx.font = 'bold 40px Arial';
  ctx.save();
  ctx.rotate(-0.3);
  ctx.fillText('Mini eSports', -30, 200);
  ctx.restore();

  // Show preview + share
  var dataUrl = canvas.toDataURL('image/png');
  var h = '<div style="text-align:center">';
  h += '<img src="' + dataUrl + '" style="width:100%;border-radius:10px;margin-bottom:12px">';
  h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:12px">Long press karo image save karne ke liye</div>';
  h += '<button onclick="shareStatCard(\'' + dataUrl + '\')" style="width:100%;padding:11px;border-radius:10px;background:linear-gradient(135deg,#00ff9c,#00d4aa);color:#000;font-weight:800;border:none;cursor:pointer"><i class="fas fa-share-alt"></i> Share Card</button>';
  h += '</div>';
  if (window.openModal) window.openModal('📊 Your Stat Card', h);
};

window.shareStatCard = function(dataUrl) {
  if (navigator.share) {
    fetch(dataUrl).then(function(r) { return r.blob(); }).then(function(blob) {
      var file = new File([blob], 'mini-esports-stats.png', { type: 'image/png' });
      navigator.share({ title: 'My Mini eSports Stats', files: [file] }).catch(function(){});
    });
  } else {
    // Fallback: open in new tab
    var win = window.open(); win.document.write('<img src="' + dataUrl + '" style="max-width:100%">');
    if (window.toast) toast('Image ko long-press karke save karo', 'inf');
  }
};

/* ══ TOURNAMENT HISTORY TIMELINE ══ */
window.showTournamentTimeline = function() {
  if (!window.JR || !window.MT) {
    if (window.toast) toast('Data load ho raha hai...', 'inf');
    return;
  }
  var myMatches = [];
  Object.keys(window.JR).forEach(function(k) {
    var jr = window.JR[k];
    if (!jr || !window.U || jr.userId !== window.U.uid) return;
    var match = window.MT[jr.matchId] || {};
    myMatches.push({
      name: match.name || 'Match',
      time: Number(jr.joinedAt || match.matchTime) || 0,
      rank: (jr.result && jr.result.rank) || null,
      kills: (jr.result && jr.result.kills) || 0,
      prize: (jr.result && jr.result.prize) || 0,
      status: match.status || 'unknown',
      matchId: jr.matchId
    });
  });
  myMatches.sort(function(a,b) { return b.time - a.time; });

  if (!myMatches.length) {
    if (window.openModal) window.openModal('📅 Tournament Timeline', '<div style="text-align:center;padding:20px;color:var(--txt2)">Abhi tak koi tournament nahi khela. Join karo!</div>');
    return;
  }

  var h = '<div style="position:relative">';
  // Vertical timeline line
  h += '<div style="position:absolute;left:20px;top:0;bottom:0;width:2px;background:linear-gradient(to bottom,var(--primary,#00ff9c),transparent)"></div>';

  myMatches.slice(0, 20).forEach(function(m) {
    var won = m.rank === 1 || m.rank === '1';
    var dotColor = won ? '#ffd700' : m.prize > 0 ? '#00ff9c' : '#555';
    var dateStr = m.time ? new Date(m.time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—';

    h += '<div style="display:flex;gap:14px;margin-bottom:16px;position:relative">';
    h += '<div style="width:40px;flex-shrink:0;display:flex;flex-direction:column;align-items:center">';
    h += '<div style="width:16px;height:16px;border-radius:50%;background:' + dotColor + ';border:2px solid rgba(0,0,0,.5);z-index:1;margin-top:2px;' + (won ? 'box-shadow:0 0 8px ' + dotColor : '') + '"></div>';
    h += '<div style="font-size:9px;color:var(--txt2);margin-top:3px;text-align:center">' + dateStr + '</div></div>';
    h += '<div style="flex:1;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;padding:9px">';
    h += '<div style="font-size:12px;font-weight:700;margin-bottom:3px">' + (won ? '🏆 ' : '') + m.name + '</div>';
    h += '<div style="display:flex;gap:10px;font-size:11px;color:var(--txt2)">';
    if (m.rank) h += '<span>Rank: <strong style="color:' + dotColor + '">#' + m.rank + '</strong></span>';
    if (m.kills) h += '<span>Kills: <strong style="color:#ff6b6b">' + m.kills + '</strong></span>';
    if (m.prize) h += '<span>Won: <strong style="color:#ffd700">₹' + m.prize + '</strong></span>';
    h += '</div></div></div>';
  });
  h += '</div>';
  if (window.openModal) window.openModal('📅 Tournament Timeline', h);
};

/* ══ ACHIEVEMENT PROGRESS TRACKER ══ */
window.showAchievementProgress = function() {
  if (!window.UD) return;
  var stats = window.UD.stats || {};
  var badges = window.UD.badges || {};
  var matches = stats.matches || 0;
  var wins = stats.wins || 0;
  var kills = stats.kills || 0;
  var earnings = stats.earnings || 0;
  var streak = window.UD.loginStreak || 0;

  var achievements = [
    { id: 'firstBlood', icon: '🎮', title: 'First Blood', desc: 'Pehla match khelo', req: 1, current: matches, unit: 'matches', done: matches >= 1 },
    { id: 'tenMatches', icon: '🔟', title: 'Veteran', desc: '10 matches khelo', req: 10, current: matches, unit: 'matches', done: matches >= 10 },
    { id: 'firstWin', icon: '🏆', title: 'Winner!', desc: 'Pehla match jito', req: 1, current: wins, unit: 'wins', done: wins >= 1 },
    { id: 'fiveWins', icon: '👑', title: 'Champ', desc: '5 matches jito', req: 5, current: wins, unit: 'wins', done: wins >= 5 },
    { id: 'killMachine', icon: '💀', title: 'Kill Machine', desc: '50 total kills', req: 50, current: kills, unit: 'kills', done: kills >= 50 },
    { id: 'earner', icon: '💰', title: 'Earner', desc: '₹100 kamao', req: 100, current: earnings, unit: '₹', done: earnings >= 100 },
    { id: 'bigEarner', icon: '💎', title: 'Big Earner', desc: '₹500 kamao', req: 500, current: earnings, unit: '₹', done: earnings >= 500 },
    { id: 'weekWarrior', icon: '🔥', title: 'Week Warrior', desc: '7 din streak', req: 7, current: streak, unit: 'days', done: streak >= 7 },
    { id: 'streakKing', icon: '⚡', title: 'Streak King', desc: '30 din streak', req: 30, current: streak, unit: 'days', done: streak >= 30 }
  ];

  var h = '<div style="display:flex;flex-direction:column;gap:8px">';
  achievements.forEach(function(a) {
    var pct = a.done ? 100 : Math.min(Math.round((a.current / a.req) * 100), 99);
    var barColor = a.done ? '#ffd700' : '#00ff9c';
    h += '<div style="background:rgba(255,255,255,' + (a.done ? '.06' : '.03') + ');border:1px solid rgba(255,255,255,' + (a.done ? '.12' : '.06') + ');border-radius:12px;padding:10px;' + (a.done ? 'opacity:1' : 'opacity:.85') + '">';
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">';
    h += '<div style="font-size:24px">' + a.icon + '</div>';
    h += '<div style="flex:1"><div style="font-size:12px;font-weight:700;color:' + (a.done ? '#ffd700' : 'var(--txt)') + '">' + a.title + (a.done ? ' ✅' : '') + '</div>';
    h += '<div style="font-size:10px;color:var(--txt2)">' + a.desc + '</div></div>';
    h += '<div style="font-size:11px;color:var(--txt2);text-align:right">' + Math.min(a.current, a.req) + '/' + a.req + '</div>';
    h += '</div>';
    h += '<div style="height:4px;background:rgba(255,255,255,.08);border-radius:4px;overflow:hidden">';
    h += '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:4px;transition:width .5s ease"></div></div>';
    h += '</div>';
  });
  h += '</div>';
  if (window.openModal) window.openModal('🏅 Achievement Progress', h);
};

/* ══ WIN STREAK AUTO-UPDATE ══ */
// Called after match result comes in
window.updateWinStreak = function(uid, won) {
  if (!window.db || !uid) return;
  db.ref('users/' + uid).once('value', function(s) {
    if (!s.exists()) return;
    var ud = s.val();
    var currentStreak = Number(ud.currentWinStreak) || 0;
    var maxStreak = Number(ud.personalBests && ud.personalBests.maxWinStreak) || 0;
    var newStreak = won ? currentStreak + 1 : 0;
    var updates = { currentWinStreak: newStreak };
    if (newStreak > maxStreak) updates['personalBests/maxWinStreak'] = newStreak;
    db.ref('users/' + uid).update(updates);
    if (won && newStreak >= 3 && window.toast) {
      toast('🔥 ' + newStreak + ' Win Streak!', 'ok');
    }
  });
};

/* ══ AUTO-INIT ══ */
var _initT = 0, _initI = setInterval(function() {
  _initT++;
  if (window.U && window.UD && window.db) {
    clearInterval(_initI);
    // Check seasonal reset
    setTimeout(window.checkSeasonReset, 5000);
  }
  if (_initT > 60) clearInterval(_initI);
}, 500);

console.log('[Mini eSports] ✅ Engagement Features Complete loaded');
})();
