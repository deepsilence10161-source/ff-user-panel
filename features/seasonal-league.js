/* ================================================================
   SEASONAL LEAGUE SYSTEM — seasonal-league.js
   
   Firebase:
   appSettings/currentSeason: { id, name, startDate, endDate, active }
   seasons/{seasonId}/rankings/{uid}: { rank, kills, wins, matches }
   users/{uid}/seasonHistory: [ { seasonId, rank, badge } ]
   ================================================================ */

(function() {
'use strict';

var _season = null;

/* ── Load Current Season ── */
window.loadCurrentSeason = function() {
  if (!window.db) { setTimeout(window.loadCurrentSeason, 800); return; }
  window.db.ref('appSettings/currentSeason').on('value', function(snap) {
    _season = snap.val();
    window._currentSeason = _season;
    // Update any season displays
    if (window.updateSeasonDisplay) window.updateSeasonDisplay(_season);
  });
};

window.getCurrentSeason = function() {
  if (!_season) return { name: 'Season 1', daysLeft: 0, label: '', active: false };
  var now = Date.now();
  var end = _season.endDate || (now + 30 * 86400000);
  var daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
  return {
    id:       _season.id || 'S1',
    name:     _season.name || (window.CFG && window.CFG.seasonName) || 'Season 1',
    daysLeft: daysLeft,
    endDate:  end,
    active:   !!_season.active,
    label:    daysLeft > 0 ? daysLeft + ' din baaki' : 'Ended'
  };
};

/* ── Season Rank Display (profile/rank screen) ── */
window.showSeasonInfo = function() {
  var s = window.getCurrentSeason();
  var h = '<div style="text-align:center;padding:8px 0">';
  h += '<div style="font-size:13px;font-weight:900;color:#ffd700;margin-bottom:4px">' + s.name + '</div>';

  if (s.active) {
    var pct = Math.max(0, Math.min(100, 100 - (s.daysLeft / 90 * 100)));
    h += '<div style="background:rgba(255,255,255,.06);border-radius:10px;height:6px;margin:8px 0"><div style="width:' + pct + '%;height:6px;background:linear-gradient(90deg,#00ff9c,#ffd700);border-radius:10px;transition:width .5s"></div></div>';
    h += '<div style="font-size:12px;color:var(--txt2)">' + s.daysLeft + ' din baaki</div>';
  }

  // Season prizes
  h += '<div style="margin-top:14px;background:rgba(0,0,0,.2);border-radius:12px;padding:12px">';
  h += '<div style="font-size:11px;font-weight:800;color:#fff;margin-bottom:8px">🏆 Season End Rewards</div>';
  var prizes = [
    { pos: '#1 Champion',    reward: '🌟 Grandmaster Badge + 500🪙' },
    { pos: '#2–#5',          reward: '👑 Legend Badge + 200🪙' },
    { pos: '#6–#20',         reward: '💎 Diamond Badge + 100🪙' },
    { pos: '#21–#100',       reward: '🥇 Gold Badge + 50🪙' },
  ];
  prizes.forEach(function(p) {
    h += '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px"><span style="color:#888">' + p.pos + '</span><span style="color:#ffd700">' + p.reward + '</span></div>';
  });
  h += '</div>';

  // My season stats
  if (window.U && window.UD) {
    h += '<div style="margin-top:12px">';
    h += '<div style="font-size:11px;font-weight:800;color:#00d4ff;margin-bottom:8px">📊 Tumhara Is Season Ka Stats</div>';
    var st = (window.UD && window.UD.stats) || {};
    var rk = window.calcRk ? window.calcRk(st) : { badge: 'Bronze', emoji: '🏅', pts: 0 };
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">';
    [
      { l: 'Rank', v: rk.emoji + ' ' + rk.badge },
      { l: 'Points', v: rk.pts },
      { l: 'Wins', v: st.wins || 0 },
    ].forEach(function(i) {
      h += '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:8px;text-align:center"><div style="font-size:15px;font-weight:900;color:#fff">' + i.v + '</div><div style="font-size:10px;color:#666">' + i.l + '</div></div>';
    });
    h += '</div></div>';
  }

  h += '</div>';
  if (window.openModal) openModal('🏆 ' + s.name, h);
};

/* ── Season History (profile pe) ── */
window.showSeasonHistory = function() {
  if (!window.U || !window.db) { toast('Login karo pehle', 'err'); return; }
  /* Load season history from Supabase */
  if (window._supa && window.U) {
    window._supa.from('seasonal_league_history').select('*').eq('user_id', window.U.uid).order('created_at', { ascending: false })
      .then(function(r) {
        var hist = (r.data || []).map(function(s) { return { seasonName: s.season_name, seasonNum: s.season_num, finalTier: s.final_tier, points: s.points, badge: s.badge }; });
        if (window.renderSeasonHistory) renderSeasonHistory(hist);
      }).catch(function(){});
    return;
  }
  window.db.ref('users/' + window.U.uid + '/seasonHistory').once('value', function(snap) {
    var history = [];
    snap.forEach(function(c) { history.unshift(c.val()); });

    var h = '';
    if (!history.length) {
      h = '<div style="text-align:center;padding:24px"><div style="font-size:32px;margin-bottom:8px">📅</div><div style="color:var(--txt2)">Abhi tak koi completed season nahi</div></div>';
    } else {
      h = '<div style="display:flex;flex-direction:column;gap:8px">';
      history.forEach(function(s) {
        h += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px;display:flex;align-items:center;gap:12px">';
        h += '<div style="font-size:24px">' + (s.emoji || '🏅') + '</div>';
        h += '<div style="flex:1"><div style="font-size:13px;font-weight:800">' + (s.seasonName || 'Season') + '</div>';
        h += '<div style="font-size:11px;color:var(--txt2);margin-top:2px">Rank: <strong style="color:#ffd700">#' + (s.position || '?') + '</strong> • ' + (s.badge || '') + '</div></div>';
        if (s.reward) h += '<div style="font-size:12px;color:#00ff9c;font-weight:700">' + s.reward + '</div>';
        h += '</div>';
      });
      h += '</div>';
    }
    if (window.openModal) openModal('📅 Season History', h);
  });
};

/* ── Auto-load ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { setTimeout(window.loadCurrentSeason, 1500); });
} else {
  setTimeout(window.loadCurrentSeason, 1500);
}

})();
