/* ====== LOOT CRATE ANIMATION ====== */
function showLootCrate(prize) {
  /* Remove any existing loot overlay to prevent stacking */
  var existing = document.getElementById('_lootOverlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = '_lootOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.85);backdrop-filter:blur(4px)';
  overlay.innerHTML = '<div id="_lootBox" style="text-align:center;animation:lootDrop .6s cubic-bezier(.175,.885,.32,1.275)">' +
    '<div style="font-size:80px;margin-bottom:8px;filter:drop-shadow(0 0 30px #ffd700)">📦</div>' +
    '<div style="font-size:16px;color:#ffd700;font-weight:800;margin-bottom:4px">PRIZE BOX DROPPED!</div>' +
    '<div id="_lootOpen" style="font-size:48px;cursor:pointer;animation:spin .3s ease" onclick="this.parentElement.parentElement._burst()">🎁</div>' +
    '<div style="font-size:13px;color:var(--txt2);margin-top:8px">Tap to open!</div>' +
  '</div>';
  // Add burst animation
  var style = document.createElement('style');
  style.textContent = '@keyframes lootDrop{from{transform:translateY(-200px) scale(.3);opacity:0}to{transform:none;opacity:1}}@keyframes spin{from{transform:rotate(-20deg)}to{transform:rotate(20deg)}}@keyframes confettiFall{from{transform:translateY(-20px) rotate(0);opacity:1}to{transform:translateY(100vh) rotate(720deg);opacity:0}}';
  document.head.appendChild(style);
  overlay._burst = function() {
    var box = document.getElementById('_lootBox');
    if (box) {
      // Burst with coins
      var coins = ['💰','💵','🪙','💸','⭐','✨'];
      for (var i = 0; i < 20; i++) {
        var c = document.createElement('div');
        c.textContent = coins[Math.floor(Math.random()*coins.length)];
        c.style.cssText = 'position:fixed;font-size:24px;left:'+(Math.random()*100)+'vw;top:30vh;animation:confettiFall '+(1+Math.random())+'s ease forwards;z-index:100000;animation-delay:'+(Math.random()*.5)+'s';
        document.body.appendChild(c);
        setTimeout(function(el){el.remove();}, 2000, c);
      }
      box.innerHTML = '<div style="font-size:60px;margin-bottom:8px;filter:drop-shadow(0 0 40px #00ff6a)">💰</div>' +
        '<div style="font-size:20px;color:#00ff6a;font-weight:900">💎' + (prize||'?') + ' WON!</div>' +
        '<div style="font-size:13px;color:var(--txt2);margin-top:6px">Added to your wallet!</div>' +
        '<button onclick="this.closest(\'[style*=fixed]\').remove()" style="margin-top:16px;padding:10px 24px;background:var(--green);color:#000;border:none;border-radius:20px;font-weight:800;font-size:14px;cursor:pointer">🎉 Awesome!</button>';
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
    }
  };
  document.body.appendChild(overlay);
  // Auto remove after 8s
  setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 8000);
}
function watchAd() {
  if (window.AdManager) {
    window.AdManager.showRewardedAd(
      window.onAdReward,
      function() { toast('Ad load nahi hua, dobara try karo.', 'err'); },
      'watchAd'
    );
  } else if (window.Android && window.Android.showRewardedAd) {
    window.Android.showRewardedAd();
  } else {
    toast('Ads available only in APK version', 'inf');
  }
}
window.onAdReward = function() {
  /* Guard: if ad-match pending, route to match reward handler */
  if (window._adMatchPending) {
    onAdRewardForMatch(window._adMatchPending);
    window._adMatchPending = null;
    return;
  }
  var adCoins = (window.CFG && window.CFG.adCoinsPerWatch) || 5;
  /* ✅ SINGLE Supabase credit only */
  if (window._supa && window.U) {
    window._supa.rpc('increment_balance', { p_uid: window.U.uid, p_col: 'coins', p_amount: adCoins }).then(null, function(){});
    window._supa.from('wallet_transactions').insert({ user_id: window.U.uid, currency: 'coins', txn_type: 'credit', amount: adCoins, reason: 'ad_reward' }).then(null, function(){});
  }
  /* ✅ Single local update (no duplicate) */
  if (window.UD) { window.UD.coins = (window.UD.coins || 0) + adCoins; if (window.updateHdr) window.updateHdr(); }
  if (window.toast) window.toast('+' + adCoins + ' Coins earned! 🪙', 'ok');
};

/* ====== AD-BASED MATCH JOIN SYSTEM ====== */
// Track ad watches per match per session
window._adWatchCount = {};
window._adMatchPending = null;

// Show ad-watch popup before joining an ad-match
function showAdJoinPopup(matchId) {
  var t = MT[matchId]; if (!t) return;
  var adsRequired = Number(t.adsRequired) || 2;
  var watched = window._adWatchCount[matchId] || 0;
  var remaining = adsRequired - watched;

  var h = '<div style="text-align:center;padding:8px 0 4px">';
  h += '<div style="font-size:36px;margin-bottom:6px">📺</div>';
  h += '<div style="font-size:17px;font-weight:800;color:var(--green);margin-bottom:4px">FREE Match — Ads Dekho, Match Khelo!</div>';
  h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:16px">Yeh match bilkul free hai. Sirf <b style="color:#fff">' + adsRequired + ' short ads</b> dekhne ke baad join kar sakte ho.</div>';

  // Progress dots
  h += '<div style="display:flex;justify-content:center;gap:10px;margin-bottom:18px">';
  for (var i = 0; i < adsRequired; i++) {
    var done = i < watched;
    h += '<div style="width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;';
    h += done ? 'background:rgba(0,255,106,.2);border:2px solid #00ff6a;color:#00ff6a' : 'background:rgba(255,255,255,.06);border:2px dashed rgba(255,255,255,.2);color:#555';
    h += '">' + (done ? '✓' : (i + 1)) + '</div>';
  }
  h += '</div>';

  if (remaining > 0) {
    h += '<div style="font-size:12px;color:#aaa;margin-bottom:14px">Abhi <b style="color:#fff">' + remaining + ' ad' + (remaining > 1 ? 's' : '') + '</b> aur dekhni hai</div>';
    h += '<button onclick="watchAdForMatch(\'' + matchId + '\')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;font-size:15px;border:none;cursor:pointer;letter-spacing:.5px">▶ Ad Dekho (' + watched + '/' + adsRequired + ')</button>';
  } else {
    h += '<div style="font-size:13px;color:#00ff9c;font-weight:700;margin-bottom:14px">✅ Sabhi ads dekh li! Ab join kar sakte ho.</div>';
    h += '<button onclick="confirmAdMatchJoin(\'' + matchId + '\')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;font-size:15px;border:none;cursor:pointer">🎮 Match Join Karo!</button>';
  }
  h += '</div>';
  showModal('🎯 ' + (t.name || 'Match'), h);
}

// Simulate/trigger ad watch for match
function watchAdForMatch(matchId) {
  window._adMatchPending = matchId;
  // Use AdManager (handles real AdMob + web fallback)
  if (window.AdManager) {
    window.AdManager.showRewardedAd(
      function() { onAdRewardForMatch(matchId); },
      function() { toast('Ad load nahi hua, dobara try karo.', 'err'); },
      'adMatch_' + matchId
    );
    return;
  }
  // Legacy Android bridge
  if (window.Android && window.Android.showRewardedAd) {
    window.Android.showRewardedAd();
    return;
  }
  // Pure web fallback countdown
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#000;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff';
  overlay.id = 'adOverlay_' + matchId;
  var adBrands = ['🎮 Gaming Pro', '📱 App Store', '🛒 Shop Now', '🏆 Win Big'];
  var brand = adBrands[Math.floor(Math.random() * adBrands.length)];
  var sec = 5;
  overlay.innerHTML = '<div style="font-size:10px;color:#555;position:absolute;top:14px;left:16px;letter-spacing:1px">ADVERTISEMENT</div>' +
    '<div style="font-size:28px;font-weight:900;margin-bottom:12px">' + brand + '</div>' +
    '<div style="font-size:13px;color:#888;margin-bottom:24px">Reward ke liye poori ad dekho</div>' +
    '<div style="width:80px;height:80px;border-radius:50%;background:rgba(0,255,106,.1);border:3px solid #00ff9c;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#00ff9c" id="adTimer">' + sec + '</div>' +
    '<div style="font-size:11px;color:#555;margin-top:12px">Ad band nahi kar sakte</div>';
  document.body.appendChild(overlay);
  var iv = setInterval(function() {
    sec--;
    var el = document.getElementById('adTimer');
    if (el) el.textContent = sec;
    if (sec <= 0) { clearInterval(iv); overlay.remove(); onAdRewardForMatch(matchId); }
  }, 1000);
}

// Called when ad is completed (real or simulated)
function onAdRewardForMatch(matchId) {
  if (!matchId) matchId = window._adMatchPending;
  if (!matchId) return;
  if (!window._adWatchCount[matchId]) window._adWatchCount[matchId] = 0;
  window._adWatchCount[matchId]++;
  var t = MT[matchId];
  var adsRequired = Number(t && t.adsRequired) || 2;
  var watched = window._adWatchCount[matchId];
  toast('Ad ' + watched + '/' + adsRequired + ' complete! 🎉', 'ok');
  // Reopen popup to show updated progress
  setTimeout(function() { showAdJoinPopup(matchId); }, 400);
}

/* onAdReward is fully defined above (handles both ad-match and regular ad rewards) */
/* window._adMatchPending set by watchAdForMatch() before triggering AdMob */

/* ✅ FIX: Ad match join now goes through Supabase join_requests (was Firebase-only, broke My Matches + room reveal) */
function confirmAdMatchJoin(matchId) {
  closeModal();
  var t = MT[matchId]; if (!t) return;
  var tp = (t.mode || t.type || 'solo').toLowerCase();
  if (tp !== 'solo' && tp !== 'duo' && tp !== 'squad') tp = 'solo';

  if (!window._supa || !window.U) { toast('Service unavailable. Try again.', 'err'); return; }

  /* Insert into Supabase join_requests — same table all other joins use */
  window._supa.from('join_requests').insert({
    match_id:       matchId,
    user_id:        window.U.uid,
    entry_type:     'ad',
    entry_fee_paid: 0,
    status:         'joined',
    ign_at_join:    (window.UD && window.UD.ign) || '',
    mode:           tp,
    ad_watched:     true
  }).then(function(r) {
    if (r.error) {
      /* Unique constraint = already joined */
      var msg = (r.error.message || '').toLowerCase();
      if (msg.indexOf('unique') >= 0 || msg.indexOf('duplicate') >= 0) {
        toast('✅ Tum already is match mein ho!', 'inf');
        navTo('matches'); return;
      }
      toast('Join failed: ' + (r.error.message || ''), 'err'); return;
    }
    /* Update slot count atomically via Supabase RPC */
    if (window._supa) {
      /* FINAL FIX (2026-07): removed redundant increment_match_slots call — validate_and_
         join_match already increments filled_slots internally as part of the same atomic
         join transaction above; this separate call was double-counting every join and had
         no caller-identity check (the RPC itself has been dropped). */
    }
    /* Update local MT + JR cache */
    if (window.MT && window.MT[matchId]) {
      window.MT[matchId].joinedSlots = (window.MT[matchId].joinedSlots || 0) + 1;
      window.MT[matchId].filledSlots = window.MT[matchId].joinedSlots;
    }
    if (!window.JR) window.JR = {};
    var _jid = 'ad_' + matchId + '_' + Date.now();
    window.JR[_jid] = { matchId: matchId, userId: window.U.uid, status: 'joined', entryType: 'ad', createdAt: Date.now() };
    window._adWatchCount[matchId] = 0; /* reset ad count */
    toast('🎮 Match Joined! Room ID milne par notification aayega.', 'ok');
    if (window.renderMM) setTimeout(window.renderMM, 400);
    navTo('matches');
  }).catch(function(e) {
    toast('Join failed — retry karo', 'err');
    console.error('[AdJoin]', e);
  });
}

/* ====== RANK ====== */
function calcRkScore(stats) {
  var wins=Number(stats.wins||0), kills=Number(stats.kills||0),
      matches=Number(stats.matches||0), streak=Number(stats.winStreak||0);
  return wins*40 + kills*2 + matches*1 + streak*10;
}
function calcRk(stats) {
  var s = calcRkScore(stats);
  if (s >= 5000) return { badge: 'Grandmaster', emoji: '🌟', color: '#ff4500', bg: 'rgba(255,69,0,.15)',     pts: s };
  if (s >= 3500) return { badge: 'Heroic',      emoji: '⚔️',  color: '#ff1493', bg: 'rgba(255,20,147,.12)',  pts: s };
  if (s >= 2000) return { badge: 'Legend',      emoji: '👑', color: '#b964ff', bg: 'rgba(185,100,255,.15)', pts: s };
  if (s >= 1501) return { badge: 'Diamond',     emoji: '💎', color: '#00d4ff', bg: 'rgba(0,212,255,.15)',   pts: s };
  if (s >= 1001) return { badge: 'Platinum',    emoji: '🔷', color: '#e0e0ff', bg: 'rgba(180,180,255,.13)', pts: s };
  if (s >= 601)  return { badge: 'Gold',        emoji: '🥇', color: '#ffd700', bg: 'rgba(255,215,0,.14)',   pts: s };
  if (s >= 301)  return { badge: 'Silver',      emoji: '🥈', color: '#c0c0c0', bg: 'rgba(192,192,192,.13)', pts: s };
  return           { badge: 'Bronze',       emoji: '🏅', color: '#cd7f32', bg: 'rgba(205,127,50,.13)',  pts: s };
}
function getPlayerBadges(st, lv) {
  var badges = [];
  var w = st.wins||0, k = st.kills||0, m = st.matches||0, streak = st.winStreak||0;
  var rk = calcRk(st);
  // Each badge: icon, name, desc, color, bg, glow, anim
  if (m >= 1)    badges.push({ icon:'🎮', name:'First Match',   desc:'First match played',    color:'#00ff6a', bg:'rgba(0,255,106,.12)',   glow:'0 0 12px rgba(0,255,106,.5)',   anim:'' });
  if (m >= 10)   badges.push({ icon:'⚔️',  name:'Veteran',      desc:'10+ matches',           color:'#00d4ff', bg:'rgba(0,212,255,.12)',   glow:'0 0 12px rgba(0,212,255,.5)',   anim:'' });
  if (m >= 50)   badges.push({ icon:'🎯', name:'Sharpshooter', desc:'50+ matches played',    color:'#ff9f1c', bg:'rgba(255,159,28,.12)',  glow:'0 0 12px rgba(255,159,28,.5)',  anim:'' });
  if (w >= 1)    badges.push({ icon:'🏆', name:'Champion',     desc:'First win!',            color:'#ffd700', bg:'rgba(255,215,0,.14)',   glow:'0 0 14px rgba(255,215,0,.6)',   anim:'badge-pulse' });
  if (w >= 5)    badges.push({ icon:'👑', name:'Dominator',    desc:'5+ wins',               color:'#b964ff', bg:'rgba(185,100,255,.14)', glow:'0 0 14px rgba(185,100,255,.6)', anim:'badge-pulse' });
  if (w >= 20)   badges.push({ icon:'⚡', name:'Unstoppable',  desc:'20+ wins',              color:'#ff4500', bg:'rgba(255,69,0,.14)',    glow:'0 0 14px rgba(255,69,0,.6)',    anim:'badge-glow' });
  if (k >= 10)   badges.push({ icon:'🔪', name:'Blade',        desc:'10+ kills',             color:'#ff6b6b', bg:'rgba(255,107,107,.12)', glow:'0 0 10px rgba(255,107,107,.4)', anim:'' });
  if (k >= 50)   badges.push({ icon:'💀', name:'Kill Machine', desc:'50+ kills',             color:'#ff2e2e', bg:'rgba(255,46,46,.14)',   glow:'0 0 14px rgba(255,46,46,.6)',   anim:'badge-pulse' });
  if (k >= 100)  badges.push({ icon:'☠️',  name:'Headhunter',  desc:'100+ kills',            color:'#ff0000', bg:'rgba(255,0,0,.15)',     glow:'0 0 16px rgba(255,0,0,.7)',     anim:'badge-glow' });
  if (streak>=3) badges.push({ icon:'🔥', name:'On Fire',      desc:'3+ win streak',         color:'#ff8c00', bg:'rgba(255,140,0,.14)',   glow:'0 0 14px rgba(255,140,0,.6)',   anim:'badge-fire' });
  if (streak>=5) badges.push({ icon:'🌋', name:'Volcano',      desc:'5+ win streak',         color:'#ff4500', bg:'rgba(255,69,0,.15)',    glow:'0 0 16px rgba(255,69,0,.7)',    anim:'badge-fire' });
  if (lv >= 10)  badges.push({ icon:'💫', name:'Pro Player',   desc:'Level 10',              color:'#00ff9c', bg:'rgba(0,255,156,.12)',   glow:'0 0 12px rgba(0,255,156,.5)',   anim:'' });
  if (lv >= 20)  badges.push({ icon:'🌟', name:'Elite',        desc:'Level 20',              color:'#ffd700', bg:'rgba(255,215,0,.14)',   glow:'0 0 14px rgba(255,215,0,.6)',   anim:'badge-pulse' });
  // Top 3 special badges set by admin
  if (st._top1)  badges.push({ icon:'👑', name:'#1 Champion',  desc:'Season #1',             color:'#ffd700', bg:'rgba(255,215,0,.2)',    glow:'0 0 20px rgba(255,215,0,.8)',   anim:'badge-glow' });
  if (st._top2)  badges.push({ icon:'🥈', name:'#2 Runner',    desc:'Season #2',             color:'#c0c0c0', bg:'rgba(192,192,192,.18)', glow:'0 0 16px rgba(200,200,200,.7)', anim:'badge-pulse' });
  if (st._top3)  badges.push({ icon:'🥉', name:'#3 Bronze',    desc:'Season #3',             color:'#cd7f32', bg:'rgba(205,127,50,.18)',  glow:'0 0 14px rgba(205,127,50,.6)',  anim:'' });
  return badges;
}
var _rankTab = 'kills'; // kills | wins | rankpoints

function renderRank(tab) {
  if (tab) _rankTab = tab;
  var rc = $('rankContent'); if (!rc) return;

  // Season info banner
  var season = window.getCurrentSeason ? window.getCurrentSeason() : { name: 'Season', daysLeft: 0, label: '' };

  /* How Rank Works + formula banner */
  var _tiers = [
    {b:'Bronze',e:'🏅',pts:'0'},    {b:'Silver',e:'🥈',pts:'301'},  {b:'Gold',e:'🥇',pts:'601'},
    {b:'Platinum',e:'🔷',pts:'1001'},{b:'Diamond',e:'💎',pts:'1501'},{b:'Legend',e:'👑',pts:'2000'},
    {b:'Heroic',e:'⚔️',pts:'3500'},  {b:'Grandmaster',e:'🌟',pts:'5000'}
  ];
  var tierHtml = _tiers.map(function(t){
    return '<div style="text-align:center;flex:1;min-width:36px"><div style="font-size:16px">'+t.e+'</div><div style="font-size:8px;color:#888;margin-top:1px">'+t.pts+'</div></div>';
  }).join('');
  var rankHeader = '<div class="rank-formula-banner" onclick="window.showHowRankWorks&&showHowRankWorks()">' +
    '<div style="font-size:10px;color:#888;margin-bottom:6px">📊 Rank = Wins×40 + Kills×2 + Matches×1 + Streak×10</div>' +
    '<div style="display:flex;gap:2px;align-items:center">' + tierHtml + '</div>' +
    '<div style="font-size:9px;color:#555;margin-top:4px;text-align:right">→ Tap for details</div>' +
    '</div>';

  var tabBar = rankHeader + '<div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px">' +
    ['kills','wins','rankpoints'].map(function(t) {
      var labels = { kills: '☠️ Kills', wins: '🏆 Wins', rankpoints: '💎 Rank Points' };
      var active = t === _rankTab;
      return '<div onclick="renderRank(\'' + t + '\')" style="flex:1;padding:9px 6px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;transition:all .2s;white-space:nowrap;text-align:center;' +
        (active ? 'background:linear-gradient(135deg,rgba(0,255,156,.18),rgba(0,212,255,.1));color:#00ff9c;border:1.5px solid rgba(0,255,156,.35);box-shadow:0 0 12px rgba(0,255,156,.2)' :
                  'background:rgba(255,255,255,.04);color:#666;border:1px solid rgba(255,255,255,.07)') +
        '">' + labels[t] + '</div>';
    }).join('') +
    '</div>';

  var seasonBanner = '<div style="display:flex;justify-content:space-between;align-items:center;' +
    'background:linear-gradient(135deg,rgba(185,100,255,.09),rgba(0,212,255,.06));' +
    'border:1px solid rgba(185,100,255,.2);border-radius:14px;padding:12px 16px;margin-bottom:12px;cursor:pointer" onclick="window.showHowRankWorks&&showHowRankWorks()">' +
    '<div><div style="font-size:13px;font-weight:900;color:#b964ff">' + season.name + '</div>' +
    '<div style="font-size:10px;color:#666;margin-top:1px">' + season.label + ' · Resets monthly</div></div>' +
    '<div style="text-align:right">' +
    '<div style="font-size:16px;font-weight:900;color:#00d4ff">' + season.daysLeft + '</div>' +
    '<div style="font-size:10px;color:#666">days left</div></div>' +
    '</div>';

  rc.innerHTML = tabBar + seasonBanner + '<div style="text-align:center;padding:30px"><div class="sp-spinner"></div></div>';

  if (!window._supa) { _renderRankList(rc, [], _rankTab, tabBar, seasonBanner, false); return; }
  window._supa.from('leaderboard').select('*').limit(300)
    .then(function(r) {
      var users = (r.data || []).map(function(u) {
        return { _uid: u.id, ign: u.ign||'Player', profileImage: u.avatar_url||'', rankPoints: u.rank_points||0, winStreak: 0, stats: { matches: u.total_matches||0, wins: u.total_wins||0, kills: u.total_kills||0 } };
      });
      var sortKey = _rankTab;
      users.sort(function(a, b) {
        var getVal = function(u) {
          var st = u.stats || {};
          if (_rankTab === 'kills') return Number(st.kills || 0);
          if (_rankTab === 'wins')  return Number(st.wins  || 0);
          return (Number(st.wins||0)*40) + (Number(st.kills||0)*2) + (Number(st.matches||0));
        };
        return getVal(b) - getVal(a);
      });
        _renderRankList(rc, users, sortKey, tabBar, seasonBanner, false);
    }).catch(function() { _renderRankList(rc, [], _rankTab, tabBar, seasonBanner, false); });
}

function _rankVal(u, sortKey) {
  var st = u.stats || {};
  if (sortKey === 'kills') return Number(st.kills || 0);
  if (sortKey === 'wins')  return Number(st.wins  || 0);
  return Number(st.wins||0)*40 + Number(st.kills||0)*2 + Number(st.matches||0) + Number(st.winStreak||u.winStreak||0)*10;
}
function _rankValStr(val, sortKey) {
  if (sortKey === 'kills') return val + ' kills';
  if (sortKey === 'wins')  return val + ' wins';
  return '🏆 ' + val + ' pts';
}
function _renderRankList(rc, users, sortKey, tabBar, seasonBanner, isSeason) {
  var h = tabBar + seasonBanner;
  var podCount = Math.min(users.length, 3);
  if (podCount >= 1) {
    var podOrder = podCount === 1 ? [users[0]] : podCount === 2 ? [users[1], users[0]] : [users[1], users[0], users[2]];
    var podClasses = podCount === 1 ? ['p1'] : podCount === 2 ? ['p2','p1'] : ['p2','p1','p3'];
    var podMedals  = podCount === 1 ? ['👑'] : podCount === 2 ? ['🥈','👑'] : ['🥈','👑','🥉'];
    var podNums    = podCount === 1 ? ['1']  : podCount === 2 ? ['2','1']   : ['2','1','3'];
    var podColors  = ['#c0c0c0','#ffd700','#cd7f32'];
    var podGlows   = ['rgba(192,192,192,.6)','rgba(255,215,0,.8)','rgba(205,127,50,.6)'];
    /* Animated podium background */
    h += '<div class="rank-podium-wrap">';
    h += '<div class="rank-podium">';
    for (var i = 0; i < podCount; i++) {
      var u = podOrder[i];
      var posIdx = ['p2','p1','p3'].indexOf(podClasses[i]); // 0=silver,1=gold,2=bronze
      var col = podColors[posIdx] || '#ffd700';
      var glow = podGlows[posIdx] || 'rgba(255,215,0,.8)';
      var av = u.profileImage ? '<img src="' + u.profileImage + '">' : (u.ign || u.displayName || '?').charAt(0).toUpperCase();
      var val = _rankVal(u, sortKey);
      var valLabel = _rankValStr(val, sortKey);
      var rkBadge = calcRk(u.stats || {});
      h += '<div class="pod-item ' + podClasses[i] + '">';
      if (podClasses[i] === 'p1') h += '<div class="pod-crown" style="animation:podCrown 1.5s ease-in-out infinite">👑</div>';
      h += '<div class="pod-ava" style="border-color:' + col + ';box-shadow:0 0 20px ' + glow + ',0 0 40px ' + glow.replace('.6',',.25').replace('.8',',.3') + '">' + av + '</div>';
      h += '<div class="pod-medal">' + podMedals[i] + '</div>';
      h += '<div class="pod-name">' + (window.escHtml?window.escHtml(u.ign||u.displayName||'Player'):(u.ign||u.displayName||'Player')) + '</div>';
      h += '<div class="pod-earn" style="color:' + col + ';font-weight:900">' + valLabel + '</div>';
      /* Rank badge under score */
      h += '<div style="font-size:10px;padding:2px 7px;border-radius:10px;background:' + rkBadge.bg + ';color:' + rkBadge.color + ';border:1px solid ' + rkBadge.color + '44;margin:2px 0 4px">' + rkBadge.emoji + ' ' + rkBadge.badge + '</div>';
      h += '<div class="pod-pedestal">' + podNums[i] + '</div></div>';
    }
    h += '</div>';
    h += '</div>'; /* rank-podium-wrap */
  }
  for (var j = 3; j < users.length; j++) {
    var u = users[j];
    var rk = calcRk(u.stats || {});
    var av = u.profileImage ? '<img src="' + u.profileImage + '">' : (u.ign || u.displayName || '?').charAt(0).toUpperCase();
    var _stR = u.stats || {};
    var val;
    if (sortKey === 'kills') {
      val = Number(_stR.kills || 0);
    } else if (sortKey === 'wins') {
      val = Number(_stR.wins || 0);
    } else {
      var _wR = Number(_stR.wins||0), _kR = Number(_stR.kills||0),
          _mR = Number(_stR.matches||0), _skR = Number(_stR.winStreak||u.winStreak||0);
      val = _wR*40 + _kR*2 + _mR + _skR*10;
    }
    var valStr = sortKey === 'kills' ? val + ' kills' : sortKey === 'wins' ? val + ' wins' : '🏆 ' + val + ' pts';
    var isMe = window.U && (u._uid === window.U.uid);
    var _top10title = j < 7 ? ['','🔱 Warlord','⚔️ Slayer','💫 Elite','🎯 Sniper','🔥 Blaze','🌟 Star','🎖️ Knight'][j+1] || '' : '';
    h += '<div class="rank-row' + (isMe ? '" style="border:1px solid rgba(0,255,156,.3);background:rgba(0,255,156,.05)' : '') + '">';
    h += '<div class="rank-num" style="color:' + (j===3?'#ffd700':j===4?'#c0c0c0':j===5?'#cd7f32':'var(--txt2)') + ';font-weight:' + (j<6?'900':'700') + '">#' + (j + 1) + '</div>';
    h += '<div class="rank-ava">' + av + '</div>';
    h += '<div class="rank-info"><div class="rn">' + (window.escHtml?window.escHtml(u.ign||u.displayName||'Player'):(u.ign||u.displayName||'Player')) + (isMe ? ' <span style="font-size:9px;color:var(--green)">YOU</span>' : '');
    if (_top10title) h += ' <span style="font-size:9px;padding:1px 6px;border-radius:8px;background:rgba(255,215,0,.12);color:#ffd700;font-weight:800">' + _top10title + '</span>';
    h += '</div>';
    var _st = u.stats || {};
    var _m = Number(_st.matches||0), _w = Number(_st.wins||0), _k = Number(_st.kills||0);
    var _wr = _m > 0 ? Math.round((_w/_m)*100) : 0;
    var _kd = _m > 0 ? (_k/_m).toFixed(1) : '0.0';
    h += '<div class="rs">K:' + _k + ' · W:' + _w + ' · <span style="color:#00ff9c">WR:' + _wr + '%</span> · <span style="color:#ff9f1c">K/M:' + _kd + '</span></div></div>';
    h += '<span class="rank-badge" style="background:' + rk.bg + ';color:' + rk.color + ';box-shadow:0 0 8px ' + rk.color + '44">' + rk.emoji + ' ' + rk.badge + '</span>';
    h += '<div class="rank-earn" style="color:' + (sortKey==='kills'?'#ff6b6b':sortKey==='wins'?'#ffd700':'#00d4ff') + '">' + valStr + '</div></div>';
  }
  if (!users.length) h += '<div class="empty-state"><i class="fas fa-trophy"></i><p>No ranked players yet</p></div>';
  rc.innerHTML = h;

  // Inject chat below leaderboard
  if (window.f22PlayerChat !== undefined) {
    setTimeout(function() {
      if (window.injectLobbyChat) window.injectLobbyChat = window.injectLobbyChat;
      var lobbyChatWrap = document.getElementById('lobbyChatWrap');
      if (!lobbyChatWrap && rc) {
        var div = document.createElement('div');
        div.id = 'lobbyChatWrap';
        div.style.cssText = 'margin-top:16px';
        rc.appendChild(div);
      }
    }, 100);
  }
}

/* ====== PROFILE ====== */


/* ====== MATCH RESULT DETAIL (from match-result-detail.js) ====== */
/* ====================================================================
   MATCH RESULT — FULL SCREEN PAGE  (screenshots jaisa)
   - Modal nahi — dedicated fullscreen slide-in screen
   - Screenshot 3 jaisa: Player card with rank, kills, winnings
   - Share Card button
   - Back button se wapas My Matches
   ==================================================================== */
(function () {
  'use strict';

  /* ── Helper: rank medal ── */
  function rankMedal(r) {
    r = Number(r);
    if (r === 1) return '🥇';
    if (r === 2) return '🥈';
    if (r === 3) return '🥉';
    return '#' + (r || '?');
  }

  /* ── Show fullscreen result page ── */
  window.showResultPage = function (matchId) {
    var t = window.MT && window.MT[matchId];
    var db = window.db; var U = window.U; var UD = window.UD;
    if (!db || !U) return;

    /* Remove existing */
    var old = document.getElementById('_resultPage');
    if (old) old.remove();

    /* Create overlay */
    var page = document.createElement('div');
    page.id = '_resultPage';
    page.style.cssText = [
      'position:fixed;inset:0;z-index:99970;',
      'background:#050507;overflow-y:auto;',
      'animation:resultPageIn .3s ease'
    ].join('');

    page.innerHTML = '<div style="text-align:center;padding:80px 20px;color:#555;font-size:14px"><i class="fas fa-spinner fa-spin"></i> Loading result...</div>';

    if (!document.getElementById('_resultPageStyle')) {
      var st = document.createElement('style');
      st.id = '_resultPageStyle';
      st.textContent = '@keyframes resultPageIn{from{transform:translateX(100%)}to{transform:translateX(0)}}';
      document.head.appendChild(st);
    }

    document.body.appendChild(page);
    history.pushState(null, null, null);

    /* Back button closes page */
    window.addEventListener('popstate', function _popH() {
      window.removeEventListener('popstate', _popH);
      var p = document.getElementById('_resultPage');
      if (p) p.remove();
    });

    /* Fetch result from Supabase */
    if (window._supa) {
      window._supa.from('join_requests').select('*').eq('match_id', matchId).eq('user_id', U.uid).single()
        .then(function(resp) {
          if (resp.data && resp.data.placement) {
            renderResultPage(page, { rank: resp.data.placement, kills: resp.data.kills||0, winnings: resp.data.prize_earned||0, userId: U.uid, matchId: matchId }, t, matchId);
          } else { page.innerHTML = _noResultHTML(); }
        }).catch(function() { page.innerHTML = _noResultHTML(); });
    } else { page.innerHTML = _noResultHTML(); }
  };

  /* Keep backward compat */
  window.showResultDetail = window.showResultPage;

  /* ── Render full page HTML ── */
  function renderResultPage(page, r, t, matchId) {
    var UD = window.UD || {};
    var totalWin = Number(r.totalWinning) || (Number(r.winnings || 0) + Number(r.killPrize || 0));
    var rank     = Number(r.rank) || 0;
    var kills    = Number(r.kills) || 0;
    var matchName = (t && t.name) || r.matchName || 'Match';
    var mode      = ((t && (t.mode || t.type)) || r.mode || 'solo').toLowerCase();
    var isTeam    = (mode === 'duo' || mode === 'squad');
    var won       = rank === 1;
    var playerName = UD.ign || UD.displayName || 'Player';
    var ffUid      = UD.ffUid || UD.uid || '';
    var tier       = _getTier(UD.stats || {});

    /* Rank card colors */
    var rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#00d4ff';

    var h = '';

    /* ── Top bar ── */
    h += '<div style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:rgba(255,255,255,.03);border-bottom:1px solid rgba(255,255,255,.06)">';
    h += '<button onclick="history.back()" style="background:rgba(255,255,255,.07);border:none;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center"><i class="fas fa-arrow-left"></i></button>';
    h += '<div style="flex:1;font-size:15px;font-weight:800;color:#fff">Match Result</div>';
    h += '</div>';

    /* ── Hero card — screenshot 3 jaisa ── */
    h += '<div style="margin:16px;border-radius:20px;overflow:hidden;position:relative">';

    /* Background image overlay */
    h += '<div style="background:linear-gradient(180deg,#0d0d2e 0%,#1a0a2e 50%,#0a1a1a 100%);padding:24px 20px 20px;position:relative">';

    /* Glow effects */
    h += '<div style="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 0%,rgba(185,100,255,.2) 0%,transparent 60%),radial-gradient(ellipse at 50% 100%,rgba(0,212,255,.15) 0%,transparent 60%);pointer-events:none"></div>';

    /* Border frame */
    h += '<div style="position:absolute;inset:0;border:2px solid rgba(185,100,255,.3);border-radius:20px;pointer-events:none"></div>';

    /* Avatar */
    h += '<div style="text-align:center;margin-bottom:14px;position:relative;z-index:1">';
    var avatarSrc = UD.profileImage || UD.photoURL || '';
    if (avatarSrc) {
      h += '<img src="' + avatarSrc + '" style="width:72px;height:72px;border-radius:50%;border:3px solid ' + rankColor + ';object-fit:cover;box-shadow:0 0 20px ' + rankColor + '55">';
    } else {
      var initLetter = (playerName.charAt(0) || 'P').toUpperCase();
      h += '<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,#00d4ff,#b964ff);border:3px solid ' + rankColor + ';display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;margin:0 auto;box-shadow:0 0 20px ' + rankColor + '55">' + initLetter + '</div>';
    }
    h += '</div>';

    /* Player name + title */
    h += '<div style="text-align:center;margin-bottom:6px;position:relative;z-index:1">';
    h += '<div style="font-size:22px;font-weight:900;color:#fff">' + playerName + '</div>';
    h += '<div style="font-size:12px;color:#888;margin-top:2px">FE UID: ' + ffUid + '</div>';
    h += '</div>';

    /* Tier badge */
    h += '<div style="text-align:center;margin-bottom:16px;position:relative;z-index:1">';
    h += '<span style="display:inline-block;padding:4px 16px;border-radius:20px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.15);font-size:12px;font-weight:700;color:#ffd700">' + tier + '</span>';
    h += '</div>';

    /* Stats row */
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;position:relative;z-index:1">';
    /* Matches */
    h += '<div style="background:rgba(0,100,200,.25);border:1px solid rgba(0,150,255,.3);border-radius:12px;padding:12px 8px;text-align:center">';
    h += '<div style="font-size:22px;font-weight:900;color:#fff">' + ((UD.stats && UD.stats.matches) || 0) + '</div>';
    h += '<div style="font-size:10px;color:#888;margin-top:3px">Matches</div>';
    h += '</div>';
    /* Wins */
    h += '<div style="background:rgba(0,180,80,.2);border:1px solid rgba(0,220,100,.3);border-radius:12px;padding:12px 8px;text-align:center">';
    h += '<div style="font-size:22px;font-weight:900;color:#00ff9c">' + rank + '</div>';
    h += '<div style="font-size:10px;color:#888;margin-top:3px">Rank</div>';
    h += '</div>';
    /* Kills */
    h += '<div style="background:rgba(200,0,60,.2);border:1px solid rgba(255,60,60,.3);border-radius:12px;padding:12px 8px;text-align:center">';
    h += '<div style="font-size:22px;font-weight:900;color:#ff6b6b">' + kills + '</div>';
    h += '<div style="font-size:10px;color:#888;margin-top:3px">Kills</div>';
    h += '</div>';
    h += '</div>';

    /* Win rate */
    var wr = 0;
    if (UD.stats && UD.stats.matches > 0) wr = Math.round((UD.stats.wins / UD.stats.matches) * 100);
    h += '<div style="text-align:center;font-size:13px;font-weight:700;color:#888;margin-bottom:8px;position:relative;z-index:1">';
    h += 'Win Rate: <span style="color:' + (wr >= 30 ? '#00ff9c' : '#ffd700') + '">' + wr + '%</span>';
    h += '</div>';

    /* Prize earned */
    if (totalWin > 0) {
      h += '<div style="background:linear-gradient(135deg,rgba(0,255,156,.12),rgba(0,212,255,.06));border:1px solid rgba(0,255,156,.25);border-radius:14px;padding:12px;text-align:center;margin-bottom:12px;position:relative;z-index:1">';
      h += '<div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Prize Won</div>';
      h += '<div style="font-size:28px;font-weight:900;background:linear-gradient(135deg,#00ff9c,#00d4ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent">💎 ' + totalWin + '</div>';
      h += '</div>';
    }

    /* Match info */
    h += '<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:10px 14px;position:relative;z-index:1;margin-bottom:4px">';
    h += '<div style="font-size:12px;color:#888;margin-bottom:4px">' + matchName + '</div>';
    h += '<div style="display:flex;gap:12px;flex-wrap:wrap">';
    h += '<span style="font-size:11px;color:#ccc">🏆 Rank: <b style="color:' + rankColor + '">' + rankMedal(rank) + '</b></span>';
    h += '<span style="font-size:11px;color:#ccc">💀 Kills: <b style="color:#ff6b6b">' + kills + '</b></span>';
    if (r.killPrize > 0) h += '<span style="font-size:11px;color:#ccc">🔫 Kill Prize: <b style="color:#ffd700">💎' + r.killPrize + '</b></span>';
    h += '</div>';
    h += '</div>';

    h += '</div>'; /* bg */
    h += '</div>'; /* card */

    /* ── Share Card button ── */
    h += '<div style="padding:0 16px 16px;display:flex;flex-direction:column;gap:10px">';
    h += '<button onclick="window._shareResultCard&&window._shareResultCard(\'' + matchId + '\')" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00d4ff);border:none;color:#000;font-weight:900;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="fas fa-share-alt"></i> Share Card</button>';
    h += '</div>';

    page.innerHTML = h;
  }

  /* ── Share result card ── */
  window._shareResultCard = function (matchId) {
    var r = window._lastResultData;
    var t = window.MT && window.MT[matchId];
    var UD = window.UD || {};
    if (!r) { if (window.toast) window.toast('Result data nahi mila', 'err'); return; }

    var text = '🎮 Mini eSports — Match Result!\n\n' +
      '🏆 ' + (t ? t.name : 'Match') + '\n' +
      '📊 Rank: ' + rankMedal(r.rank) + '\n' +
      '💀 Kills: ' + (r.kills || 0) + '\n' +
      (r.totalWinning > 0 ? '💰 Won: 💎' + r.totalWinning + '\n' : '') +
      '\n🔥 Play on Mini eSports and win real cash!\n' + window.location.origin;

    if (navigator.share) {
      navigator.share({ title: 'My Match Result', text: text }).catch(function () {
        if (window.copyTxt) window.copyTxt(text);
        if (window.toast) window.toast('Result copied!', 'ok');
      });
    } else {
      if (window.copyTxt) window.copyTxt(text);
      if (window.toast) window.toast('Result copied!', 'ok');
    }
  };

  function _getTier(stats) {
    var m  = Number(stats.matches) || 0;
    var w  = Number(stats.wins)    || 0;
    var wr = m > 0 ? (w / m) * 100 : 0;
    if (m >= 100 && wr >= 50) return '👑 Legend';
    if (m >= 50  && wr >= 35) return '🥇 Gold';
    if (m >= 20  && wr >= 20) return '🥈 Silver';
    if (m >= 5)               return '🥉 Bronze';
    return '🎮 Rookie';
  }

  function _noResultHTML() {
    return '<div style="text-align:center;padding:60px 20px">' +
      '<div style="font-size:48px;margin-bottom:16px">⏳</div>' +
      '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:8px">Result abhi publish nahi hua</div>' +
      '<div style="font-size:13px;color:#888">Admin result publish karne ke baad yahan dikhega</div>' +
      '<button onclick="history.back()" style="margin-top:20px;padding:12px 28px;border-radius:12px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);color:#00ff9c;font-weight:700;cursor:pointer">← Wapas Jao</button>' +
      '</div>';
  }

  console.log('[Mini eSports] ✅ Match Result Page loaded — fullscreen, no modal');
})();


/* ====== RANK SEASON SYSTEM (from rank-system.js) ====== */
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



/* ── Weekly leaderboard (Monday reset) ── */
function getWeekKey() {
  var now = new Date();
  var day = now.getDay(); // 0=Sun, 1=Mon
  var monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return monday.getFullYear() + '_W' + String(monday.getMonth()+1).padStart(2,'0') + String(monday.getDate()).padStart(2,'0');
}
window.getWeekKey = getWeekKey;

/* ── Load season leaderboard from Firebase ── */
window.loadSeasonLeaderboard = function(cb) {
  var s = window.getCurrentSeason ? window.getCurrentSeason() : {};
  if (!window._supa) { cb([], s); return; }
  /* Load from Supabase leaderboard view */
  window._supa.from('leaderboard').select('*').limit(200)
    .then(function(r) {
      var users = (r.data || []).map(function(u) {
        return { _uid: u.id, ign: u.ign || 'Player', kills: u.total_kills || 0, wins: u.total_wins || 0, matches: u.total_matches || 0, profileImage: u.avatar_url || '', rankPoints: u.rank_points || 0, stats: { kills: u.total_kills || 0, wins: u.total_wins || 0, matches: u.total_matches || 0 } };
      });
      users.sort(function(a,b) { return (window.calcRkScore ? window.calcRkScore(b.stats||{}) - window.calcRkScore(a.stats||{}) : b.rankPoints - a.rankPoints); });
      cb(users, s);
    }).catch(function() { cb([], s); });
};

/* ── After match result: update season & weekly stats ── */
window.updateSeasonStats = function(uid, statsUpdate) {
  if (!uid || !statsUpdate) return;
  var wins   = statsUpdate.wins    || 0;
  var kills  = statsUpdate.kills   || 0;
  var matches= statsUpdate.matches || 0;

  /* Supabase stats update */
  if (window._supa) {
    if (wins    > 0) window._supa.rpc('increment_balance', { p_uid: uid, p_col: 'total_wins',    p_amount: wins    }).then(null, function(){});
    if (kills   > 0) window._supa.rpc('increment_balance', { p_uid: uid, p_col: 'total_kills',   p_amount: kills   }).then(null, function(){});
    if (matches > 0) window._supa.rpc('increment_balance', { p_uid: uid, p_col: 'total_matches', p_amount: matches }).then(null, function(){});

    var pts = window.calcRkScore ? window.calcRkScore(statsUpdate) : 0;
    if (pts > 0) {
      /* Get old rank_points for mentor reward check (Bug #13) */
      var oldRp = (window.UD && uid === (window.U && window.U.uid))
                  ? (Number(window.UD.rank_points || window.UD.rankPoints) || 0)
                  : 0;
      window._supa.rpc('increment_rank_points', { p_uid: uid, p_points: pts })
        .then(function() {
          /* Bug #13 Fix: Call mentor reward when rank tier changes */
          if (window.checkMentorReward && oldRp > 0) {
            window.checkMentorReward(oldRp, oldRp + pts);
          }
          /* Update local UD cache */
          if (window.UD && uid === (window.U && window.U.uid)) {
            window.UD.rank_points = oldRp + pts;
            window.UD.rankPoints  = oldRp + pts;
          }
        }).catch(function(){});
    }

    /* Bug #10 Fix: City Championship score update */
    if ((wins > 0 || kills > 0) && window.updateCityChampScore) {
      window.updateCityChampScore(wins > 0, kills);
    }

    /* Bug #11 Fix: Clan War score update */
    if ((wins > 0 || kills > 0) && window.updateClanWarScore) {
      /* Only update if user has a clan */
      var userClanId = window.UD && window.UD.clanId;
      if (userClanId) window.updateClanWarScore(wins > 0, kills);
    }

    /* Bug #12 Fix: Duel record — call if there is an accepted duel for this user */
    /* Note: duelId must be passed in statsUpdate for duel tracking */
    if (statsUpdate.duelId && statsUpdate.duelResult && window.updateDuelRecord) {
      window.updateDuelRecord(statsUpdate.duelId, statsUpdate.duelResult);
    }

    /* Battle Pass XP on match/win */
    if (window.awardPassXP && uid) {
      var bpXP = (wins > 0 ? 50 : 0) + (kills > 0 ? kills * 2 : 0) + (matches > 0 ? 10 : 0);
      if (bpXP > 0) window.awardPassXP(uid, bpXP);
    }
  }
  return; /* Supabase handles all — legacy Firebase code below never reached */
  var s = window.getCurrentSeason ? window.getCurrentSeason() : {};
  var wk = getWeekKey();
  /* Season stats */
  if (!window.db) return; /* Skip if db not available */
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
  var wRef = window.db ? window.db.ref('weeklyStats/' + wk + '/' + uid) : { transaction: function(){}, set: function(){} };
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
    /* Stats via Supabase */
    if (window._supa && u._uid) { var _c = key==='wins'?'total_wins':key==='kills'?'total_kills':'total_matches'; window._supa.rpc('increment_balance',{p_uid:u._uid,p_col:_c,p_amount:1}).then(null, function(){}); }
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
