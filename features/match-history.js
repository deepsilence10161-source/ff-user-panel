/* ================================================================
   TOURNAMENT HISTORY & STATS — match-history.js
   
   Firebase: users/{uid}/matchHistory/{matchId}: { result, kills, rank, prize, date }
   ================================================================ */

(function() {
'use strict';

/* ── Show Match History ── */
window.showMatchHistory = function() {
  if (!window.db || !window.U) { toast('Login karo pehle', 'err'); return; }

  var h = '<div>';
  // Stats summary
  h += '<div id="mhStatsRow" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">';
  h += '<div style="text-align:center;background:rgba(255,255,255,.03);border-radius:12px;padding:10px"><div style="font-size:18px;font-weight:900;color:#00d4ff" id="mhTotalMatches">—</div><div style="font-size:9px;color:#888">Matches</div></div>';
  h += '<div style="text-align:center;background:rgba(255,255,255,.03);border-radius:12px;padding:10px"><div style="font-size:18px;font-weight:900;color:#00ff9c" id="mhWins">—</div><div style="font-size:9px;color:#888">Wins</div></div>';
  h += '<div style="text-align:center;background:rgba(255,255,255,.03);border-radius:12px;padding:10px"><div style="font-size:18px;font-weight:900;color:#ff6b6b" id="mhKills">—</div><div style="font-size:9px;color:#888">Total Kills</div></div>';
  h += '<div style="text-align:center;background:rgba(255,255,255,.03);border-radius:12px;padding:10px"><div style="font-size:18px;font-weight:900;color:#ffd700" id="mhWinRate">—</div><div style="font-size:9px;color:#888">Win Rate</div></div>';
  h += '</div>';
  h += '<div id="mhList"><div style="text-align:center;padding:20px;color:#555"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>';
  h += '</div>';

  if (window.openModal) openModal('📊 Match History', h);

  loadMatchHistory();
};

function loadMatchHistory() {
  /* Match history from Supabase join_requests */
  if (window._supa && window.U) {
    window._supa.from('join_requests')
      .select('*, match:matches(title,mode,entry_fee,entry_type,scheduled_at)')
      .eq('user_id', window.U.uid)
      .in('status', ['approved','completed'])
      .order('created_at', { ascending: false })
      .limit(50)
      .then(function(r) {
        var hist = (r.data || []).map(function(jr) {
          return { matchId: jr.match_id, matchName: (jr.match&&jr.match.title)||'Match', mode: (jr.match&&jr.match.mode)||'solo', kills: jr.kills||0, rank: jr.placement||0, winnings: jr.prize_earned||0, entryFee: jr.entry_fee_paid||0, entryType: jr.entry_type||'coins', playedAt: jr.created_at ? new Date(jr.created_at).getTime() : 0 };
        });
        if (window.renderMatchHistory) renderMatchHistory(hist);
      }).catch(function(){});
    return;
  }
  window.db.ref('users/' + window.U.uid + '/matchHistory')
    .orderByChild('playedAt').limitToLast(30).once('value', function(snap) {

    var matches = [];
    snap.forEach(function(c) { matches.unshift({ id: c.key, d: c.val() }); });

    // Calculate stats
    var totalMatches = matches.length;
    var wins = matches.filter(function(m) { return m.d.position === 1; }).length;
    var totalKills = matches.reduce(function(sum, m) { return sum + (Number(m.d.kills)||0); }, 0);
    var winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    // Update stats
    var setEl = function(id, val) { var e = document.getElementById(id); if(e) e.textContent = val; };
    setEl('mhTotalMatches', totalMatches);
    setEl('mhWins', wins);
    setEl('mhKills', totalKills);
    setEl('mhWinRate', winRate + '%');

    var list = document.getElementById('mhList');
    if (!list) return;

    if (!matches.length) {
      list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--txt2)">Koi match history nahi — pehle match khelo!</div>';
      return;
    }

    var html = '<div style="display:flex;flex-direction:column;gap:8px">';
    matches.forEach(function(m) {
      var d = m.d;
      var pos = d.position || '?';
      var posColor = pos === 1 ? '#ffd700' : pos <= 3 ? '#00ff9c' : 'var(--txt2)';
      var posEmoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : '#' + pos;
      var date = d.playedAt ? new Date(d.playedAt).toLocaleDateString('en-IN', {day:'numeric',month:'short'}) : '—';
      var prizeHtml = d.prize ? '<span style="color:#00ff9c;font-size:10px;font-weight:700">' + d.prize + '</span>' : '';

      html += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.' + (pos===1?'15':'06') + ');border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:10px">';
      html += '<div style="font-size:20px;min-width:28px;text-align:center">' + posEmoji + '</div>';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (d.matchName||'Match') + '</div>';
      html += '<div style="font-size:10px;color:var(--txt2);margin-top:2px">' + date + ' • ' + (d.mode||'Solo') + ' • ' + (d.map||'') + '</div>';
      html += '</div>';
      html += '<div style="text-align:right;flex-shrink:0">';
      html += '<div style="font-size:13px;font-weight:900;color:#ff6b6b">💀' + (d.kills||0) + '</div>';
      if (prizeHtml) html += '<div style="margin-top:2px">' + prizeHtml + '</div>';
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    list.innerHTML = html;
  });
}

/* ── Save match result to history (called by admin result approval) ── */
window.saveMatchToHistory = function(matchId, resultData) {
  if (!window.db || !window.U) return;
  /* Match history saved via join_requests table in Supabase */
  /* Legacy Firebase save kept as backup */
  if (window.db) window.db.ref('users/' + window.U.uid + '/matchHistory/' + matchId).set({
    matchName: resultData.matchName || 'Match',
    mode:      resultData.mode || 'Solo',
    map:       resultData.map || '',
    position:  resultData.position || 0,
    kills:     resultData.kills || 0,
    prize:     resultData.prize || null,
    playedAt:  Date.now()
  });
  // Update stats counters
  window.db.ref('users/' + window.U.uid + '/stats').transaction(function(s) {
    s = s || {};
    s.matches = (s.matches||0) + 1;
    s.kills   = (s.kills||0) + (resultData.kills||0);
    if (resultData.position === 1) s.wins = (s.wins||0) + 1;
    return s;
  });
};

/* ── Profile stats card ── */
window.renderPlayerStatsCard = function() {
  if (!window.UD) return '';
  var st = window.UD.stats || {};
  var m = st.matches || 0;
  var w = st.wins || 0;
  var k = st.kills || 0;
  var wr = m > 0 ? Math.round((w/m)*100) : 0;
  var kpm = m > 0 ? (k/m).toFixed(1) : '0.0';

  return '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:14px;margin-bottom:12px">' +
    '<div style="font-size:12px;font-weight:800;color:var(--txt2);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px">📊 Career Stats</div>' +
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">' +
    statBox(m, 'Matches', '#00d4ff') +
    statBox(w, 'Wins', '#00ff9c') +
    statBox(wr + '%', 'Win Rate', '#ffd700') +
    statBox(kpm, 'K/Match', '#ff6b6b') +
    '</div>' +
    '<div style="margin-top:10px;text-align:right"><span onclick="showMatchHistory()" style="font-size:11px;color:var(--green);cursor:pointer;font-weight:700">View Full History →</span></div>' +
    '</div>';
};

function statBox(val, label, color) {
  return '<div style="text-align:center;background:rgba(0,0,0,.2);border-radius:10px;padding:8px">' +
    '<div style="font-size:16px;font-weight:900;color:' + color + '">' + val + '</div>' +
    '<div style="font-size:9px;color:#888;margin-top:2px">' + label + '</div>' +
    '</div>';
}

})();
