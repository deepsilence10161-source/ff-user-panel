/* ================================================================
   MINI eSPORTS — RANK SYSTEM v2.0
   - Kills / Wins / Rank Points leaderboards
   - Weekly reset (Monday)
   - Season reset (monthly)
   - Top 3 special badge
   - Top 10 special title
   ================================================================ */
(function() {
'use strict';

/* ── Season: monthly, resets on 1st ── */
window.getCurrentSeason = function() {
  var now = new Date();
  var monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var yr = now.getFullYear().toString().slice(-2);
  var mo = now.getMonth();
  var seasonNum = mo + 1 + (now.getFullYear() - 2026) * 12 + 4; // Season 1 = April 2026
  if (seasonNum < 1) seasonNum = 1;
  /* Days left in month */
  var lastDay = new Date(now.getFullYear(), mo + 1, 0).getDate();
  var daysLeft = lastDay - now.getDate();
  return {
    name: 'Season ' + seasonNum + " '" + yr,
    label: monthNames[mo] + ' ' + now.getFullYear(),
    daysLeft: daysLeft,
    monthKey: now.getFullYear() + '_' + String(mo + 1).padStart(2, '0')
  };
};

/* ── Weekly leaderboard (Monday reset) ── */
function getWeekKey() {
  var now = new Date();
  var day = now.getDay(); // 0=Sun, 1=Mon
  var monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return monday.getFullYear() + '_W' + String(monday.getMonth()+1).padStart(2,'0') + String(monday.getDate()).padStart(2,'0');
}
window.getWeekKey = getWeekKey;

/* Bug #9 Fix: loadSeasonLeaderboard — 100% Supabase (Firebase seasonStats empty post-migration) */
window.loadSeasonLeaderboard = function(cb) {
  var s = window.getCurrentSeason ? window.getCurrentSeason() : { name:'Season', label:'', daysLeft:0, monthKey:'' };
  if (!window._supa) { if (cb) cb([], s); return; }
  /* Try leaderboard view first, fallback to users table */
  window._supa.from('leaderboard').select('*').limit(200)
    .then(function(r) {
      var users = (r.data || []).filter(function(u){ return u.ign; }).map(function(u) {
        return {
          _uid: u.id, ign: u.ign||'Player', displayName: u.ign||'Player',
          profileImage: u.avatar_url||'', city: u.city||'',
          rankPoints: Number(u.rank_points)||0, winStreak: Number(u.win_streak)||0,
          stats: { matches: u.total_matches||0, wins: u.total_wins||0, kills: u.total_kills||0 }
        };
      });
      if (cb) cb(users, s);
    })
    .catch(function() {
      /* Fallback: query users table directly */
      window._supa.from('users').select('id,ign,avatar_url,rank_points,total_wins,total_kills,total_matches,win_streak,city')
        .order('rank_points', { ascending: false }).limit(200)
        .then(function(r2) {
          var users = (r2.data||[]).filter(function(u){ return u.ign; }).map(function(u) {
            return {
              _uid: u.id, ign: u.ign||'Player', displayName: u.ign||'Player',
              profileImage: u.avatar_url||'', city: u.city||'',
              rankPoints: Number(u.rank_points)||0, winStreak: Number(u.win_streak)||0,
              stats: { matches: u.total_matches||0, wins: u.total_wins||0, kills: u.total_kills||0 }
            };
          });
          if (cb) cb(users, s);
        }).catch(function(e){ console.warn('[Rank] LB load failed:', e.message); if (cb) cb([], s); });
    });
};

/* ── After match result: update season & weekly stats ── */
window.updateSeasonStats = function(uid, statsUpdate) {
  if (!window.db || !uid) return;
  var s = window.getCurrentSeason();
  var wk = getWeekKey();
  /* Season stats */
  var sRef = window.db.ref('seasonStats/' + s.monthKey + '/' + uid);
  sRef.once('value', function(snap) {
    var existing = snap.val() || {};
    var merged = {
      ign: statsUpdate.ign || existing.ign || '',
      displayName: statsUpdate.displayName || existing.displayName || '',
      profileImage: statsUpdate.profileImage || existing.profileImage || '',
      stats: {
        wins:    (existing.stats && existing.stats.wins    || 0) + (statsUpdate.wins    || 0),
        kills:   (existing.stats && existing.stats.kills   || 0) + (statsUpdate.kills   || 0),
        matches: (existing.stats && existing.stats.matches || 0) + (statsUpdate.matches || 0)
      }
    };
    var pts = window.calcRkScore ? window.calcRkScore(merged.stats) : 0;
    merged.rankPoints = pts;
    sRef.set(merged);
  });
  /* Weekly stats */
  var wRef = window.db.ref('weeklyStats/' + wk + '/' + uid);
  wRef.once('value', function(snap) {
    var ew = snap.val() || {};
    wRef.set({
      ign: statsUpdate.ign || ew.ign || '',
      kills:   (ew.kills   || 0) + (statsUpdate.kills   || 0),
      wins:    (ew.wins    || 0) + (statsUpdate.wins    || 0),
      matches: (ew.matches || 0) + (statsUpdate.matches || 0)
    });
  });
};

/* ── Auto-assign top3 badge on season end / leaderboard view ── */
window.assignTop3Badges = function(users) {
  if (!window.db || !users || users.length < 1) return;
  users.slice(0, 3).forEach(function(u, i) {
    if (!u._uid) return;
    var key = i === 0 ? '_top1' : i === 1 ? '_top2' : '_top3';
    window.db.ref('users/' + u._uid + '/stats/' + key).set(true);
  });
};

/* ── Expose rank point formula for display ── */
window.RANK_FORMULA = 'Wins×40 + Kills×2 + Matches×1 + WinStreak×10';

/* ── Rank tier definitions ── */
window.RANK_TIERS = [
  { name: 'Bronze',   min: 0,    max: 300,  emoji: '🏅', color: '#cd7f32', bg: 'rgba(205,127,50,.13)'  },
  { name: 'Silver',   min: 301,  max: 600,  emoji: '🥈', color: '#c0c0c0', bg: 'rgba(192,192,192,.13)' },
  { name: 'Gold',     min: 601,  max: 1000, emoji: '🥇', color: '#ffd700', bg: 'rgba(255,215,0,.14)'   },
  { name: 'Platinum', min: 1001, max: 1500, emoji: '🔷', color: '#e0e0ff', bg: 'rgba(180,180,255,.13)' },
  { name: 'Diamond',  min: 1501, max: 2000, emoji: '💎', color: '#00d4ff', bg: 'rgba(0,212,255,.15)'   },
  { name: 'Legend',   min: 2001, max: 9999, emoji: '👑', color: '#b964ff', bg: 'rgba(185,100,255,.15)' }
];

/* BUG #27 FIX (2026-07): mentor.js, squad-finder.js, friends.js, skill-matchmaking.js,
   and player-card.js each had their OWN separate, simplified 4-tier rank calculation
   (Bronze/Silver/Gold/Diamond only, wrong thresholds) — a player could show as a
   different rank on different screens simultaneously. This is now the single shared
   source of truth; all 5 files below have been updated to call this instead of their
   own inline duplicate logic. */
window.getRankTier = function(points) {
  points = Number(points) || 0;
  for (var i = window.RANK_TIERS.length - 1; i >= 0; i--) {
    if (points >= window.RANK_TIERS[i].min) return window.RANK_TIERS[i];
  }
  return window.RANK_TIERS[0];
};

/* ── How Rank Works modal ── */
window.showHowRankWorks = function() {
  var h = '';
  h += '<div style="text-align:center;padding:6px 0 14px">';
  h += '<div style="font-size:13px;font-weight:700;color:#ffd700;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:10px;padding:8px 12px;margin-bottom:14px">';
  h += '📊 ' + window.RANK_FORMULA;
  h += '</div>';
  h += '</div>';
  /* Tier ladder */
  h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">';
  window.RANK_TIERS.forEach(function(t) {
    h += '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;background:' + t.bg + ';border:1px solid ' + t.color + '44">';
    h += '<div style="font-size:22px">' + t.emoji + '</div>';
    h += '<div style="flex:1"><div style="font-size:13px;font-weight:800;color:' + t.color + '">' + t.name + '</div>';
    h += '<div style="font-size:11px;color:#666">' + (t.min === 0 ? '0' : t.min) + ' – ' + (t.max >= 9999 ? '∞' : t.max) + ' points</div></div>';
    h += '</div>';
  });
  h += '</div>';
  h += '<div style="font-size:11px;color:#555;text-align:center;line-height:1.6">🗓 Weekly reset every Monday<br>📅 Season reset every 1st of month<br>🏆 Top 3 get special badges · Top 10 get titles</div>';
  if (window.openModal) openModal('🏆 How Rank Works', h);
};

console.log('[Mini eSports] ✅ Rank System v2.0 loaded');
})();
