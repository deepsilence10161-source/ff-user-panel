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
    var q = userCity ? window._supa.from('users').select('id,ign,rank_points,city,avatar_url').eq('city', userCity).order('rank_points', { ascending: false }).limit(50) : window._supa.from('leaderboard').select('*').limit(50);
    q.then(function(r) {
      if (window.renderCityLeaderboard) renderCityLeaderboard(r.data || []);
    }).catch(function(){});
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

    if (!players.length) {
      cont.innerHTML = '<div style="text-align:center;padding:24px"><div style="font-size:32px;margin-bottom:8px">🏙️</div><div style="color:var(--txt2);font-size:13px">' + (tab===0 && city ? 'Abhi ' + city + ' mein koi player nahi — pehle ban jao!' : 'Koi data nahi') + '</div></div>';
      return;
    }

    var html = '';
    if (tab === 0 && city) {
      html += '<div style="text-align:center;margin-bottom:10px;font-size:12px;font-weight:700;color:#ffd700">🏙️ ' + city + ' Leaderboard</div>';
    }
    players.slice(0, 20).forEach(function(p, i) {
      var isMe = p.uid === window.U.uid;
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
    cont.innerHTML = html;
  });
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

  // Coin reward for sharing
  h += '<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.15);border-radius:12px;padding:10px;font-size:12px;color:#ffd700;font-weight:700">🪙 Share karne pe +20 Coins milenge!</div>';
  h += '</div>';

  if (window.openModal) openModal('🏆 Result Share Karo', h);
};

window.doShareResult = function(encodedMsg) {
  var msg = decodeURIComponent(encodedMsg);
  /* BUG FIX (2026-07): switched from https://wa.me/?text=... (a WEB link
     that opens a browser page which then offers to open WhatsApp) to the
     native whatsapp://send?text=... URI scheme. This goes straight to
     the WhatsApp app via Android's ACTION_VIEW intent — no web page, no
     "open in WhatsApp?" prompt. If WhatsApp isn't installed, Android
     throws ActivityNotFoundException, which MainActivity.java's popup/
     main WebView handler already catches and shows as a toast. */
  var url = 'whatsapp://send?text=' + encodeURIComponent(msg);
  window.open(url, '_self');
  giveShareCoins();
};

window.doShareResultGeneric = function(encodedMsg) {
  var msg = decodeURIComponent(encodedMsg);
  if (navigator.share) {
    navigator.share({ title: 'Mini eSports Result', text: msg }).catch(function(){});
  } else {
    // Clipboard copy fallback
    if (navigator.clipboard) navigator.clipboard.writeText(msg);
    toast('Message copy ho gaya — paste karke share karo!', 'ok');
  }
  giveShareCoins();
};

function giveShareCoins() {
  if (!window.db || !window.U) return;
  var today = new Date().toDateString();
  var key = 'users/' + window.U.uid + '/shareRewards/' + today.replace(/ /g,'_');
  window.db.ref(key).once('value', function(s) {
    if (s.val()) { toast('Aaj ke share coins pehle le chuke ho 🪙', 'inf'); return; }
    var _shareCoins = (window.CFG ? window.CFG.shareCoins : 20);
    window.db.ref('users/' + window.U.uid + '/coins').transaction(function(v) { return (v||0) + _shareCoins; });
    if (window._supa && window.U) { window._supa.rpc('increment_balance', { p_uid: window.U.uid, p_col: 'coins', p_amount: _shareCoins }).catch(function(){}); }
    if (window.UD) { window.UD.coins = (window.UD.coins||0) + _shareCoins; if (window.updateHdr) updateHdr(); }
    window.db.ref(key).set(true);
    toast('+20 🪙 Coins mile! Share karte raho!', 'ok');
    if (window.updateHdr) window.updateHdr();
    if (window.closeModal) window.closeModal();
  });
}

/* ================================================================
   3. DAILY + WEEKLY MISSIONS
   ================================================================ */
window.showMissionsPanel = function() {
  if (!window.UD || !window.U) { toast('Login karo pehle', 'err'); return; }
  var stats = window.UD.stats || {};
  var today = new Date().toDateString();
  var weekNum = getWeekNum();

  window.db.ref('users/' + window.U.uid + '/missionProgress').once('value', function(snap) {
    var prog = snap.val() || {};

    var DAILY = [
      { id: 'daily_login',   label: '📅 Login Karo',      desc: 'Aaj login kiya',          reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).daily_login:5),   check: true,                              auto: true },
      { id: 'daily_match',   label: '🎮 1 Match Khelo',   desc: 'Aaj 1 match join karo',   reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).daily_match:10),  check: (prog.lastMatchDate === today) },
      { id: 'daily_kills3',  label: '💀 3 Kills Karo',    desc: 'Aaj 3 kills lo',          reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).daily_kills3:5),   check: (Number(prog.todayKills||0) >= 3) },
      { id: 'daily_checkin', label: '🎁 Check-In Karo',   desc: 'Bonus coins',             reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).daily_checkin:5),   check: (prog.lastCheckIn === today) },
    ];

    var WEEKLY = [
      { id: 'week_5matches', label: '🎯 5 Matches Khelo', desc: 'Is hafte 5 matches',      reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).week_5matches:50),  check: (Number(prog['wMatches_'+weekNum]||0) >= 5), progress: Number(prog['wMatches_'+weekNum]||0), max: 5 },
      { id: 'week_top3',     label: '🏆 Top 3 Finish',   desc: 'Kisi match mein top 3',   reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).week_top3:30),  check: (prog['wTop3_'+weekNum] === true) },
      { id: 'week_share',    label: '📲 Result Share Karo',desc: 'Apna result share karo', reward: (window.CFG&&(window.CFG && window.CFG.missions)?(window.CFG && window.CFG.missions).week_share:20),  check: (prog['wShare_'+weekNum] === true) },
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

    // Auto-claim daily login
    if (!prog['claimed_daily_login_' + today]) {
      claimMission('daily_login', 5, today, 'daily');
    }
  });
};

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

window.claimMission = function(missionId, coins, period, type) {
  if (!window.db || !window.U) return;
  var claimKey = 'claimed_' + missionId + '_' + (type === 'weekly' ? 'w' : '') + period;
  var path = 'users/' + window.U.uid + '/missionProgress/' + claimKey;

  window.db.ref(path).once('value', function(s) {
    if (s.val()) { toast('Pehle se claim ho chuka hai', 'inf'); return; }
    window.db.ref(path).set(true);
    window.db.ref('users/' + window.U.uid + '/coins').transaction(function(v) { return (v||0) + coins; });
    if (window._supa && window.U) { window._supa.rpc('increment_balance', { p_uid: window.U.uid, p_col: 'coins', p_amount: coins }).catch(function(){}); window._supa.from('wallet_transactions').insert({ user_id: window.U.uid, currency: 'coins', txn_type: 'credit', amount: coins, reason: 'mission_reward' }).catch(function(){}); }
    if (window.UD) { window.UD.coins = (window.UD.coins||0) + coins; if (window.updateHdr) updateHdr(); }
    toast('+' + coins + ' 🪙 Coins mile! Mission complete! 🎉', 'ok');
    if (window.updateHdr) window.updateHdr();
    // Re-render
    if (window.showMissionsPanel) setTimeout(window.showMissionsPanel, 300);
  });
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
  /* BUG FIX (2026-07): native whatsapp:// scheme — opens the app directly,
     no web page in between. See doShareResult above for details. */
  window.open('whatsapp://send?text=' + encodeURIComponent(msg), '_self');
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
      h += '<button onclick="buyCosmetic(\'' + c.id + '\',' + c.price + ',\'' + encodeURIComponent(c.name) + '\')" style="width:100%;padding:7px;border-radius:10px;background:' + (canBuy?'linear-gradient(135deg,#0066ff,#00d4ff)':'rgba(255,255,255,.05)') + ';border:1px solid rgba(0,212,255,' + (canBuy?'.4':'.1') + ');color:' + (canBuy?'#fff':'#555') + ';font-size:11px;font-weight:800;cursor:' + (canBuy?'pointer':'default') + '">💎 ' + c.price + '</button>';
    }
    h += '</div>';
  });
  h += '</div>';
  return h;
}

window.buyCosmetic = function(id, price, encodedName) {
  var name = decodeURIComponent(encodedName);
  if (!window.db || !window.U || !window.UD) return;
  var mySD = Number(window.UD.skyDiamonds || 0);
  if (mySD < price) { toast('Sky Diamonds kam hain! Wallet se kharido 💎', 'err'); return; }

  if (!confirm(name + ' kharidna chahte ho? 💎' + price + ' Sky Diamonds lagenge.')) return;

  window.db.ref('users/' + window.U.uid + '/skyDiamonds').transaction(function(v) { return Math.max((v||0) - price, 0); });
  window.db.ref('users/' + window.U.uid + '/cosmetics/' + id).set({ ownedAt: Date.now(), name: name });
  toast('🎉 ' + name + ' unlock ho gaya!', 'ok');
  if (window.updateHdr) window.updateHdr();
  setTimeout(window.showCosmeticsStore, 300);
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
  var home = document.getElementById('scrHome') || document.getElementById('homeScreen');
  if (!home || document.getElementById('growthQuickBar')) return;

  var bar = document.createElement('div');
  bar.id = 'growthQuickBar';
  bar.className = 'scroll-fade-x';
  bar.style.cssText = 'display:flex;gap:8px;padding:0 0 10px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch';
  bar.innerHTML = [
    { icon:'🏙️', label:'City #1',      fn:'showCityLeaderboard()' },
    { icon:'🎯', label:'Missions',     fn:'showMissionsPanel()' },
    { icon:'💎', label:'Cosmetics',    fn:'showCosmeticsStore()' },
    { icon:'🤝', label:'Refer & Earn', fn:'showReferEarn()' },
  ].map(function(b) {
    return '<button onclick="' + b.fn + '" style="flex-shrink:0;padding:8px 14px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--txt);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">' + b.icon + ' ' + b.label + '</button>';
  }).join('');

  home.insertBefore(bar, home.firstChild);
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
      DB.missions.updateProgress('weekly_matches', period, updates['wMatches_' + wn], 5).catch(function(){});
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
