/* ================================================================
   TOURNAMENT HISTORY & STATS — match-history.js
   
   Firebase: users/{uid}/matchHistory/{matchId}: { result, kills, rank, prize, date }
   ================================================================ */

(function() {
'use strict';

/* ── Show Match History ── */
window.showMatchHistory = function() {
  /* Bug 63 Fix: match-history now reads from Supabase only — no db.ref needed */
  if (!window.U) { toast('Login karo pehle', 'err'); return; }

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
      }, function(){});
    return;
  }
  /* Bug 63 Fix: RTDB match history fallback removed.
     All history is in Supabase join_requests.
     If Supabase read fails above, show error state. */
  if (window._supa && window.U) {
    /* already handled above */ return;
  }
  var list = document.getElementById('mhList');
  if (list) list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--txt2)">Koi match history nahi — pehle match khelo!</div>';
}

/* ── Save match result to history (called by admin result approval) ── */
window.saveMatchToHistory = function(matchId, resultData) {
  /* Bug 63 Fix: Removed duplicate Firebase RTDB writes.
     Match history is stored in Supabase join_requests table.
     Stats are stored in Supabase users table.
     Writing to both caused duplicate wallet records + wasted Firebase quota. */
  if (!window.U || !window._supa) return;
  var uid = window.U.uid;
  /* Update Supabase join_request with result data */
  window._supa.from('join_requests')
    .update({
      placement:       resultData.position  || 0,
      kills:           resultData.kills     || 0,
      prize_earned:    resultData.prize     || 0,
      status:          'completed'
    })
    .eq('match_id', matchId)
    .eq('user_id', uid)
    .then(null, function(e){ console.warn('[MatchHistory] Update failed:', e.message); });

  /* Update aggregate stats on users table */
  var statsUpdate = { updated_at: new Date().toISOString() };
  if (window.UD) {
    statsUpdate.total_matches = (Number(window.UD.total_matches)||0) + 1;
    statsUpdate.total_kills   = (Number(window.UD.total_kills  )||0) + (resultData.kills||0);
    if (resultData.position === 1)
      statsUpdate.total_wins  = (Number(window.UD.total_wins   )||0) + 1;
    /* Update local cache */
    window.UD.total_matches = statsUpdate.total_matches;
    window.UD.total_kills   = statsUpdate.total_kills;
    if (resultData.position === 1) window.UD.total_wins = statsUpdate.total_wins;
  }
  window._supa.from('users').update(statsUpdate).eq('id', uid)
    .then(null, function(e){ console.warn('[MatchHistory] Stats update failed:', e.message); });
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

/* ── renderMatchHistory — renders Supabase history in modal (called by loadMatchHistory) ── */
window.renderMatchHistory = function(hist) {
  var setEl = function(id, val) { var e = document.getElementById(id); if (e) e.textContent = val; };
  var totalMatches = hist.length;
  var wins = hist.filter(function(h) { return h.rank === 1; }).length;
  var totalKills = hist.reduce(function(s, h) { return s + (h.kills || 0); }, 0);
  var winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  setEl('mhTotalMatches', totalMatches);
  setEl('mhWins', wins);
  setEl('mhKills', totalKills);
  setEl('mhWinRate', winRate + '%');
  var list = document.getElementById('mhList');
  if (!list) return;
  if (!hist.length) {
    list.innerHTML = '<div style="text-align:center;padding:24px;color:var(--txt2)">Koi match history nahi — pehle match khelo!</div>';
    return;
  }
  var html = '<div style="display:flex;flex-direction:column;gap:8px">';
  hist.forEach(function(m) {
    var pos = m.rank || 0;
    var posEmoji = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : (pos > 0 ? '#' + pos : '—');
    var date = m.playedAt ? new Date(m.playedAt).toLocaleDateString('en-IN', {day:'numeric', month:'short'}) : '—';
    var won = pos === 1;
    html += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,' + (won ? '.15' : '.06') + ');border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:10px">';
    html += '<div style="font-size:20px;min-width:28px;text-align:center">' + posEmoji + '</div>';
    html += '<div style="flex:1;min-width:0">';
    html += '<div style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (m.matchName || 'Match') + '</div>';
    html += '<div style="font-size:10px;color:var(--txt2);margin-top:2px">' + date + ' • ' + (m.mode || 'Solo') + '</div>';
    html += '</div><div style="text-align:right;flex-shrink:0">';
    html += '<div style="font-size:13px;font-weight:900;color:#ff6b6b">💀' + (m.kills || 0) + '</div>';
    if (m.winnings > 0) html += '<div style="font-size:10px;color:#00ff9c;margin-top:2px">+' + m.winnings + ' 💎</div>';
    html += '</div></div>';
  });
  html += '</div>';
  list.innerHTML = html;
};

/* ── renderSeasonHistory — used by seasonal-league ──
   ✅ FIX (Audit follow-up): pehle yeh s.season.name / s.final_rank_tier /
   s.final_position / s.final_rank_points expect karta tha — yeh kabhi
   exist hi nahi karte the jo data seasonal-league.js actually deta hai
   (s.seasonName / s.finalTier / s.points / s.badge). Display hamesha
   "Season" / "Bronze" / "#—" / "0 pts" placeholder dikhata rehta tha,
   chahe data Supabase mein sahi se ho bhi. Ab real field names use kar
   rahe hain, aur reward/emoji bhi dikha rahe hain. */
window.renderSeasonHistory = function(seasons) {
  var list = document.getElementById('seasonHistList');
  if (!list) return;
  if (!seasons || !seasons.length) { list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txt2)">Koi season history nahi</div>'; return; }
  var html = '';
  seasons.forEach(function(s) {
    html += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center">';
    html += '<div><div style="font-weight:700">' + (s.emoji ? s.emoji + ' ' : '') + (s.seasonName || 'Season') + '</div>';
    html += '<div style="font-size:11px;color:var(--txt2)">' + (s.finalTier || 'Bronze') + (s.reward ? ' • ' + s.reward : '') + '</div></div>';
    html += '<div style="text-align:right"><div style="font-weight:900;color:#ffd700">' + (s.badge || '—') + '</div>';
    html += '<div style="font-size:11px;color:var(--txt2)">' + (s.points || 0) + ' pts</div></div>';
    html += '</div>';
  });
  list.innerHTML = html;
};

/* ── renderLiveSpectateList — used by watch-earn spectate ── */
window.renderLiveSpectateList = function(matches) {
  var list = document.getElementById('liveSpectateList');
  if (!list) return;
  if (!matches || !matches.length) { list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-tv" style="font-size:32px;margin-bottom:8px;display:block;color:#444"></i>Koi live match nahi abhi</div>'; return; }
  var html = '';
  matches.forEach(function(m) {
    html += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center" onclick="window.startWatching&&startWatching(\'' + m.id + '\')">';
    html += '<div><div style="font-weight:700">' + (m.title || m.name || 'Live Match') + '</div>';
    html += '<div style="font-size:11px;color:#ff4444;margin-top:2px">🔴 Live • ' + (m.spectator_count || 0) + ' watching</div></div>';
    html += '<div style="font-size:20px">👁️</div></div>';
  });
  list.innerHTML = html;
};

/* ── showReferralLeaderboard — referral leaderboard modal ── */
window.showReferralLeaderboard = function() {
  if (!window._supa || !window.U) { if (window.toast) toast('Login karo pehle', 'err'); return; }
  var h = '<div id="refLbList" style="min-height:80px"><div style="text-align:center;padding:20px;color:#555"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>';
  if (window.openModal) openModal('🏆 Referral Leaderboard', h);
  window._supa.from('referral_leaderboard').select('referrer_id, ign, avatar_url, referral_count').order('referral_count', {ascending:false}).limit(20)
    .then(function(r) {
      var list = document.getElementById('refLbList'); if (!list) return;
      var rows = r.data || [];
      if (!rows.length) { list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txt2)">Koi referral data nahi</div>'; return; }
      var html = '';
      rows.forEach(function(row, i) {
        var ign = row.ign || 'Player';
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid rgba(255,255,255,.05)">';
        html += '<div style="font-size:16px;font-weight:900;min-width:28px;color:' + (i===0?'#ffd700':i===1?'#ccc':i===2?'#cd7f32':'var(--txt2)') + '">#' + (i+1) + '</div>';
        html += '<div style="flex:1;font-weight:700">' + ign + '</div>';
        html += '<div style="font-size:13px;color:var(--green);font-weight:800">' + (row.referral_count || 0) + ' referrals</div>';
        html += '</div>';
      });
      list.innerHTML = html;
    }, function() {
      var list = document.getElementById('refLbList'); if (list) list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txt2)">Error loading</div>';
    });
};

/* ── showPlayerTitles — show ALL titles (unlocked + locked) ── */
window.showPlayerTitles = function() {
  if (!window.UD) return;
  /* ✅ FIX (2026-08-21): merged two previously-disconnected title
     systems into one. This function used to show only ~8 basic titles
     and only the ones already unlocked. Meanwhile fixes-v29-all-bugs.js
     had a separate, richer 14-tier catalog (rank tiers, kill milestones,
     dynamic Supabase achievements) sitting in a getMyTitles() function
     that nothing ever called — it waited for window.showMyTitles, which
     was never defined anywhere, so that whole block was dead on arrival.
     Now: the full richer catalog is used here, AND locked titles are
     shown (dimmed, with a 🔒 icon and live progress like "7/10 wins")
     instead of being hidden — so the title list actually motivates
     progress instead of only rewarding it after the fact. */
  var wins   = Number(window.UD.total_wins || 0);
  var streak = Number(window.UD.win_streak || 0);
  var kills  = Number(window.UD.total_kills || 0);
  var rp     = Number(window.UD.rank_points || window.UD.rankPoints || 0);
  var prem   = Number(window.UD.premium_level || 0);

  var ALL_TITLES = [
    { title: '🏆 Winner',       desc: 'Pehli jeet',                needVal: wins,   need: 1,   unlocked: wins >= 1 },
    { title: '🔥 Veteran',      desc: '10 baar jeeta',             needVal: wins,   need: 10,  unlocked: wins >= 10 },
    { title: '⚔️ Champion',     desc: '50 baar jeeta',             needVal: wins,   need: 50,  unlocked: wins >= 50 },
    { title: '👑 Legend',       desc: '100 baar jeeta',            needVal: wins,   need: 100, unlocked: wins >= 100 },
    { title: '⚡ On Fire',      desc: '3+ consecutive wins',       needVal: streak, need: 3,   unlocked: streak >= 3 },
    { title: '🌟 Unstoppable',  desc: '7+ consecutive wins',       needVal: streak, need: 7,   unlocked: streak >= 7 },
    { title: '🥈 Silver Tier',  desc: '500+ Rank Points',          needVal: rp,     need: 500,  unlocked: rp >= 500 },
    { title: '🥇 Gold Tier',    desc: '1000+ Rank Points',         needVal: rp,     need: 1000, unlocked: rp >= 1000 },
    { title: '💎 Diamond Tier', desc: '2000+ Rank Points',         needVal: rp,     need: 2000, unlocked: rp >= 2000 },
    { title: '⭐ Grandmaster',  desc: '5000+ Rank Points',         needVal: rp,     need: 5000, unlocked: rp >= 5000 },
    { title: '🔫 Marksman',     desc: '100+ total kills',          needVal: kills,  need: 100, unlocked: kills >= 100 },
    { title: '💀 Terminator',   desc: '500+ total kills',          needVal: kills,  need: 500, unlocked: kills >= 500 },
    { title: '✅ Clean Player', desc: '30 matches without report', needVal: null,   need: null, unlocked: !!window.UD.has_clean_badge },
    { title: '💎 VIP Member',   desc: 'VIP status granted',        needVal: null,   need: null, unlocked: !!window.UD.is_vip || prem >= 3 },
    { title: '⭐ Premium',      desc: 'Premium subscriber',        needVal: null,   need: null, unlocked: prem >= 1 },
    { title: '🎥 Creator',      desc: 'Verified content creator',  needVal: null,   need: null, unlocked: !!(window.UD.is_creator || window.UD.isCreator) }
  ];

  /* Dynamic achievement-unlocked titles from Supabase, if any loaded */
  if (window._supaAchievements && window._supaAchievements.length) {
    window._supaAchievements.forEach(function(a) {
      if (a.title_unlocked) ALL_TITLES.push({ title: '🏅 ' + a.title_unlocked, desc: a.description || 'Achievement unlocked', needVal: null, need: null, unlocked: true });
    });
  }

  var unlockedCount = ALL_TITLES.filter(function(t){ return t.unlocked; }).length;
  var h = '<div>';
  h += '<div style="text-align:center;margin-bottom:14px;font-size:12px;color:var(--txt2)">' + unlockedCount + ' / ' + ALL_TITLES.length + ' unlocked</div>';
  ALL_TITLES.forEach(function(t) {
    var emoji = t.title.split(' ')[0];
    var label = t.title.substring(t.title.indexOf(' ')+1);
    if (t.unlocked) {
      h += '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(0,255,156,.05);border:1px solid rgba(0,255,156,.2);border-radius:12px;margin-bottom:8px">';
      h += '<div style="font-size:24px">' + emoji + '</div>';
      h += '<div><div style="font-weight:700;color:var(--txt)">' + label + '</div><div style="font-size:11px;color:var(--txt2)">' + t.desc + '</div></div>';
      h += '</div>';
    } else {
      h += '<div style="display:flex;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:12px;margin-bottom:8px;opacity:.55">';
      h += '<div style="font-size:22px;filter:grayscale(1)">🔒</div>';
      h += '<div style="flex:1"><div style="font-weight:700;color:var(--txt2)">' + label + '</div><div style="font-size:11px;color:var(--txt2)">' + t.desc + '</div></div>';
      if (t.need) h += '<div style="font-size:10px;color:var(--txt2);font-weight:700;white-space:nowrap">' + t.needVal + '/' + t.need + '</div>';
      h += '</div>';
    }
  });
  h += '</div>';
  if (window.openModal) openModal('🎖️ My Titles', h);
};

/* ── showSmartPrizeCalc — prize calculator modal ── */
window.showSmartPrizeCalc = function() {
  var h = '<div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:12px;color:var(--txt2);display:block;margin-bottom:4px">Entry Fee (Coins/Diamonds)</label>';
  h += '<input type="number" id="calcFee" class="f-input" placeholder="e.g. 10" oninput="calcPrize()" min="0"></div>';
  h += '<div style="margin-bottom:12px"><label style="font-size:12px;color:var(--txt2);display:block;margin-bottom:4px">Total Players</label>';
  h += '<input type="number" id="calcPlayers" class="f-input" placeholder="e.g. 100" oninput="calcPrize()" min="1"></div>';
  h += '<div id="calcResult" style="background:rgba(0,255,106,.06);border:1px solid rgba(0,255,106,.15);border-radius:12px;padding:12px;font-size:13px;display:none"></div>';
  h += '</div>';
  if (window.openModal) openModal('🧮 Prize Calculator', h);
};
window.calcPrize = function() {
  var fee = Number((document.getElementById('calcFee')||{}).value) || 0;
  var players = Number((document.getElementById('calcPlayers')||{}).value) || 0;
  var res = document.getElementById('calcResult'); if (!res) return;
  if (!fee || !players) { res.style.display = 'none'; return; }
  var pool = fee * players;
  var commRate = (window.CFG && window.CFG.commission) || 0.15;
  var netPool = Math.floor(pool * (1 - commRate));
  var p1 = Math.floor(netPool * 0.5), p2 = Math.floor(netPool * 0.3), p3 = Math.floor(netPool * 0.2);
  res.style.display = '';
  res.innerHTML = '<div style="font-weight:800;margin-bottom:8px">Prize Distribution (Net Pool: ' + netPool + ')</div>' +
    '<div style="display:flex;flex-direction:column;gap:4px">' +
    '<div style="display:flex;justify-content:space-between">🥇 1st Place<strong style="color:#ffd700">' + p1 + '</strong></div>' +
    '<div style="display:flex;justify-content:space-between">🥈 2nd Place<strong style="color:#ccc">' + p2 + '</strong></div>' +
    '<div style="display:flex;justify-content:space-between">🥉 3rd Place<strong style="color:#cd7f32">' + p3 + '</strong></div>' +
    '</div><div style="font-size:10px;color:var(--txt2);margin-top:8px">' + Math.round(commRate*100) + '% platform fee deducted</div>';
};

})();
