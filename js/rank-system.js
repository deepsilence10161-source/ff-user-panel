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

/* ── Monthly bucket (leaderboard/stat keys ke liye) ──
   ⚠️ LIVE-TESTING SABAK (2026-10-07, B18): pehle yahi function
   `window.getCurrentSeason` ke naam se define hota tha — aur kyunki ye file
   seasonal-league.js ke BAAD load hoti hai, ye usko CHUP-CHAAP override kar
   deti thi. Nateeja: admin ki Seasonal League settings (naam/tareekh/ON-OFF)
   user ko kabhi dikhti hi nahi thin; user ko yahan ka hardcoded monthly
   "Season 14 '26" dikhta tha. Ab:
     • display ka EK hi source = getCurrentSeason() (seasonal-league.js,
       admin ki settings se),
     • ye function sirf WAHI kaam karta hai jo iska asli kaam hai — monthly
       storage key (seasonStats/<monthKey>) — naam alag se, override ke bina. */
window.getMonthlySeasonMeta = function() {
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

/* Display + storage key ek saath (jo code dono chahta hai) */
function _seasonMerged() {
  var disp = (window.getCurrentSeason ? window.getCurrentSeason() : {}) || {};
  var meta = (window.getMonthlySeasonMeta ? window.getMonthlySeasonMeta() : {}) || {};
  return Object.assign({}, meta, disp, { monthKey: meta.monthKey || disp.monthKey || '' });
}

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
  var s = _seasonMerged();
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
      window._supa.from('user_public_profiles').select('id,ign,avatar_url,rank_points,total_wins,total_kills,total_matches,win_streak,city') /* BUG #38 FIX */
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
  var s = _seasonMerged();
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
  { name: 'Bronze',   min: 0,    max: 300,  emoji: '🏅', color: '#cd7f32', bg: 'rgba(205,127,50,.13)',  img: 'assets/img/ranks/bronze.png'   },
  { name: 'Silver',   min: 301,  max: 600,  emoji: '🥈', color: '#c0c0c0', bg: 'rgba(192,192,192,.13)', img: 'assets/img/ranks/silver.png'   },
  { name: 'Gold',     min: 601,  max: 1000, emoji: '🥇', color: '#ffd700', bg: 'rgba(255,215,0,.14)',   img: 'assets/img/ranks/gold.png'     },
  { name: 'Platinum', min: 1001, max: 1500, emoji: '🔷', color: '#e0e0ff', bg: 'rgba(180,180,255,.13)', img: 'assets/img/ranks/platinum.png' },
  { name: 'Diamond',  min: 1501, max: 2000, emoji: '💎', color: '#00d4ff', bg: 'rgba(0,212,255,.15)',   img: 'assets/img/ranks/diamond.png'  },
  { name: 'Legend',   min: 2001, max: 9999, emoji: '👑', color: '#b964ff', bg: 'rgba(185,100,255,.15)', img: 'assets/img/ranks/legend.png'   }
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
/* ── How Rank Works modal — ✅ D83: owner ki bheji neon screenshot ka EXACT
   replica (purple/magenta panel, crown title plate, formula strip, 6 neon
   tier rows, info cells, gold collection button). Sab DATA dynamic:
   tiers/points window.RANK_TIERS se, formula window.RANK_FORMULA se —
   kuch bhi art me baked nahi (D36/D73 niyam). ── */
window.showHowRankWorks = function() {
  var TAG = {
    Bronze: 'Starting Rank • Build Your Skills',
    Silver: 'Show Your Improvement',
    Gold: 'Play Better • Climb Higher',
    Platinum: 'Prove Your Consistency',
    Diamond: 'Elite Players • Top Performers',
    Legend: 'The Ultimate Rank • Be a Legend'
  };
  var P = 'border-radius:16px;';
  var h = '<div style="background:linear-gradient(165deg,#1c0b33 0%,#2b1055 45%,#180a2c 100%);border:2px solid #d24dff;border-radius:22px;padding:14px 12px 12px;box-shadow:0 0 26px rgba(210,77,255,.35),inset 0 0 46px rgba(210,77,255,.10)">';
  /* header logo */
  h += '<div style="text-align:center;font-size:15px;font-weight:900;color:#fff;margin-bottom:6px"><span style="color:#ff4d4d">🔥</span> <span style="color:#00ff9c">Mini</span> eSports</div>';
  /* crown + title plate with laurels */
  h += '<div style="text-align:center;margin-bottom:10px">';
  h += '<div style="font-size:24px;line-height:1;filter:drop-shadow(0 0 8px rgba(255,180,0,.8))">👑</div>';
  h += '<div style="display:inline-block;padding:7px 20px;border-radius:14px;background:linear-gradient(90deg,rgba(255,120,0,.30),rgba(255,215,0,.16),rgba(255,120,0,.30));border:2px solid #ffb400;box-shadow:0 0 18px rgba(255,180,0,.45),inset 0 0 12px rgba(255,180,0,.15);font-size:17px;font-weight:900;color:#ffd75e;text-shadow:0 1px 3px rgba(60,30,0,.8)">🏆 How Rank Works 🏆</div>';
  h += '<div style="font-size:11px;color:#e0b0ff;margin-top:2px">🌿&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;🌿</div>';
  h += '</div>';
  /* formula strip */
  h += '<div style="' + P + 'background:rgba(255,150,0,.10);border:2px solid rgba(255,180,0,.65);box-shadow:0 0 14px rgba(255,180,0,.25);padding:9px 10px;text-align:center;font-size:12px;font-weight:900;color:#fff;margin-bottom:10px">📊 ' + window.RANK_FORMULA + '</div>';
  /* tier ladder — neon rows */
  h += '<div style="display:flex;flex-direction:column;gap:7px;margin-bottom:10px">';
  window.RANK_TIERS.forEach(function(t) {
    var range = (t.min === 0 ? '0' : String(t.min)) + ' – ' + (t.max >= 9999 ? '∞' : t.max);
    h += '<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:14px;background:linear-gradient(90deg,' + t.bg + ',rgba(0,0,0,.25));border:2px solid ' + t.color + ';box-shadow:0 0 12px ' + t.color + '55,inset 0 0 10px ' + t.color + '22">';
    h += '<div style="width:44px;height:44px;flex-shrink:0;border-radius:10px;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center"><img src="' + t.img + '?v=20261107c" alt="' + t.name + '" style="width:38px;height:38px;object-fit:contain" onerror="this.style.display=\'none\';this.parentNode.textContent=\'' + t.emoji + '\'"></div>';
    h += '<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:900;color:' + t.color + ';text-shadow:0 1px 3px rgba(0,0,0,.7)">' + t.name + '</div>';
    h += '<div style="font-size:10px;color:#cfcfe8;margin-top:1px">' + (TAG[t.name] || '') + '</div></div>';
    h += '<div style="text-align:right;flex-shrink:0"><div style="font-size:13px;font-weight:900;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.7)">' + range + '</div><div style="font-size:9px;color:#cfcfe8">Points</div></div>';
    h += '</div>';
  });
  h += '</div>';
  /* info cells */
  h += '<div style="' + P + 'border:2px solid rgba(185,100,255,.65);box-shadow:0 0 14px rgba(185,100,255,.25);background:rgba(120,40,200,.10);display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:9px 6px;text-align:center;margin-bottom:10px">';
  h += '<div><div style="font-size:15px">📅</div><div style="font-size:10px;font-weight:900;color:#ffd75e">Weekly reset</div><div style="font-size:9px;color:#cfcfe8">every Monday</div></div>';
  h += '<div style="border-left:1px solid rgba(185,100,255,.35);border-right:1px solid rgba(185,100,255,.35)"><div style="font-size:15px">📆</div><div style="font-size:10px;font-weight:900;color:#ffd75e">Season reset</div><div style="font-size:9px;color:#cfcfe8">every 1st of month</div></div>';
  h += '<div><div style="font-size:15px">🏆</div><div style="font-size:10px;font-weight:900;color:#ffd75e">Top 3 badges</div><div style="font-size:9px;color:#cfcfe8">Top 10 titles</div></div>';
  h += '</div>';
  /* gold collection button */
  h += '<button onclick="window.showAssetGallery&&window.showAssetGallery()" style="width:100%;padding:11px;border-radius:14px;border:2px solid #ffb400;background:linear-gradient(90deg,rgba(255,120,0,.35),rgba(255,215,0,.20),rgba(255,120,0,.35));box-shadow:0 0 16px rgba(255,180,0,.45);color:#ffd75e;font-size:13px;font-weight:900;cursor:pointer">👑 My Collection (Titles + Badges) ➤</button>';
  /* bottom diamond */
  h += '<div style="text-align:center;font-size:24px;margin-top:8px;filter:drop-shadow(0 0 10px #d24dff)">💠</div>';
  h += '</div>';
  if (window.openModal) openModal('🏆 How Rank Works', h);
};

console.log('[Mini eSports] ✅ Rank System v2.0 loaded');
})();
