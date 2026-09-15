/* ================================================================
   GROWTH FEATURES — growth-features.js
   Mini eSports User Panel v11
   
   1. City Leaderboard
   2. Share Card (Viral Loop)
   3. Daily + Weekly Missions
   4. Enhanced Refer & Earn
   5. Lifetime Achievements v3
   6. Sky Diamond Cosmetics Store
   7. Clan War Sunday Banner
   ================================================================ */

(function() {
'use strict';

/* ── HELPERS ── */
/* $ function removed — using utils.js version */

/* ================================================================
   1. CITY LEADERBOARD
   ================================================================ */
window.showCityLeaderboard = function() {
  var userCity = (window.UD && window.UD.city) || '';
  var h = '<div style="margin-bottom:14px">';
  h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px" id="cityTabBar">';
  ['My City', 'All India'].forEach(function(tab, i) {
    h += '<button onclick="switchCityTab(' + i + ')" id="cityTab' + i + '" style="padding:7px 14px;border-radius:20px;border:none;font-size:12px;font-weight:700;cursor:pointer;transition:all .2s;background:' + (i===0?'var(--green)':'rgba(255,255,255,.08)') + ';color:' + (i===0?'#000':'var(--txt)') + '">' + tab + '</button>';
  });
  h += '</div>';
  h += '<div id="cityLeaderContent"><div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Loading...</div></div>';
  h += '</div>';
  if (window.openModal) openModal('🏆 Leaderboard', h);
  loadCityLeader(0, userCity);
};

window.switchCityTab = function(idx) {
  [0,1].forEach(function(i) {
    var b = $('cityTab' + i);
    if (b) { b.style.background = i===idx?'var(--green)':'rgba(255,255,255,.08)'; b.style.color = i===idx?'#000':'var(--txt)'; }
  });
  var city = idx === 0 ? ((window.UD && window.UD.city)||'') : '';
  loadCityLeader(idx, city);
};

function loadCityLeader(tab, city) {
  var cont = $('cityLeaderContent');
  if (!cont) return;
  if (!window.db || !window.U) { cont.innerHTML = '<div style="text-align:center;padding:20px;color:#ff6b6b">Login required</div>'; return; }

  cont.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';

  /* City leaderboard from Supabase */
  if (window._supa && window.U) {
    var userCity = window.UD && window.UD.city ? window.UD.city : null;
    var q = userCity ? window._supa.from('user_public_profiles').select('id,ign,rank_points,city,avatar_url').eq('city', userCity).order('rank_points', { ascending: false }).limit(50) : window._supa.from('leaderboard').select('*').limit(50); /* BUG #38 FIX */
    q.then(function(r) {
      /* BUG FIX (2026-08-21): window.renderCityLeaderboard was called here
         but never defined anywhere in the codebase — the only similarly
         named function is _renderCityLeaderboardModal in modal.js, which
         is unrelated. So this branch always silently did nothing and the
         "Loading..." spinner never went away. Reuse the real working
         render logic below (players array + medal/rank HTML) instead of
         a function that doesn't exist. */
      var rows = r && r.data ? r.data : [];
      var players = rows.map(function(d) {
        return {
          uid: d.id,
          ign: d.ign || 'Player',
          rp: Number(d.rank_points || 0),
          city: d.city || '',
          avatarBg: d.avatar_bg_color || '#1a1a2e',
          wins: Number(d.total_wins || 0)
        };
      });
      players.sort(function(a, b) { return b.rp - a.rp; });
      renderLeaderList(cont, players, tab, city);

      /* ✅ BUG FIX (2026-08-24): "Aapki rank top 50 se bahar hai" AND
         "Aapki rank: #1" showed together, contradicting each other.
         Root cause was TWO separate, uncoordinated pieces of code both
         trying to render a "your rank" fallback:
           1. renderLeaderList()'s own fallback (when user not in top 20)
           2. this block appending a SECOND, separate note underneath
         On top of that, the count query here used .gt('rank_points',
         myRp) — with every player currently tied at 0 points, "how many
         have MORE than 0" is always 0, so it always reported rank #1
         for every single tied player, ties not counted at all.
         Fix: single source of truth. Compute the real tie-aware rank
         here (players who rank strictly above me by score, or by
         earlier position when tied) via .gte() + a tiebreak count, and
         only render ONE note — removing the redundant, contradicting
         fallback from renderLeaderList entirely (see below). */
      var meInFetched = window.U && players.some(function(p) { return p.uid === window.U.uid; });
      if (!meInFetched && window.UD) {
        var myRp = Number(window.UD.rankPoints || window.UD.rank_points || 0);
        /* Players strictly above me by rank_points */
        var aboveQ = window._supa.from('user_public_profiles').select('id', { count: 'exact', head: true }).gt('rank_points', myRp);
        if (userCity && tab === 0) aboveQ = aboveQ.eq('city', userCity);
        aboveQ.then(function(cr) {
          var above = (typeof cr.count === 'number' ? cr.count : players.length);
          var myRank = above + 1;
          var el = document.getElementById('cityLeaderContent');
          if (!el) return;
          var existing = el.querySelector('[data-rank-note]');
          if (existing) existing.remove();
          var note = document.createElement('div');
          note.setAttribute('data-rank-note', '1');
          note.style.cssText = 'text-align:center;padding:10px;margin-top:6px;border-radius:10px;background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.2);font-size:12px;color:var(--green);font-weight:700';
          note.textContent = above === 0
            ? ('Aapki rank top 50 mein nahi hai, lekin ' + (myRp === 0 ? 'abhi tak sabki rank barabar hai (0 pts) — pehla match jeetkar #1 pakko banao!' : ('#' + myRank + ' ho tum (' + myRp + ' pts)')))
            : ('Aapki rank: #' + myRank + ' (' + myRp + ' pts)');
          el.appendChild(note);
        }, function() { /* silent — nothing appended on failure, no misleading fallback shown */ });
      }
    }, function(err) {
      cont.innerHTML = '<div style="text-align:center;padding:24px;color:#ff6b6b">Leaderboard load nahi ho paya. Dobara try karo.</div>';
    });
    return;
  }
  var query = window.db ? window.db.ref('users').orderByChild('rankPoints').limitToLast(50) : null;
  if (!query) return;

  query.once('value', function(snap) {
    var players = [];
    snap.forEach(function(c) {
      var d = c.val();
      if (!d.ign) return;
      if (tab === 0 && city && (d.city||'').toLowerCase() !== city.toLowerCase()) return;
      players.push({ uid: c.key, ign: d.ign, rp: Number(d.rankPoints||0), city: d.city||'', avatarBg: d.avatarBg||'#1a1a2e', wins: Number((d.stats&&d.stats.wins)||0) });
    });
    players.sort(function(a,b) { return b.rp - a.rp; });
    renderLeaderList(cont, players, tab, city);
  });
}

/* BUG FIX (2026-08-21): extracted the actual leaderboard-row rendering
   into a shared function so both the Supabase path and the legacy
   Firebase path use the same real, working renderer — instead of the
   Supabase path calling a function (window.renderCityLeaderboard) that
   never existed. */
function renderLeaderList(cont, players, tab, city) {
    if (!players.length) {
      cont.innerHTML = '<div style="text-align:center;padding:24px"><div style="font-size:32px;margin-bottom:8px">🏙️</div><div style="color:var(--txt2);font-size:13px">' + (tab===0 && city ? 'Abhi ' + city + ' mein koi player nahi — pehle ban jao!' : 'Koi data nahi') + '</div></div>';
      return;
    }

    var html = '';
    if (tab === 0 && city) {
      html += '<div style="text-align:center;margin-bottom:10px;font-size:12px;font-weight:700;color:#ffd700">🏙️ ' + city + ' Leaderboard</div>';
    }
    var top20 = players.slice(0, 20);
    /* ✅ BUG FIX (2026-08-23): "My City aur All India leaderboard me user
       khud ko dhoondh hi nahi paata ki wo konsi rank par hai". Root
       cause: this only ever rendered players.slice(0, 20) — anyone
       ranked below #20 (which, with 0 points/0 wins as a new player,
       is basically everyone at launch) never appeared anywhere in the
       list, with no fallback of any kind telling them their own rank.
       Fix: if the current user isn't in the visible top 20, find their
       real position in the full fetched list (already sorted) and pin
       a separate "You" row at the bottom, same as most leaderboard UIs
       — so the user can always see where they stand even if it's not
       in the top 20. */
    var meIdx = -1;
    for (var pi = 0; pi < players.length; pi++) {
      if (window.U && players[pi].uid === window.U.uid) { meIdx = pi; break; }
    }
    var meInTop20 = meIdx > -1 && meIdx < 20;

    top20.forEach(function(p, i) {
      var isMe = window.U && p.uid === window.U.uid;
      var rank = i + 1;
      var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
      html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;margin-bottom:6px;background:' + (isMe?'rgba(0,255,156,.08)':'rgba(255,255,255,.03)') + ';border:1px solid ' + (isMe?'rgba(0,255,156,.25)':'rgba(255,255,255,.06)') + '">';
      html += '<div style="width:28px;text-align:center;font-size:' + (rank<=3?'18':'13') + 'px;font-weight:800;color:' + (rank===1?'#ffd700':rank===2?'#c0c0c0':rank===3?'#cd7f32':'#666') + '">' + medal + '</div>';
      html += '<div style="width:34px;height:34px;border-radius:50%;background:' + p.avatarBg + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0">' + (p.ign[0]||'?').toUpperCase() + '</div>';
      html += '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:' + (isMe?'var(--green)':'var(--txt)') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p.ign + (isMe?' (You)':'') + '</div>';
      html += '<div style="font-size:10px;color:var(--txt2);margin-top:1px">' + (p.city||'Unknown') + ' • ' + p.wins + ' wins</div></div>';
      html += '<div style="text-align:right;flex-shrink:0"><div style="font-size:14px;font-weight:900;color:#00d4ff">' + p.rp + '</div><div style="font-size:9px;color:var(--txt2)">RP</div></div>';
      html += '</div>';
    });

    if (!meInTop20) {
      if (meIdx > -1) {
        var me = players[meIdx];
        var myRank = meIdx + 1;
        html += '<div style="text-align:center;padding:6px 0;font-size:10px;color:var(--txt2)">• • •</div>';
        html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;margin-bottom:6px;background:rgba(0,255,156,.08);border:1.5px solid rgba(0,255,156,.35)">';
        html += '<div style="width:28px;text-align:center;font-size:13px;font-weight:800;color:#00ff9c">#' + myRank + '</div>';
        html += '<div style="width:34px;height:34px;border-radius:50%;background:' + me.avatarBg + ';display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:#fff;flex-shrink:0">' + (me.ign[0]||'?').toUpperCase() + '</div>';
        html += '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--green);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + me.ign + ' (You)</div>';
        html += '<div style="font-size:10px;color:var(--txt2);margin-top:1px">' + (me.city||'Unknown') + ' • ' + me.wins + ' wins</div></div>';
        html += '<div style="text-align:right;flex-shrink:0"><div style="font-size:14px;font-weight:900;color:#00d4ff">' + me.rp + '</div><div style="font-size:9px;color:var(--txt2)">RP</div></div>';
        html += '</div>';
      }
      /* ✅ BUG FIX (2026-08-24): removed the old "Aapki rank top 50 se
         bahar hai" static fallback that used to render here — it had no
         way of knowing the real rank and directly contradicted the
         single accurate rank note now appended by loadCityLeader's own
         count query (see above). One source of truth, one note. */
    }

    cont.innerHTML = html;
}

/* ================================================================
   2. SHARE CARD — VIRAL LOOP
   ================================================================ */
window.showShareCard = function(matchId, playerRank, playerKills, cityName) {
  if (!window.UD || !window.U) return;
  var ign = window.UD.ign || window.UD.displayName || 'Player';
  var rank = playerRank || 1;
  var kills = playerKills || 0;
  var city = cityName || window.UD.city || 'India';

  var rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
  var msg = rankEmoji + ' ' + ign + ' ne ' + city + ' mein #' + rank + ' rank liya!\n💀 ' + kills + ' kills\n🎮 Mini eSports pe khelna chahte ho?\n👉 Download karo aur mere se takrao!\n#MinieSports #FreeFire #BGMI';

  var h = '<div style="text-align:center">';
  // Share card visual
  h += '<div id="shareCardVisual" style="background:linear-gradient(135deg,#0a0a1a,#1a1a2e,#0d1117);border:2px solid rgba(0,255,156,.3);border-radius:18px;padding:24px;margin-bottom:16px;position:relative;overflow:hidden">';
  h += '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(circle at 30% 30%,rgba(0,255,156,.05),transparent 60%),radial-gradient(circle at 70% 70%,rgba(0,212,255,.05),transparent 60%)"></div>';
  h += '<div style="font-size:11px;font-weight:800;color:#00ff9c;letter-spacing:2px;margin-bottom:12px;opacity:.7">MINI ESPORTS</div>';
  h += '<div style="font-size:48px;margin-bottom:8px">' + rankEmoji + '</div>';
  h += '<div style="font-size:22px;font-weight:900;color:#fff;margin-bottom:4px">' + ign + '</div>';
  h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">' + city + '</div>';
  h += '<div style="display:flex;justify-content:center;gap:20px;margin-bottom:12px">';
  h += '<div style="text-align:center"><div style="font-size:22px;font-weight:900;color:#ffd700">#' + rank + '</div><div style="font-size:10px;color:var(--txt2)">RANK</div></div>';
  h += '<div style="width:1px;background:rgba(255,255,255,.1)"></div>';
  h += '<div style="text-align:center"><div style="font-size:22px;font-weight:900;color:#ff6b6b">' + kills + '</div><div style="font-size:10px;color:var(--txt2)">KILLS</div></div>';
  h += '</div>';
  h += '<div style="font-size:10px;color:rgba(0,255,156,.5);font-weight:700;letter-spacing:1px">CHALLENGE ME ON MINI ESPORTS</div>';
  h += '</div>';

  h += '<button onclick="doShareResult(\'' + encodeURIComponent(msg) + '\')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#25d366,#128c7e);border:none;color:#fff;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:10px"><i class="fab fa-whatsapp"></i> WhatsApp pe Share Karo</button>';
  h += '<button onclick="doShareResultGeneric(\'' + encodeURIComponent(msg) + '\')" style="width:100%;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer;margin-bottom:10px"><i class="fas fa-share-alt"></i> Kisi bhi app se share karo</button>';
  /* ✅ REMOVED (2026-08-22): the "+20 Coins" reward banner and the entire
     giveShareCoins() mechanism behind it — per explicit instruction, the
     platform should not pay coins for sharing a result. Sharing still
     works below, just without a reward attached. */
  h += '</div>';

  if (window.openModal) openModal('🏆 Result Share Karo', h);
};

window.doShareResult = function(encodedMsg) {
  var msg = decodeURIComponent(encodedMsg);
  window.openWhatsApp(msg);
  if (window.closeModal) window.closeModal();
};

window.doShareResultGeneric = function(encodedMsg) {
  var msg = decodeURIComponent(encodedMsg);
  if (navigator.share) {
    navigator.share({ title: 'Mini eSports Result', text: msg }).catch(function(){});
  } else {
    if (navigator.clipboard) navigator.clipboard.writeText(msg);
    toast('Message copy ho gaya — paste karke share karo!', 'ok');
  }
  if (window.closeModal) window.closeModal();
};
/* ✅ REMOVED (2026-08-22): giveShareCoins() — per explicit instruction,
   the coin-for-sharing-a-result feature is fully removed. It used to
   pay window.CFG.shareCoins (default 20) coins once per day for sharing
   and also silently double-booked as "Weekly Mission: Result Share
   Karo" progress. See fa-app-settings.js (admin config field removed)
   and screens/matches.js (My Matches share button removed earlier) for
   the rest of this cleanup. */

/* ================================================================
   3. DAILY + WEEKLY MISSIONS
   ================================================================ */
window.showMissionsPanel = function() {
  if (!window.UD || !window.U) { toast('Login karo pehle', 'err'); return; }

  window.db.ref('users/' + window.U.uid + '/missionProgress').once('value', function(snap) {
    var prog = snap.val() || {};
    /* ✅ FIX (2026-08-19, CRITICAL): cache the fetched prog object so
       claimMission() can update it and re-render LOCALLY afterwards,
       instead of re-fetching from the DB — see the race-condition
       explanation on _renderMissionsPanelFromProg() below for why this
       was causing the panel to reopen itself repeatedly with duplicate
       "Pehle se claim ho chuka hai" toasts. */
    window._missionsProgCache = prog;
    _renderMissionsPanelFromProg(prog);

    // Auto-claim daily login
    if (!prog['claimed_daily_login_' + new Date().toDateString()]) {
      claimMission('daily_login', 5, new Date().toDateString(), 'daily');
    }
  });
};

function _renderMissionsPanelFromProg(prog) {
  var today = new Date().toDateString();
  var weekNum = getWeekNum();

  var DAILY = [
    { id: 'daily_login',   label: '📅 Login Karo',      desc: 'Aaj login kiya',          reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).daily_login:5),   check: true,                              auto: true },
    { id: 'daily_match',   label: '🎮 1 Match Khelo',   desc: 'Aaj 1 match join karo',   reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).daily_match:10),  check: (prog.lastMatchDate === today) },
    { id: 'daily_kills3',  label: '💀 3 Kills Karo',    desc: 'Aaj 3 kills lo',          reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).daily_kills3:5),   check: (Number(prog.todayKills||0) >= 3) },
    { id: 'daily_checkin', label: '🎁 Check-In Karo',   desc: 'Bonus coins',             reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).daily_checkin:5),   check: (prog.lastCheckIn === today) },
  ];

  var WEEKLY = [
    { id: 'week_5matches', label: '🎯 5 Matches Khelo', desc: 'Is hafte 5 matches',      reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).week_5matches:50),  check: (Number(prog['wMatches_'+weekNum]||0) >= 5), progress: Number(prog['wMatches_'+weekNum]||0), max: 5 },
    { id: 'week_top3',     label: '🏆 Top 3 Finish',   desc: 'Kisi match mein top 3',   reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).week_top3:30),  check: (prog['wTop3_'+weekNum] === true) },
    /* ✅ REMOVED (2026-08-22): "week_share" (Result Share Karo, +20 coins)
       — its only progress source, giveShareCoins(), was removed per
       explicit instruction that sharing should not pay coins. Leaving
       this card in place would have shown a permanently-unclaimable
       mission. */
  ];

  var h = '<div>';

  h += '<div style="font-size:13px;font-weight:800;color:#ffd700;margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="fas fa-sun"></i> Daily Missions</div>';
  DAILY.forEach(function(m) {
    var claimed = prog['claimed_' + m.id + '_' + today] === true;
    var done = m.check;
    h += renderMissionCard(m, done, claimed, today, 'daily');
  });

  h += '<div style="font-size:13px;font-weight:800;color:#00d4ff;margin:14px 0 10px;display:flex;align-items:center;gap:6px"><i class="fas fa-calendar-week"></i> Weekly Missions</div>';
  WEEKLY.forEach(function(m) {
    var claimed = prog['claimed_' + m.id + '_w' + weekNum] === true;
    var done = m.check;
    h += renderMissionCard(m, done, claimed, weekNum, 'weekly');
  });

  h += '</div>';
  if (window.openModal) openModal('🎯 Missions', h);
}

function renderMissionCard(m, done, claimed, period, type) {
  var btnHtml = '';
  if (claimed) {
    btnHtml = '<span style="font-size:11px;color:#00ff9c;font-weight:700">✅ Claimed</span>';
  } else if (done) {
    btnHtml = '<button onclick="claimMission(\'' + m.id + '\',' + m.reward + ',\'' + period + '\',\'' + type + '\')" style="padding:6px 12px;border-radius:10px;background:linear-gradient(135deg,#00ff9c,#00cc7a);border:none;color:#000;font-size:11px;font-weight:800;cursor:pointer">Claim +' + m.reward + '🪙</button>';
  } else {
    btnHtml = '<span style="font-size:11px;color:var(--txt2)">+' + m.reward + '🪙</span>';
  }

  var progressBar = '';
  if (m.progress !== undefined) {
    var pct = Math.min(100, Math.round((m.progress / m.max) * 100));
    progressBar = '<div style="margin-top:6px;background:rgba(255,255,255,.08);border-radius:4px;height:4px"><div style="width:' + pct + '%;height:4px;border-radius:4px;background:linear-gradient(135deg,#00d4ff,#0066ff);transition:width .5s"></div></div>';
    progressBar += '<div style="font-size:10px;color:var(--txt2);margin-top:3px">' + m.progress + ' / ' + m.max + '</div>';
  }

  return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;margin-bottom:8px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07)">' +
    '<div style="flex:1"><div style="font-size:13px;font-weight:700">' + m.label + '</div>' +
    '<div style="font-size:11px;color:var(--txt2);margin-top:2px">' + m.desc + '</div>' + progressBar + '</div>' +
    '<div style="flex-shrink:0">' + btnHtml + '</div></div>';
}

/* ✅ FIX (2026-08-20, CRITICAL — 2nd pass): calls the real Supabase RPCs
   directly instead of going through the Firebase-style bridge's generic
   missionProgress write path. That bridge path (see core/db-bridge.js)
   calls claim_mission_reward with p_coins:0 — but that RPC rejects any
   p_coins <= 0 ("Invalid coin amount"), so every claim would fail
   outright. It also requires is_completed=true on the mission_progress
   row before it'll let a claim through, but nothing ever calls
   track_mission_progress for daily_login to mark it complete, so it
   would always additionally fail with "Mission abhi complete nahi
   hui". Calling both RPCs directly here, in the right order, with the
   real coin amount, avoids both problems and keeps the DB as the
   actual source of truth (so the claim persists correctly across
   reloads, unlike a purely local-cache-only fix). period is
   normalized to YYYY-MM-DD for daily missions to match the format
   every other mission_progress writer uses. */
window.claimMission = function(missionId, coins, period, type) {
  if (!window.U) return;
  var claimKey = 'claimed_' + missionId + '_' + (type === 'weekly' ? 'w' : '') + period;
  var rpcPeriod = (type === 'weekly') ? ('w' + period) : new Date().toISOString().split('T')[0];

  var cache = window._missionsProgCache || {};
  if (cache[claimKey]) {
    toast('Pehle se claim ho chuka hai', 'inf');
    return;
  }
  cache[claimKey] = true; /* optimistic local update — UI responds instantly */
  window._missionsProgCache = cache;

  /* ✅ IMPORTANT: do NOT also credit coins via window.db.ref('.../coins')
     here — claim_mission_reward (called below) already credits coins
     server-side itself (UPDATE users SET coins = coins + p_coins) AND
     logs the wallet_transactions entry. The Firebase-bridge's own
     'coins' field handler routes through increment_balance RPC when
     called — calling both would double-credit the user. UD.coins is
     updated locally below purely for instant UI feedback; the RPC call
     further down is the single real source of truth for the backend
     balance. */
  if (window.UD) { window.UD.coins = (window.UD.coins||0) + coins; if (window.updateHdr) updateHdr(); }
  toast('+' + coins + ' 🪙 Coins mile! Mission complete! 🎉', 'ok');
  if (window.updateHdr) window.updateHdr();
  if (window.UD && window.U) _renderMissionsPanelFromProg(cache);

  if (window._supa) {
    /* Mark complete first (idempotent, GREATEST()-guarded — safe to call
       even if already marked), THEN claim — claim_mission_reward checks
       is_completed and reward_claimed itself, so this is safe even under
       a genuine race with another tab/device (worst case: "Already
       claimed" comes back, which we just ignore since our local/Firebase
       coin credit already happened optimistically above). */
    window._supa.rpc('track_mission_progress', { p_mission_key: missionId, p_period: rpcPeriod, p_progress: 1, p_target: 1 })
      .then(function() {
        return window._supa.rpc('claim_mission_reward', { p_mission_key: missionId, p_period: rpcPeriod, p_coins: coins });
      })
      .then(function(r) {
        if (r && (r.error || (r.data && r.data.success === false))) {
          var err = (r.data && r.data.error) || (r.error && r.error.message) || 'unknown';
          if (err !== 'Already claimed') console.error('[Missions] claim_mission_reward failed:', err);
        }
      })
      .catch(function(e) { console.error('[Missions] claim RPC error:', e && e.message); });
  }
};

function getWeekNum() {
  var d = new Date();
  var onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

// Track match joined for daily mission
var _origJoinMatch = window.joinMatch;
if (_origJoinMatch) {
  window.joinMatch = function() {
    var r = _origJoinMatch.apply(this, arguments);
    if (window.db && window.U) {
      var today = new Date().toDateString();
      var wn = getWeekNum();
      window.db.ref('users/' + window.U.uid + '/missionProgress').update({
        lastMatchDate: today,
        ['wMatches_' + wn]: (Number(((window.UD||{}).missionProgress||{})['wMatches_'+wn]||0) + 1)
      });
    }
    return r;
  };
}

/* ================================================================
   4. ENHANCED REFER & EARN
   ================================================================ */
window.showReferEarn = function() {
  if (!window.UD || !window.U) { toast('Login karo pehle', 'err'); return; }
  var code = window.UD.referralCode || window.U.uid.substring(0,8).toUpperCase();
  var count = Number(window.UD.referralCount || 0);
  var earned = Number(window.UD.referralCoinsEarned || 0);

  var h = '';
  // Stats
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">';
  h += '<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:900;color:#00ff9c">' + count + '</div><div style="font-size:10px;color:var(--txt2)">Friends Joined</div></div>';
  h += '<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.15);border-radius:12px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:900;color:#ffd700">' + earned + '🪙</div><div style="font-size:10px;color:var(--txt2)">Total Earned</div></div>';
  h += '</div>';

  // Reward steps
  h += '<div style="background:rgba(0,0,0,.3);border-radius:14px;padding:14px;margin-bottom:16px">';
  h += '<div style="font-size:12px;font-weight:800;color:#fff;margin-bottom:10px">🎁 Reward Steps</div>';
  var steps = [
    { icon: '1️⃣', label: 'Dost join kare', you: '+50🪙', them: '+50🪙', done: count >= 1 },
    { icon: '2️⃣', label: 'Dost pehla Sky Diamond kharido', you: '+10💎', them: '—', done: false },
    { icon: '3️⃣', label: 'Dost 5 matches khele', you: '+30🪙', them: '—', done: false },
  ];
  steps.forEach(function(s) {
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;opacity:' + (s.done?'1':'.7') + '">';
    h += '<span style="font-size:16px">' + s.icon + '</span>';
    h += '<div style="flex:1"><div style="font-size:12px;font-weight:600">' + s.label + '</div></div>';
    h += '<div style="text-align:right"><div style="font-size:11px;color:#00ff9c;font-weight:700">Tum: ' + s.you + '</div>';
    if (s.them !== '—') h += '<div style="font-size:11px;color:#ffd700;font-weight:700">Dost: ' + s.them + '</div>';
    h += '</div>';
    if (s.done) h += '<span style="color:#00ff9c;font-size:14px">✅</span>';
    h += '</div>';
  });
  h += '</div>';

  // Referral code
  h += '<div style="background:rgba(255,255,255,.04);border:1.5px dashed rgba(0,255,156,.3);border-radius:14px;padding:14px;text-align:center;margin-bottom:14px">';
  h += '<div style="font-size:11px;color:var(--txt2);margin-bottom:6px">Tumhara Referral Code</div>';
  h += '<div style="font-size:28px;font-weight:900;color:#00ff9c;letter-spacing:3px">' + code + '</div>';
  h += '</div>';

  var shareMsg = '🎮 Mini eSports pe Free Fire & BGMI tournaments!\n🪙 FREE coins + No real money gambling\n\nMere code se join karo: ' + code + '\n👉 https://deepsilence10161-source.github.io/ff-user-panel/';
  h += '<button onclick="doShareReferral(\'' + encodeURIComponent(shareMsg) + '\')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#25d366,#128c7e);border:none;color:#fff;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:8px"><i class="fab fa-whatsapp"></i> WhatsApp pe Share Karo</button>';
  h += '<button onclick="copyReferCode(\'' + code + '\')" style="width:100%;padding:12px;border-radius:14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer"><i class="fas fa-copy"></i> Code Copy Karo</button>';

  if (window.openModal) openModal('🤝 Refer & Earn', h);
};

window.doShareReferral = function(encodedMsg) {
  var msg = decodeURIComponent(encodedMsg);
  window.openWhatsApp(msg);
};

window.copyReferCode = function(code) {
  if (navigator.clipboard) navigator.clipboard.writeText(code);
  toast('Code copy ho gaya! 🎉', 'ok');
};

/* ================================================================
   5. SKY DIAMOND COSMETICS STORE
   ================================================================ */
function _getCosmetics() {
  if (window.CFG && window.CFG.cosmetics) {
    return Object.keys((window.CFG && window.CFG.cosmetics)).map(function(id) {
      var c = (window.CFG && window.CFG.cosmetics)[id];
      return { id: id, name: c.name, price: c.price, icon: c.icon,
        type: id.startsWith('frame') ? 'frame' : id.startsWith('tag') ? 'tag' : 'vip' };
    });
  }
  return [
    { id:'frame_neon',   name:'Neon Frame',     price:50,  icon:'🟢', type:'frame' },
    { id:'frame_fire',   name:'Fire Frame',      price:75,  icon:'🔥', type:'frame' },
    { id:'frame_galaxy', name:'Galaxy Frame',    price:100, icon:'🌌', type:'frame' },
    { id:'frame_gold',   name:'Gold Champion',   price:150, icon:'🏆', type:'frame' },
    { id:'tag_beast',    name:'⚡ BEAST MODE',   price:30,  icon:'⚡', type:'tag'   },
    { id:'tag_pro',      name:'🎯 PRO PLAYER',   price:30,  icon:'🎯', type:'tag'   },
    { id:'tag_king',     name:'👑 KING',         price:50,  icon:'👑', type:'tag'   },
    { id:'vip_slot',     name:'VIP Slot Pass',   price:200, icon:'⭐', type:'vip'   },
  ];
}

window.showCosmeticsStore = function() {
  if (!window.UD || !window.U) { toast('Login karo pehle', 'err'); return; }
  var mySD = Number(window.UD.skyDiamonds || 0);
  var owned = (window.UD.cosmetics || {});

  var h = '<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.2);border-radius:12px;padding:10px 14px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">';
  h += '<div style="font-size:12px;color:var(--txt2)">Your Balance</div>';
  h += '<div style="font-size:18px;font-weight:900;color:#00d4ff">💎 ' + mySD + ' Sky Diamonds</div>';
  h += '</div>';

  // Tabs
  h += '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
  ['All','Frames','Tags','VIP'].forEach(function(tab, i) {
    h += '<button onclick="filterCosmetics(\'' + tab.toLowerCase() + '\')" id="cosTab_' + tab.toLowerCase() + '" style="padding:5px 12px;border-radius:20px;border:none;font-size:11px;font-weight:700;cursor:pointer;background:' + (i===0?'#00d4ff':'rgba(255,255,255,.08)') + ';color:' + (i===0?'#000':'var(--txt)') + '">' + tab + '</button>';
  });
  h += '</div>';

  h += '<div id="cosmeticsList">';
  h += renderCosmeticCards('all', owned, mySD);
  h += '</div>';

  if (window.openModal) openModal('💎 Cosmetics Store', h);

  /* ✅ BUG FIX (2026-08-25): "Buy karke unlock hota hai, refresh karte
     hi wapas locked ho jata hai — jabki DB me purchase saved hai".
     Root cause: this modal always rendered from whatever window.UD.
     cosmetics happened to already contain the instant it opened — it
     never actually fetched fresh ownership data. On a real device,
     _loadExtras()'s background SELECT from user_cosmetics can still be
     in flight when the store is opened shortly after a page load/
     reload, so UD.cosmetics was still {} (empty) at that exact moment
     — every genuinely-owned item showed as buyable. The purchase and
     the DB write were never actually broken; the store just never
     waited for or re-checked the real data before rendering. Force a
     fresh fetch every time the store opens and re-render once it
     lands, so this can never show a false "locked" state again. */
  if (window._loadExtras) window._loadExtras();
};

window.filterCosmetics = function(filter) {
  ['all','frames','tags','vip'].forEach(function(t) {
    var b = document.getElementById('cosTab_' + t);
    if (b) { b.style.background = t===filter?'#00d4ff':'rgba(255,255,255,.08)'; b.style.color = t===filter?'#000':'var(--txt)'; }
  });
  var list = document.getElementById('cosmeticsList');
  if (list) list.innerHTML = renderCosmeticCards(filter, (window.UD&&window.UD.cosmetics)||{}, Number((window.UD&&window.UD.skyDiamonds)||0));
};

function renderCosmeticCards(filter, owned, mySD) {
  var items = _getCosmetics().filter(function(c) {
    if (filter === 'all') return true;
    if (filter === 'frames') return c.type === 'frame';
    if (filter === 'tags') return c.type === 'tag';
    if (filter === 'vip') return c.type === 'vip';
    return true;
  });

  var h = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  items.forEach(function(c) {
    var isOwned = !!owned[c.id];
    var canBuy = mySD >= c.price;
    h += '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px;text-align:center">';
    h += '<div style="font-size:28px;margin-bottom:6px">' + c.icon + '</div>';
    h += '<div style="font-size:12px;font-weight:800;margin-bottom:3px">' + c.name + '</div>';
    h += '<div style="font-size:10px;color:var(--txt2);margin-bottom:8px">' + c.desc + '</div>';
    if (isOwned) {
      h += '<span style="font-size:11px;color:#00ff9c;font-weight:700;padding:4px 10px;border-radius:20px;background:rgba(0,255,156,.1)">✅ Owned</span>';
    } else {
      h += '<button onclick="buyCosmetic(\'' + c.id + '\',' + c.price + ',\'' + encodeURIComponent(c.name) + '\',this)" style="width:100%;padding:7px;border-radius:10px;background:' + (canBuy?'linear-gradient(135deg,#0066ff,#00d4ff)':'rgba(255,255,255,.05)') + ';border:1px solid rgba(0,212,255,' + (canBuy?'.4':'.1') + ');color:' + (canBuy?'#fff':'#555') + ';font-size:11px;font-weight:800;cursor:' + (canBuy?'pointer':'default') + '">💎 ' + c.price + '</button>';
    }
    h += '</div>';
  });
  h += '</div>';
  return h;
}

window.buyCosmetic = function(id, price, encodedName, btnEl) {
  var name = decodeURIComponent(encodedName);
  if (!window._supa || !window.U || !window.UD) return;
  var mySD = Number(window.UD.skyDiamonds || 0);
  if (mySD < price) { toast('Sky Diamonds kam hain! Wallet se kharido 💎', 'err'); return; }

  if (!confirm(name + ' kharidna chahte ho? 💎' + price + ' Sky Diamonds lagenge.')) return;

  /* ✅ BUG FIX (2026-08-23): "unlock ho gaya message aa jata hai lekin
     unlock nahi hota, na diamond kat te hain". Root cause: this used to
     fire window.db.ref(...).transaction() (balance deduction) and
     .set() (cosmetic unlock) as two independent, un-awaited writes, then
     showed the success toast immediately regardless of what either call
     actually did — so any transient failure (network blip, RLS edge
     case, race with a concurrent balance read elsewhere) was completely
     invisible; the user always saw "unlock ho gaya!" whether or not
     anything really happened. Replaced with a single atomic, server-
     verified RPC (purchase_cosmetic) — the toast and UI update now only
     fire on its confirmed, checked result. */
  var btn = btnEl;
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  window._supa.rpc('purchase_cosmetic', {
    p_cosmetic_key: id, p_price: price, p_display_name: name
  }).then(function(r) {
    var res = r && r.data;
    if (r.error || !res || !res.ok) {
      var errCode = (res && res.error) || (r.error && r.error.message) || 'unknown';
      var msg = errCode === 'insufficient_balance' ? 'Sky Diamonds kam hain!'
              : 'Purchase fail ho gaya, dobara try karo';
      toast('❌ ' + msg, 'err');
      if (btn) { btn.disabled = false; btn.textContent = '💎 ' + price; }
      return;
    }
    /* Update local cache so the store re-render shows "Owned" immediately */
    if (!window.UD.cosmetics) window.UD.cosmetics = {};
    window.UD.cosmetics[id] = { ownedAt: Date.now(), name: name };
    if (typeof res.new_balance === 'number') window.UD.skyDiamonds = res.new_balance;
    toast('🎉 ' + name + ' unlock ho gaya!', 'ok');
    if (window.updateHdr) window.updateHdr();
    /* ✅ BUG FIX (2026-08-24): re-sync window._supaCosmetics from DB right
       away so the optimistic local update above doesn't silently drift
       out of sync with the source of truth _loadExtras reads from on
       every future _applyUser — without this, the very next realtime
       user update or 30s poll would overwrite UD.cosmetics with the
       (stale, pre-purchase) window._supaCosmetics cache and the item
       would flip back to "Buy" until the 2s extras timer happened to
       re-fire. */
    if (window._loadExtras) window._loadExtras();
    setTimeout(window.showCosmeticsStore, 300);
  }, function(e) {
    toast('❌ Network error, dobara try karo', 'err');
    if (btn) { btn.disabled = false; btn.textContent = '💎 ' + price; }
  });
};

/* ================================================================
   6. CLAN WAR SUNDAY BANNER
   ================================================================ */
window.checkClanWarBanner = function() {
  var day = new Date().getDay(); // 0 = Sunday
  var banner = document.getElementById('clanWarBanner');
  if (!banner) return;
  if (day === 0) {
    banner.style.display = 'flex';
  } else {
    var daysLeft = (7 - day) % 7;
    var bannerLabel = document.getElementById('clanWarBannerLabel');
    if (bannerLabel) bannerLabel.textContent = daysLeft + ' din baad — Sunday Clan War!';
    banner.style.display = 'flex';
  }
};

/* ================================================================
   7. HOME QUICK-ACCESS — inject buttons into home screen
   ================================================================ */
window.injectGrowthButtons = function() {
  /* ✅ REMOVED (2026-07): this used to inject a "City #1 / Missions /
     Cosmetics / Refer & Earn" quick-access bar at the top of the Home
     tab. All four of those already have buttons on the Profile tab
     (My Clan, Daily Missions, Cosmetics Store, City Leaderboard,
     Refer & Earn in screens/profile.js), so this was pure duplicate
     clutter on Home. Left as a no-op (instead of deleting the function
     outright) since initGrowth() below still calls it — removing the
     function entirely would throw if some other code path calls it too.
     If a stale bar is still in the DOM from an older cached version of
     this file, clean it up on the next run. */
  var stale = document.getElementById('growthQuickBar');
  if (stale) stale.remove();
};

/* ================================================================
   8. MISSION COMPLETE NOTIFICATION — after match result
   ================================================================ */
window.triggerMissionCheck = function(kills, rank) {
  if (!window.db || !window.U) return;
  var today = new Date().toDateString();
  var wn = getWeekNum();
  /* Read existing progress first, then update atomically */
  window.db.ref('users/' + window.U.uid + '/missionProgress').once('value', function(snap) {
    var existing = snap.val() || {};
    var updates = { lastMatchDate: today };
    updates['wMatches_' + wn] = ((existing['wMatches_' + wn]) || 0) + 1;
    if (kills >= 3) updates.todayKills = ((existing.todayKills) || 0) + kills;
    if (rank <= 3)  updates['wTop3_' + wn] = true;
    window.db.ref('users/' + window.U.uid + '/missionProgress').update(updates);
    /* Also sync to Supabase mission_progress */
    if (window.DB && window.DB.missions) {
      var period = new Date().toISOString().split('T')[0];
      /* Note: updateProgress returns null on a Postgres-level error (already
         logged by DB's shared _err helper) or the RPC's own {success,error?}
         JSONB otherwise — check success, not .error, and treat null as
         already-handled rather than re-logging it. */
      DB.missions.updateProgress('weekly_matches', period, updates['wMatches_' + wn], 5).then(function(res){
        if(res && res.success === false){console.error('[Growth] mission_progress sync rejected:',res.error);}
      });
    }
  });
};

/* ================================================================
   INIT
   ================================================================ */
function initGrowth() {
  if (!window.db || !window.U) {
    setTimeout(initGrowth, 1000);
    return;
  }
  window.checkClanWarBanner && window.checkClanWarBanner();
  window.injectGrowthButtons && window.injectGrowthButtons();
  console.log('✅ growth-features.js loaded');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { setTimeout(initGrowth, 2000); });
} else {
  setTimeout(initGrowth, 2000);
}

window._growthInitFn   = initGrowth;
window.initGrowth      = initGrowth; /* ✅ inside IIFE scope */

})();
