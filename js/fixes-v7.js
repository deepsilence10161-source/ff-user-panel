/* ═══════════════════════════════════════════════════════════════════
   MINI ESPORTS — fixes-v7.js  (v3 — Intermittent Blank FIXED)
   
   ROOT CAUSE OF INTERMITTENT BLANK:
   - renderRank always shows spinner → Firebase fetch → render
   - On slow connection: spinner = "blank" for 2-4 seconds
   - renderRank('city') call from app.js re-triggers render mid-display
   - f19 re-hook wraps our function but timing can break chain
   
   SOLUTION:
   - Cache leaderboard users after first fetch
   - On revisit: show cached data INSTANTLY, refresh in background  
   - Ignore invalid tabs ('city' etc)
   - f19 disabled (our renderRank already has referral button built in)
   - Single installation with flag guard
   ═══════════════════════════════════════════════════════════════════ */
(function () {
'use strict';

/* ─── waitFor: fires callback ONCE when condition met ─── */
function waitFor(fn, cb, max) {
  var t = 0, iv = setInterval(function () {
    t++;
    if (fn()) { clearInterval(iv); cb(); }
    if (t > (max || 80)) clearInterval(iv);
  }, 300);
}

/* ═══════════════════════════════════════════════════════
   ██  RANK SCREEN — COMPLETE FIX  ██
   Never blank again:
   1. Show cached data INSTANTLY on repeat visits
   2. Spinner only on very first load (< 1 second usually)
   3. Background refresh keeps data fresh
   4. 8s timeout fallback
   5. Handles 'city' and any invalid tab gracefully
   6. Single install with flag
═══════════════════════════════════════════════════════ */
waitFor(function () { return window.db && window.calcRk && !window._v7RankInstalled; }, function () {
  window._v7RankInstalled = true;

  /* Cache for instant repeat renders */
  var _cachedUsers = null;
  var _cacheTime = 0;
  var CACHE_TTL = 60000; /* 1 minute cache */
  var _fetchInProgress = false;
  var _validTabs = ['kills', 'wins', 'rankpoints'];

  /* ── Build tab bar HTML ── */
  function buildTabBar() {
    var labels = { kills: '☠️ Kills', wins: '🏆 Wins', rankpoints: '💎 Points' };
    var h = '<div class="rank-formula-banner" onclick="window.showHowRankWorks&&showHowRankWorks()" style="cursor:pointer;margin-bottom:8px">' +
      '📊 Rank = Wins×40 + Kills×2 + Matches×1 <span style="font-size:10px;opacity:.6">→ Tap for details</span></div>';
    h += '<div style="display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;padding-bottom:2px">';
    _validTabs.forEach(function (t) {
      var active = t === window._rankTab;
      h += '<div onclick="window.renderRank(\'' + t + '\')" style="flex:1;padding:9px 6px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;text-align:center;white-space:nowrap;transition:all .2s;' +
        (active ? 'background:linear-gradient(135deg,rgba(0,255,156,.18),rgba(0,212,255,.1));color:#00ff9c;border:1.5px solid rgba(0,255,156,.35)'
                : 'background:rgba(255,255,255,.04);color:#666;border:1px solid rgba(255,255,255,.07)') + '">' + labels[t] + '</div>';
    });
    h += '</div>';
    return h;
  }

  /* ── Build season banner HTML ── */
  function buildSeasonBanner() {
    var season = { name: 'Season 1', daysLeft: 0, label: '' };
    try { if (window.getCurrentSeason) season = window.getCurrentSeason(); } catch (e) {}
    return '<div style="display:flex;justify-content:space-between;align-items:center;background:linear-gradient(135deg,rgba(185,100,255,.09),rgba(0,212,255,.06));border:1px solid rgba(185,100,255,.2);border-radius:14px;padding:12px 16px;margin-bottom:12px">' +
      '<div><div style="font-size:13px;font-weight:900;color:#b964ff">' + (season.name || 'Season') + '</div>' +
      '<div style="font-size:10px;color:#666;margin-top:1px">' + (season.label || '') + ' · Monthly reset</div></div>' +
      '<div style="text-align:right"><div style="font-size:16px;font-weight:900;color:#00d4ff">' + (season.daysLeft || 0) + '</div>' +
      '<div style="font-size:10px;color:#666">days left</div></div></div>';
  }

  /* ── Render the full leaderboard with users array ── */
  function renderUsers(rc, users) {
    var curTab = window._rankTab || 'kills';

    function getVal(u) {
      var st = u.stats || {};
      if (curTab === 'kills') return Number(st.kills || 0);
      if (curTab === 'wins') return Number(st.wins || 0);
      return Number(st.wins||0)*40 + Number(st.kills||0)*2 + Number(st.matches||0) + Number(st.winStreak||u.winStreak||0)*10;
    }
    function valStr(val) {
      if (curTab === 'kills') return val + ' kills';
      if (curTab === 'wins') return val + ' wins';
      return '🏆 ' + val + ' pts';
    }

    var h = buildTabBar() + buildSeasonBanner();

    /* My rank card */
    if (window.U && window.UD) {
      var me = window.UD;
      var mySt = me.stats || {};
      var myRk = window.calcRk ? window.calcRk(mySt) : { badge:'Unranked', emoji:'🎮', color:'#666', bg:'rgba(255,255,255,.06)' };
      var myIdx = -1;
      users.forEach(function(u, i){ if(u._uid === window.U.uid) myIdx = i; });
      h += '<div style="background:linear-gradient(135deg,rgba(0,255,156,.08),rgba(0,212,255,.04));border:1px solid rgba(0,255,156,.2);border-radius:14px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px">';
      h += '<div style="font-size:26px;font-weight:900;color:#00ff9c;min-width:42px;text-align:center">' + (myIdx >= 0 ? '#' + (myIdx + 1) : '–') + '</div>';
      h += '<div style="flex:1"><div style="font-size:13px;font-weight:700">' + (me.ign || me.displayName || 'You') + ' <span style="font-size:9px;background:rgba(0,255,156,.15);color:#00ff9c;padding:1px 5px;border-radius:4px">YOU</span></div>';
      h += '<div style="font-size:11px;color:#aaa;margin-top:2px">K:' + (mySt.kills||0) + ' W:' + (mySt.wins||0) + ' M:' + (mySt.matches||0) + '</div></div>';
      h += '<span style="padding:4px 10px;border-radius:8px;background:' + myRk.bg + ';color:' + myRk.color + ';font-size:11px;font-weight:700">' + myRk.emoji + ' ' + myRk.badge + '</span>';
      h += '</div>';
    }

    /* Podium top 3 */
    if (users.length > 0) {
      var podCount = Math.min(users.length, 3);
      var ORDER    = podCount===1?[0]:podCount===2?[1,0]:[1,0,2];
      var CLASSES  = podCount===1?['p1']:podCount===2?['p2','p1']:['p2','p1','p3'];
      var MEDALS   = ['🥈','👑','🥉'];
      var NUMS     = ['2','1','3'];
      var COLORS   = ['#c0c0c0','#ffd700','#cd7f32'];

      h += '<div class="rank-podium-wrap"><div class="rank-podium">';
      for (var i = 0; i < podCount; i++) {
        var u = users[ORDER[i]];
        var posIdx = ['p2','p1','p3'].indexOf(CLASSES[i]);
        var col = COLORS[posIdx] || '#ffd700';
        var av = u.profileImage ? '<img src="' + u.profileImage + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : (u.ign||u.displayName||'?').charAt(0).toUpperCase();
        var rk2 = window.calcRk ? window.calcRk(u.stats||{}) : {badge:'',emoji:'🎮',color:'#fff',bg:'rgba(0,0,0,.1)'};
        var v2 = getVal(u);
        h += '<div class="pod-item ' + CLASSES[i] + '">';
        if (CLASSES[i]==='p1') h += '<div class="pod-crown" style="animation:podCrown 1.5s ease-in-out infinite">👑</div>';
        h += '<div class="pod-ava" style="border-color:' + col + ';box-shadow:0 0 20px ' + col + '99">' + av + '</div>';
        h += '<div class="pod-medal">' + MEDALS[i] + '</div>';
        h += '<div class="pod-name">' + (window.escHtml?window.escHtml(u.ign||u.displayName||'Player'):(u.ign||u.displayName||'Player')) + '</div>';
        h += '<div class="pod-earn" style="color:' + col + ';font-weight:900">' + valStr(v2) + '</div>';
        h += '<div style="font-size:9px;padding:2px 6px;border-radius:8px;background:' + rk2.bg + ';color:' + rk2.color + ';margin:2px 0 4px">' + rk2.emoji + ' ' + rk2.badge + '</div>';
        h += '<div class="pod-pedestal">' + NUMS[i] + '</div></div>';
      }
      h += '</div></div>';
    }

    /* Rows 4+ */
    for (var j = 3; j < users.length; j++) {
      var ur = users[j];
      var rk = window.calcRk ? window.calcRk(ur.stats||{}) : {badge:'Player',emoji:'🎮',color:'#888',bg:'rgba(255,255,255,.06)'};
      var av2 = ur.profileImage ? '<img src="' + ur.profileImage + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">' : (ur.ign||ur.displayName||'?').charAt(0).toUpperCase();
      var st2 = ur.stats||{};
      var v3 = getVal(ur);
      var m2=Number(st2.matches||0), w2=Number(st2.wins||0), k2=Number(st2.kills||0);
      var wr = m2>0 ? Math.round((w2/m2)*100) : 0;
      var kd = m2>0 ? (k2/m2).toFixed(1) : '0.0';
      var isMe = window.U && ur._uid === window.U.uid;
      var numCol = j===3?'#ffd700':j===4?'#c0c0c0':j===5?'#cd7f32':'var(--txt2)';
      h += '<div class="rank-row" style="' + (isMe?'border:1px solid rgba(0,255,156,.3);background:rgba(0,255,156,.04)':'') + '">';
      h += '<div class="rank-num" style="color:' + numCol + ';font-weight:' + (j<6?'900':'600') + '">#' + (j+1) + '</div>';
      h += '<div class="rank-ava">' + av2 + '</div>';
      h += '<div class="rank-info"><div class="rn">' + (ur.ign||ur.displayName||'Player') + (isMe?' <span style="font-size:9px;color:#00ff9c">YOU</span>':'') + '</div>';
      h += '<div class="rs">K:' + k2 + ' W:' + w2 + ' <span style="color:#00ff9c">WR:' + wr + '%</span> <span style="color:#ff9f1c">K/M:' + kd + '</span></div></div>';
      h += '<span class="rank-badge" style="background:' + rk.bg + ';color:' + rk.color + '">' + rk.emoji + ' ' + rk.badge + '</span>';
      h += '<div class="rank-earn" style="color:' + (curTab==='kills'?'#ff6b6b':curTab==='wins'?'#ffd700':'#00d4ff') + '">' + valStr(v3) + '</div>';
      h += '</div>';
    }

    if (!users.length) {
      h += '<div class="empty-state" style="text-align:center;padding:40px;color:#666"><div style="font-size:48px;margin-bottom:8px">🏆</div>' +
           '<div style="font-size:14px;font-weight:700;color:#888">No ranked players yet</div>' +
           '<div style="font-size:12px;margin-top:4px;color:#555">Join matches to appear on leaderboard!</div></div>';
    }

    /* Referral leaderboard button */
    h += '<div style="margin-top:12px"><button onclick="window.showReferralLeaderboard&&showReferralLeaderboard()" ' +
         'style="width:100%;padding:11px;border-radius:12px;background:linear-gradient(135deg,rgba(185,100,255,.1),rgba(121,40,202,.05));color:#b964ff;border:1px solid rgba(185,100,255,.2);font-weight:700;font-size:13px;cursor:pointer">🎖️ Referral Leaderboard</button></div>';

    rc.innerHTML = h;
  }

  /* ── Sort users by current tab ── */
  function sortUsers(users) {
    var curTab = window._rankTab || 'kills';
    return users.slice().sort(function(a, b) {
      function v(u) {
        var st = u.stats||{};
        if (curTab==='kills') return Number(st.kills||0);
        if (curTab==='wins') return Number(st.wins||0);
        return Number(st.wins||0)*40+Number(st.kills||0)*2+Number(st.matches||0)+Number(st.winStreak||u.winStreak||0)*10;
      }
      return v(b)-v(a);
    });
  }

  /* ── Fetch fresh data from Firebase ── */
  function fetchAndRender(rc, onComplete) {
    if (_fetchInProgress) return;
    _fetchInProgress = true;

    var _done = false;
    var _timeoutId = setTimeout(function() {
      if (_done) return;
      _done = true;
      _fetchInProgress = false;
      /* Use cached if available, otherwise empty */
      var users = _cachedUsers ? sortUsers(_cachedUsers) : [];
      renderUsers(rc, users);
      if (onComplete) onComplete();
    }, 8000);

    window.db.ref('users').limitToLast(300).once('value', function(snap) {
      if (_done) return;
      _done = true;
      _fetchInProgress = false;
      clearTimeout(_timeoutId);

      var users = [];
      try {
        if (snap.exists()) {
          snap.forEach(function(c) {
            var u = c.val();
            if (u && (u.ign||u.displayName)) users.push(Object.assign({_uid:c.key}, u));
          });
        }
      } catch(e) {}

      _cachedUsers = users;
      _cacheTime = Date.now();

      var sorted = sortUsers(users);
      renderUsers(rc, sorted);
      if (onComplete) onComplete();

    }, function(err) {
      /* Firebase error */
      if (_done) return;
      _done = true;
      _fetchInProgress = false;
      clearTimeout(_timeoutId);
      var users = _cachedUsers ? sortUsers(_cachedUsers) : [];
      if (users.length > 0) {
        renderUsers(rc, users); /* Show cached */
      } else {
        rc.innerHTML = buildTabBar() + buildSeasonBanner() +
          '<div style="text-align:center;padding:32px;color:#aaa">' +
          '<div style="font-size:32px;margin-bottom:8px">📡</div>' +
          '<div style="font-size:13px;margin-bottom:12px">Connection error</div>' +
          '<button onclick="window.renderRank()" style="padding:10px 24px;border-radius:12px;background:rgba(0,255,156,.12);border:1px solid rgba(0,255,156,.25);color:#00ff9c;font-weight:700;cursor:pointer">🔄 Retry</button></div>';
      }
      if (onComplete) onComplete();
    });
  }

  /* ── THE MAIN renderRank — installed once, never blank ── */
  window.renderRank = function(tab) {
    /* Ignore invalid tabs like 'city' */
    if (tab && _validTabs.indexOf(tab) >= 0) window._rankTab = tab;
    if (!window._rankTab || _validTabs.indexOf(window._rankTab) < 0) window._rankTab = 'kills';

    var rc = document.getElementById('rankContent');
    if (!rc) return;

    var cacheAge = Date.now() - _cacheTime;
    var hasFreshCache = _cachedUsers !== null && cacheAge < CACHE_TTL;

    if (hasFreshCache) {
      /* ✅ INSTANT render from cache — NO spinner, NO blank */
      renderUsers(rc, sortUsers(_cachedUsers));
      /* Background refresh if cache > 30s old */
      if (cacheAge > 30000 && !_fetchInProgress) {
        fetchAndRender(rc);
      }
    } else if (_cachedUsers !== null) {
      /* Has old cache — show it immediately, refresh in background */
      renderUsers(rc, sortUsers(_cachedUsers));
      fetchAndRender(rc);
    } else {
      /* Very first load only — show minimal skeleton, not blank spinner */
      rc.innerHTML = buildTabBar() + buildSeasonBanner() +
        '<div style="padding:8px">' +
        [1,2,3,4,5].map(function(){ return '<div style="height:52px;background:rgba(255,255,255,.04);border-radius:12px;margin-bottom:8px;animation:rankShine 1.5s linear infinite"></div>'; }).join('') +
        '</div>';
      fetchAndRender(rc);
    }
  };

  /* Kick off an initial background fetch so cache is warm before user taps Rank */
  setTimeout(function() {
    if (!_cachedUsers && window.db) {
      window.db.ref('users').limitToLast(300).once('value', function(snap) {
        var users = [];
        try { if(snap.exists()) snap.forEach(function(c){ var u=c.val(); if(u&&(u.ign||u.displayName)) users.push(Object.assign({_uid:c.key},u)); }); } catch(e) {}
        _cachedUsers = users;
        _cacheTime = Date.now();
      });
    }
  }, 2000);

  /* Block f19 from re-hooking (our renderRank already has referral button) */
  window._f19Hooked = true;

  /* Export for timeout fallback */
  window._doRenderRankList = function(rc, users) { renderUsers(rc, users || []); };
  console.log('[v7] ✅ Rank: instant-render with cache installed');
});

/* ════════════════════════════════════════════
   FIX #11 — TEAM DUPLICATE CHECK
════════════════════════════════════════════ */
waitFor(function(){ return window.saveTM; }, function(){
  var orig = window.saveTM;
  window.saveTM = function(mode) {
    if (!window.UD || !window.db) { orig(mode); return; }
    var uid = ((document.getElementById('tmUid')||{}).value||'').trim();
    if (!uid) { orig(mode); return; }

    if (mode === 'duo') {
      var ex = window.UD.duoTeam;
      if (ex && (ex.memberUid===uid || ex.memberFirebaseUid===uid)) {
        if (window.toast) window.toast('⚠️ Yeh player already tumhara Duo partner hai!', 'inf'); return;
      }
      window.db.ref('users').orderByChild('ffUid').equalTo(uid).once('value', function(s) {
        if (s.exists()) {
          var fbUid=null; s.forEach(function(c){if(!fbUid)fbUid=c.key;});
          if (fbUid && window.U && fbUid===window.U.uid) { if(window.toast)window.toast('Apne aap ko add nahi kar sakte!','err'); return; }
        }
        orig(mode);
      });
      return;
    }

    if (mode === 'squad') {
      var members = (window.UD.squadTeam && window.UD.squadTeam.members)||[];
      if (members.some(function(m){return m.uid===uid||m.ffUid===uid;})) {
        if(window.toast)window.toast('⚠️ Yeh player already Squad mein hai!','inf'); return;
      }
      window.db.ref('users').orderByChild('ffUid').equalTo(uid).once('value', function(s) {
        if (s.exists()) {
          var fbUid=null; s.forEach(function(c){if(!fbUid)fbUid=c.key;});
          if (fbUid && members.some(function(m){return m.uid===fbUid;})) {
            if(window.toast)window.toast('⚠️ Already Squad mein hai!','inf'); return;
          }
        }
        orig(mode);
      });
      return;
    }
    orig(mode);
  };
});

/* ════════════════════════════════════════════
   FIX #12 — UTR MANDATORY IN WITHDRAWAL
════════════════════════════════════════════ */
waitFor(function(){ return window.startWd; }, function(){
  var origSWD = window.startWd;
  window.startWd = function() {
    origSWD.apply(this, arguments);
    setTimeout(function() {
      if (document.getElementById('wdUtrNumber')) return;
      var upiEl = document.getElementById('wdUpi');
      if (!upiEl) return;
      var wrap = document.createElement('div');
      wrap.className = 'f-group';
      wrap.style.marginTop = '8px';
      wrap.innerHTML = '<label style="font-size:12px;color:var(--txt2);display:block;margin-bottom:4px">UTR Number <span style="color:#ff6b6b">*</span> <span style="font-size:10px;color:#888">(Payment ke baad bank/UPI app mein milta hai)</span></label>' +
        '<input type="text" class="f-input" id="wdUtrNumber" placeholder="12-digit UTR number" maxlength="22" style="font-family:monospace;letter-spacing:1px" oninput="this.value=this.value.replace(/[^0-9a-zA-Z]/g,\'\')">';
      var fg = upiEl.closest ? upiEl.closest('.f-group') : upiEl.parentNode;
      if (fg && fg.insertAdjacentElement) fg.insertAdjacentElement('afterend', wrap);
      else if (upiEl.parentNode) upiEl.parentNode.appendChild(wrap);
    }, 350);
  };
});

waitFor(function(){ return window._confirmDiamondWD; }, function(){
  var origCD = window._confirmDiamondWD;
  window._confirmDiamondWD = function(maxDiamonds) {
    var utrEl = document.getElementById('wdUtrNumber');
    var utrVal = utrEl ? utrEl.value.trim() : '';
    if (!utrVal || utrVal.length < 6) {
      if (window.toast) window.toast('⚠️ UTR Number mandatory hai — enter karo!', 'err');
      if (utrEl) { utrEl.focus(); utrEl.style.boxShadow = '0 0 0 2px #ff6b6b'; setTimeout(function(){utrEl.style.boxShadow='';}, 2000); }
      return;
    }
    window._pendingUTR = utrVal;
    origCD(maxDiamonds);
  };
});

/* ════════════════════════════════════════════
   FIX #13 — POLL INSTANT RESULT
════════════════════════════════════════════ */
waitFor(function(){ return window.castVote; }, function(){
  window.castVote = function(pollKey, optionKey) {
    if (!window.U||!window.db) return;
    var uid = window.U.uid;
    window.db.ref('polls/'+pollKey+'/votes/'+uid).once('value', function(s) {
      if (s.exists()) {
        if (window.toast) window.toast('Pehle se vote ho chuka hai! ✅','inf');
        if (window.renderPollCards) window.renderPollCards();
        return;
      }
      var upd = {}; upd['polls/'+pollKey+'/votes/'+uid] = {option:optionKey,ts:Date.now()};
      window.db.ref().update(upd, function() {
        window.db.ref('polls/'+pollKey+'/options/'+optionKey+'/votes').transaction(function(v){return(v||0)+1;});
        window.db.ref('polls/'+pollKey+'/totalVotes').transaction(function(v){return(v||0)+1;});
        try {
          var mv = JSON.parse(localStorage.getItem('_mes_votes_'+uid)||'{}');
          mv[pollKey] = optionKey;
          localStorage.setItem('_mes_votes_'+uid, JSON.stringify(mv));
        } catch(e) {}
        if (window._activePolls) window._activePolls.forEach(function(p) {
          if (p._key!==pollKey) return;
          if (!p.votes) p.votes={};
          p.votes[uid]={option:optionKey};
          if (!p.options) p.options={};
          if (!p.options[optionKey]) p.options[optionKey]={votes:0,label:optionKey};
          p.options[optionKey].votes=(p.options[optionKey].votes||0)+1;
        });
        if (window.toast) window.toast('✅ Vote registered!','ok');
        if (window.renderPollCards) window.renderPollCards();
      });
    });
  };
});

/* ════════════════════════════════════════════
   FIX #14 — GIFT TICKET joinRequest CREATE
════════════════════════════════════════════ */
waitFor(function(){ return window.confirmGiftTicket && window.db; }, function(){
  window.confirmGiftTicket = function(matchId) {
    if (!window.db||!window.MT||!window.U||!window.UD) return;
    var t = window.MT[matchId]; if (!t) return;
    var ffUid = ((document.getElementById('giftToUid')||{}).value||'').trim();
    if (ffUid.length < 5) { if(window.toast)window.toast('Valid FF UID enter karo','err'); return; }
    var isCoin = (t.entryType||'').toLowerCase()==='coin';
    var fee = Number(t.entryFee)||0;

    /* Balance check first */
    if (fee > 0) {
      var myBal = isCoin ? (Number(window.UD.coins)||0) :
        (window.getMoneyBal ? window.getMoneyBal() : (Number((window.UD.realMoney||{}).deposited||0)+Number((window.UD.realMoney||{}).winnings||0)));
      if (myBal < fee) { if(window.toast)window.toast('Insufficient balance to gift this entry!','err'); return; }
    }

    window.db.ref('users').orderByChild('ffUid').equalTo(ffUid).once('value', function(s) {
      if (!s.exists()) { if(window.toast)window.toast('Player not found with this FF UID','err'); return; }
      var friendUid=null, friendData=null;
      s.forEach(function(c){if(!friendUid){friendUid=c.key;friendData=c.val();}});
      if (friendUid===window.U.uid) { if(window.toast)window.toast('Apne aap ko gift nahi kar sakte 😄','err'); return; }

      window.db.ref('joinRequests').orderByChild('matchId').equalTo(matchId).once('value', function(jSnap) {
        var alreadyIn = false;
        if (jSnap.exists()) jSnap.forEach(function(jc){if(jc.val().userId===friendUid)alreadyIn=true;});
        if (alreadyIn) { if(window.toast)window.toast('Yeh player already is match mein join kar chuka hai!','inf'); return; }

        if (isCoin) window.db.ref('users/'+window.U.uid+'/coins').transaction(function(c){return Math.max((c||0)-fee,0);});
        else if (window.deductMoney) window.deductMoney(fee,'Gift → '+(friendData.ign||ffUid)+' · '+(t.name||'Match'));

        var gid = window.db.ref('giftTickets').push().key;
        window.db.ref('giftTickets/'+gid).set({
          fromUid:window.U.uid, fromName:window.UD.ign||window.UD.displayName||'',
          toUid:friendUid, toFFUid:ffUid, matchId:matchId, matchName:t.name||'',
          fee:fee, entryType:t.entryType||'paid', status:'gifted', createdAt:Date.now()
        });

        var jrId = window.db.ref('joinRequests').push().key;
        window.db.ref('joinRequests/'+jrId).set({
          userId:friendUid, userName:friendData.ign||friendData.displayName||'Player',
          userEmail:friendData.email||'', ffUid:friendData.ffUid||ffUid,
          matchId:matchId, matchName:t.name||'', entryFee:fee, entryType:t.entryType||'paid',
          giftedBy:window.U.uid, giftedByName:window.UD.ign||window.UD.displayName||'',
          giftId:gid, isGifted:true, status:'pending',
          mode:t.mode||t.type||'solo', createdAt:Date.now(), timestamp:Date.now()
        });
        window.db.ref('users/'+friendUid+'/joinedMatches/'+matchId).set({matchId:matchId,joinId:jrId,isGifted:true,joinedAt:Date.now()});
        window.db.ref('users/'+friendUid+'/notifications').push({
          type:'gift_ticket', title:'🎁 Match Ticket Gift!',
          body:(window.UD.ign||'A friend')+' ne tumhe "'+( t.name||'Match')+'" ka ticket gift kiya!',
          matchId:matchId, giftId:gid, read:false, createdAt:Date.now()
        });
        if (window.closeModal) window.closeModal();
        if (window.toast) window.toast('🎁 Gift sent! Unka joinRequest create ho gaya.','ok');
      });
    });
  };
});

/* ════════════════════════════════════════════
   FIX #15 — TYPING INDICATOR
════════════════════════════════════════════ */
waitFor(function(){ return window.db && window.U; }, function(){
  var _typingTO=null, _adminRef=null;

  function initTyping() {
    var chatIn = document.getElementById('chatIn');
    if (!chatIn || chatIn._typingReady) return;
    chatIn._typingReady = true;
    var uid = window.U.uid;
    var typRef = window.db.ref('supportTyping/user_'+uid);

    chatIn.addEventListener('input', function() {
      typRef.set({typing:true,ts:Date.now()});
      clearTimeout(_typingTO);
      _typingTO = setTimeout(function(){typRef.set({typing:false,ts:Date.now()});}, 2500);
    });
    chatIn.addEventListener('blur', function() {
      clearTimeout(_typingTO);
      typRef.set({typing:false,ts:Date.now()});
    });

    if (_adminRef) { try{_adminRef.off();}catch(e){} }
    _adminRef = window.db.ref('supportTyping/admin_for_'+uid);
    _adminRef.on('value', function(sn) {
      var el = document.getElementById('chatSt'); if (!el) return;
      var d = sn.val();
      el.innerHTML = (d&&d.typing&&(Date.now()-(d.ts||0))<5000)
        ? '<span style="color:#00ff9c;font-size:10px">✍️ Support typing...</span>'
        : 'Online';
    });
  }

  var origNav = window.navTo;
  if (origNav) {
    window.navTo = function(scr) {
      origNav.apply(this, arguments);
      if (scr==='chat') { setTimeout(initTyping, 400); }
      else if (_adminRef) {
        try{_adminRef.off();}catch(e){}
        _adminRef = null;
        var cst = document.getElementById('chatSt');
        if (cst) cst.textContent = 'Online';
      }
    };
  }
  setInterval(initTyping, 2000);
}, 60);

/* ════════════════════════════════════════════
   FIX #16 — CALENDAR MULTI-MONTH
════════════════════════════════════════════ */
(function(){
  var _cY, _cM;
  function initCal(){ var d=new Date(); _cY=d.getFullYear(); _cM=d.getMonth(); }
  initCal();
  var MON=['January','February','March','April','May','June','July','August','September','October','November','December'];

  window.calNav = function(dir) {
    _cM+=dir;
    if(_cM>11){_cM=0;_cY++;} if(_cM<0){_cM=11;_cY--;}
    var el=document.getElementById('mesCalWrap');
    if(el) el.innerHTML=buildCal(_cY,_cM);
  };

  window.showCalDayMatches = function(y,m,d) {
    if(!window.MT) return;
    var list=[];
    Object.values(window.MT).forEach(function(t){
      if(!t) return;
      var ts=t.startTime||t.matchTime; if(!ts) return;
      var dt=new Date(Number(ts));
      if(dt.getFullYear()===y&&dt.getMonth()===m&&dt.getDate()===d) list.push(t);
    });
    if(!list.length) return;
    var h='<div>';
    list.forEach(function(t){
      h+='<div style="padding:12px;background:var(--card2);border-radius:12px;border:1px solid var(--border);margin-bottom:8px">';
      h+='<div style="font-weight:700;font-size:13px">'+(t.name||'Match')+'</div>';
      h+='<div style="font-size:11px;color:var(--txt2);margin-top:4px">💎 '+(t.entryFee||0)+' Entry · 🏆 ₹'+(t.prizePool||0)+' Prize</div>';
      if((t.status||'')==='upcoming'||!t.status) h+='<button onclick="if(window.cJoin)cJoin(\''+t.id+'\');if(window.closeModal)closeModal()" style="margin-top:8px;width:100%;padding:9px;border-radius:10px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer;font-size:12px">Join Match</button>';
      h+='</div>';
    });
    h+='</div>';
    if(window.openModal) window.openModal('📅 '+d+' '+MON[m].slice(0,3)+' Matches',h);
  };

  function buildCal(year,month) {
    var matchDays={};
    if(window.MT) Object.values(window.MT).forEach(function(t){
      if(!t) return;
      var ts=t.startTime||t.matchTime; if(!ts) return;
      var dt=new Date(Number(ts));
      if(dt.getFullYear()===year&&dt.getMonth()===month){
        var day=dt.getDate();
        if(!matchDays[day]) matchDays[day]=[];
        matchDays[day].push(t);
      }
    });
    var firstDay=new Date(year,month,1).getDay();
    var daysInMonth=new Date(year,month+1,0).getDate();
    var today=new Date();
    var isNow=(today.getFullYear()===year&&today.getMonth()===month);

    var h='<div style="background:var(--card);border-radius:14px;padding:14px;margin-bottom:12px">';
    h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">';
    h+='<button onclick="window.calNav(-1)" style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.08);border:none;color:var(--txt);font-size:18px;cursor:pointer">‹</button>';
    h+='<div style="font-size:14px;font-weight:800">'+MON[month]+' '+year+'</div>';
    h+='<button onclick="window.calNav(1)" style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.08);border:none;color:var(--txt);font-size:18px;cursor:pointer">›</button>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;font-size:10px;color:var(--txt2);margin-bottom:4px">';
    ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(function(d){h+='<div>'+d+'</div>';});
    h+='</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">';
    for(var i=0;i<firstDay;i++) h+='<div></div>';
    for(var day=1;day<=daysInMonth;day++){
      var hm=matchDays[day]&&matchDays[day].length>0;
      var isTd=isNow&&day===today.getDate();
      var bg=isTd?'linear-gradient(135deg,#00ff9c,#00cc7a)':hm?'rgba(0,212,255,.15)':'transparent';
      var border=isTd?'#00ff9c':hm?'rgba(0,212,255,.35)':'rgba(255,255,255,.05)';
      var color=isTd?'#000':hm?'#00d4ff':'var(--txt2)';
      var oc=hm?' onclick="window.showCalDayMatches('+year+','+month+','+day+')"':'';
      h+='<div'+oc+' style="text-align:center;padding:5px 2px;border-radius:8px;background:'+bg+';border:1px solid '+border+';color:'+color+';font-size:11px;font-weight:'+(isTd||hm?'800':'400')+';cursor:'+(hm?'pointer':'default')+'">'+day;
      if(hm) h+='<div style="width:4px;height:4px;background:#00d4ff;border-radius:50%;margin:1px auto 0"></div>';
      h+='</div>';
    }
    h+='</div>';
    var upcoming=[];
    Object.keys(matchDays).sort(function(a,b){return a-b;}).forEach(function(d){matchDays[d].forEach(function(t){upcoming.push({d:+d,t:t});});});
    if(upcoming.length){
      h+='<div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px">';
      h+='<div style="font-size:10px;font-weight:700;color:var(--txt2);text-transform:uppercase;margin-bottom:6px">Matches This Month</div>';
      upcoming.slice(0,3).forEach(function(item){
        var dt=new Date(year,month,item.d);
        var dn=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dt.getDay()];
        h+='<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.04)">';
        h+='<div style="min-width:34px;text-align:center;background:rgba(0,212,255,.1);border-radius:6px;padding:2px 3px;font-size:9px;font-weight:700;color:#00d4ff">'+dn+'<br>'+item.d+'</div>';
        h+='<div style="flex:1;font-size:12px;font-weight:600">'+(item.t.name||'Match')+'</div>';
        h+='<div style="font-size:11px;color:#00ff9c;font-weight:700">💎'+(item.t.entryFee||0)+'</div>';
        h+='</div>';
      });
      if(upcoming.length>3) h+='<div style="font-size:10px;color:var(--txt2);text-align:center;padding-top:4px">+'+(upcoming.length-3)+' more</div>';
      h+='</div>';
    }
    h+='</div>';
    return h;
  }

  function injectCalendar(){
    var wrap=document.getElementById('mesCalWrap');
    if(wrap){wrap.innerHTML=buildCal(_cY,_cM);return;}
    var hl=document.getElementById('homeList'); if(!hl) return;
    var d=document.createElement('div'); d.id='mesCalWrap';
    hl.parentNode.insertBefore(d,hl);
    d.innerHTML=buildCal(_cY,_cM);
  }

  waitFor(function(){return window.renderHome;}, function(){
    if(window._calHooked) return; window._calHooked=true;
    var orig=window.renderHome;
    window.renderHome=function(){orig.apply(this,arguments);setTimeout(injectCalendar,400);};
  });
  setTimeout(injectCalendar,3000);
})();

/* ════════════════════════════════════════════
   FIX #17 — PLAYER COMPARISON REALTIME
════════════════════════════════════════════ */
waitFor(function(){return window._doCompare;}, function(){
  var _lsn=null, _oUid=null;
  window._doCompare = function() {
    var ffUid = ((document.getElementById('cmpUid')||{}).value||'').trim();
    if(!ffUid){if(window.toast)window.toast('FF UID enter karo','inf');return;}
    if(window.toast)window.toast('Loading...','inf');
    window.db.ref('users').orderByChild('ffUid').equalTo(ffUid).once('value', function(s) {
      if(!s.exists()){if(window.toast)window.toast('Player nahi mila','err');return;}
      var oData=null,fbUid=null;
      s.forEach(function(c){oData=c.val();fbUid=c.key;});
      if(_lsn&&_oUid){try{window.db.ref('users/'+_oUid).off('value',_lsn);}catch(e){}}
      _oUid=fbUid;
      function render(other){
        var me=window.UD||{},s1=me.stats||{},s2=other.stats||{};
        var rows=[['Matches',s1.matches||0,s2.matches||0],['Wins',s1.wins||0,s2.wins||0],['Kills',s1.kills||0,s2.kills||0],
          ['Win Rate',(s1.matches?Math.round((s1.wins||0)/s1.matches*100):0)+'%',(s2.matches?Math.round((s2.wins||0)/s2.matches*100):0)+'%'],
          ['Earnings','₹'+(s1.earnings||0),'₹'+(s2.earnings||0)]];
        var h='<div>';
        h+='<div style="display:grid;grid-template-columns:1fr 44px 1fr;margin-bottom:12px">';
        h+='<div style="text-align:center;padding:12px;background:rgba(0,255,156,.06);border-radius:12px 0 0 12px"><div style="font-size:15px;font-weight:900;color:#00ff9c">'+(me.ign||'You')+'</div><div style="font-size:9px;color:#aaa">You</div></div>';
        h+='<div style="display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;background:var(--card2)">VS</div>';
        h+='<div style="text-align:center;padding:12px;background:rgba(255,107,107,.06);border-radius:0 12px 12px 0"><div style="font-size:15px;font-weight:900;color:#ff6b6b">'+(other.ign||'Player')+'</div><div style="font-size:9px;color:#aaa">Opponent</div></div>';
        h+='</div>';
        rows.forEach(function(r){
          var v1=parseFloat(r[1])||0,v2=parseFloat(r[2])||0,myWin=v1>v2;
          h+='<div style="display:grid;grid-template-columns:1fr 80px 1fr;border-bottom:1px solid var(--border);padding:8px 0">';
          h+='<div style="text-align:center;font-size:14px;font-weight:'+(myWin?'900':'400')+';color:'+(myWin?'#00ff9c':'var(--txt)')+'">'+r[1]+(myWin?' 🏆':'')+'</div>';
          h+='<div style="text-align:center;font-size:10px;color:var(--txt2)">'+r[0]+'</div>';
          h+='<div style="text-align:center;font-size:14px;font-weight:'+(!myWin&&v2>v1?'900':'400')+';color:'+(!myWin&&v2>v1?'#ff6b6b':'var(--txt)')+'">'+r[2]+(!myWin&&v2>v1?' 🏆':'')+'</div>';
          h+='</div>';
        });
        h+='<div style="margin-top:8px;text-align:center;font-size:10px;color:#555">⚡ Live stats</div></div>';
        var mb=document.getElementById('modalB'),mt=document.getElementById('modalT');
        if(mb&&mt&&mt.textContent.indexOf('Compare')>=0) mb.innerHTML=h;
        return h;
      }
      var initH=render(oData);
      if(window.openModal) window.openModal('⚔️ Live Comparison',initH);
      _lsn=window.db.ref('users/'+fbUid).on('value',function(sn){if(sn.exists())render(sn.val());});
    });
  };
});

/* ════════════════════════════════════════════
   FIX #18 — STREAK RESET BUG
════════════════════════════════════════════ */
waitFor(function(){return window.U&&window.db;}, function(){
  function ds(n){var d=new Date();d.setDate(d.getDate()+(n||0));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  window._checkStreakFixed = function(){
    if(!window.U||!window.db) return;
    var uid=window.U.uid, today=ds(0), yesterday=ds(-1);
    window.db.ref('users/'+uid).once('value', function(s){
      var data=(s&&s.val)?s.val():{}; if(!data) data={};
      var last=data.lastLoginDate||'', streak=Number(data.loginStreak)||0;
      if(last===today) return;
      var newStreak;
      if(last===yesterday){newStreak=streak+1;}
      else if(!last){newStreak=1;}
      else{
        newStreak=1;
        if(streak>1&&window.toast) setTimeout(function(){window.toast('💔 '+streak+' din ki streak miss! Aaj se phir shuru.','inf');},3000);
      }
      newStreak=Math.min(newStreak,7);
      var REWARDS=window._adminDailyBonusRewards||[5,7,10,12,15,20,30];
      var reward=REWARDS[newStreak-1]||5;
      var total=(Number(data.totalLoginStreak)||0)+1;
      var upd={lastLoginDate:today,loginStreak:newStreak,totalLoginStreak:total};
      if(total===7) upd['badges/weekWarrior']=true;
      if(total===14) upd['badges/fortnightFighter']=true;
      if(total===30) upd['badges/monthlyLegend']=true;
      window.db.ref('users/'+uid).update(upd);
      var bonus=total===30?100:0;
      window.db.ref('users/'+uid+'/coins').transaction(function(c){return(c||0)+reward+bonus;});
      if(newStreak===1&&streak>1) window.db.ref('users/'+uid+'/streakHistory').push({event:'reset',prev:streak,date:today,ts:Date.now()});
      if(window.f06Streak&&window.f06Streak.show) setTimeout(function(){window.f06Streak.show(newStreak,reward);},1500);
    });
  };
  if(window.f06Streak) window.f06Streak.check=window._checkStreakFixed;
  waitFor(function(){return window.UD;},function(){setTimeout(window._checkStreakFixed,2000);});
},60);

/* ════════════════════════════════════════════
   ✨ INVITE & EARN
════════════════════════════════════════════ */
waitFor(function(){return window.U&&window.UD&&window.db;},function(){
  window.showInviteEarn=function(){
    if(!window.UD) return;
    var code=window.UD.referralCode||'MINI';
    var link=(window.location.origin||'')+'/index.html?ref='+code;
    var msg='🎮 Mini eSports pe khelo aur paise kamao!\nFree Fire tournaments join karo, real prizes jito!\n🔗 '+link+'\n🎁 Code: '+code+'\n(Dono ko bonus coins milenge! 🪙)';
    var h='<div>';
    h+='<div style="background:linear-gradient(135deg,rgba(0,255,156,.1),rgba(0,212,255,.05));border:1px solid rgba(0,255,156,.2);border-radius:14px;padding:16px;text-align:center;margin-bottom:14px">';
    h+='<div style="font-size:11px;color:var(--txt2);margin-bottom:6px">Tumhara Referral Code</div>';
    h+='<div style="font-size:30px;font-weight:900;color:#00ff9c;letter-spacing:3px">'+code+'</div>';
    h+='<div style="font-size:11px;color:#aaa;margin-top:6px">Tum: 🪙150 · Dost: 🪙50 pehle match par</div>';
    h+='</div>';
    h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">';
    h+='<a href="https://wa.me/?text='+encodeURIComponent(msg)+'" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-weight:700;font-size:12px;text-decoration:none"><i class="fab fa-whatsapp"></i> WhatsApp</a>';
    h+='<a href="https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(msg)+'" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#0088cc,#005fa3);color:#fff;font-weight:700;font-size:12px;text-decoration:none"><i class="fab fa-telegram"></i> Telegram</a>';
    h+='</div>';
    h+='<button onclick="(function(){var t='+JSON.stringify(msg)+';if(navigator.share)navigator.share({title:\'Mini eSports\',text:t}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(t).then(function(){if(window.toast)toast(\'📋 Copied!\',\'ok\')})})()" style="width:100%;padding:11px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-weight:700;font-size:12px;cursor:pointer;margin-bottom:14px"><i class="fas fa-share-alt"></i> More Options / Copy</button>';
    h+='<div style="border-top:1px solid var(--border);padding-top:12px">';
    h+='<div style="font-size:11px;font-weight:800;color:var(--txt2);text-transform:uppercase;margin-bottom:8px">🏆 Top Inviters This Month</div>';
    h+='<div id="inviteLbList"><div style="text-align:center;color:var(--txt2);font-size:12px;padding:12px">Loading...</div></div>';
    h+='</div></div>';
    if(window.openModal) window.openModal('🎁 Invite & Earn',h);
    setTimeout(function(){
      var ms=new Date();ms.setDate(1);ms.setHours(0,0,0,0);
      window.db.ref('referrals').orderByChild('createdAt').startAt(ms.getTime()).once('value',function(s){
        var counts={},names={};
        if(s.exists()) s.forEach(function(c){var r=c.val();if(!r||!r.referrerId)return;counts[r.referrerId]=(counts[r.referrerId]||0)+1;names[r.referrerId]=r.referrerName||r.referrerId.slice(0,8);});
        var sorted=Object.keys(counts).map(function(u){return{uid:u,count:counts[u],name:names[u]};}).sort(function(a,b){return b.count-a.count;});
        var el=document.getElementById('inviteLbList');if(!el)return;
        if(!sorted.length){el.innerHTML='<div style="text-align:center;color:#555;font-size:12px;padding:12px">Abhi koi referrals nahi — pehle bano! 🚀</div>';return;}
        var medals=['🥇','🥈','🥉'];
        el.innerHTML=sorted.slice(0,5).map(function(p,i){
          var isMe=window.U&&p.uid===window.U.uid;
          return '<div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:10px;background:'+(isMe?'rgba(0,255,156,.06)':'var(--card)')+';border:1px solid '+(isMe?'rgba(0,255,156,.2)':'var(--border)')+';margin-bottom:5px">'+
            '<div style="font-size:18px;width:24px">'+(medals[i]||'#'+(i+1))+'</div>'+
            '<div style="flex:1;font-size:12px;font-weight:700">'+p.name+(isMe?' <span style="font-size:9px;color:#00ff9c">(You)</span>':'')+'</div>'+
            '<div style="font-size:12px;font-weight:800;color:#00d4ff">'+p.count+' 🎯</div></div>';
        }).join('');
      });
    },300);
  };

  waitFor(function(){return window.renderProfile;},function(){
    if(window._inviteHooked)return;window._inviteHooked=true;
    var orig=window.renderProfile;
    window.renderProfile=function(){
      orig.apply(this,arguments);
      setTimeout(function(){
        var prof=document.getElementById('profileContent');
        if(!prof||prof.querySelector('#inviteEarnBtn'))return;
        var btn=document.createElement('button');btn.id='inviteEarnBtn';
        btn.onclick=window.showInviteEarn;
        btn.style.cssText='width:100%;padding:13px;border-radius:13px;background:linear-gradient(135deg,rgba(0,255,156,.12),rgba(0,212,255,.06));border:1px solid rgba(0,255,156,.25);color:#00ff9c;font-weight:800;font-size:13px;cursor:pointer;margin:8px 0;display:flex;align-items:center;justify-content:center;gap:8px';
        btn.innerHTML='<i class="fas fa-user-plus"></i> 🎁 Invite & Earn — दोस्त लाओ ₹ पाओ!';
        prof.insertBefore(btn,prof.firstChild);
      },400);
    };
  });

  /* URL referral bonus */
  try {
    var urlRef=new URLSearchParams(window.location.search).get('ref');
    if(urlRef&&window.U){
      window.db.ref('users/'+window.U.uid+'/referralBonusReceived').once('value',function(s){
        if(s.val())return;
        window.db.ref('users').orderByChild('referralCode').equalTo(urlRef).once('value',function(rs){
          if(!rs.exists())return;
          var refUid=null,refData=null;
          rs.forEach(function(c){if(!refUid){refUid=c.key;refData=c.val();}});
          if(!refUid||refUid===window.U.uid)return;
          window.db.ref('users/'+refUid+'/coins').transaction(function(c){return(c||0)+150;});
          window.db.ref('referrals').push({referrerId:refUid,referrerName:refData.ign||refData.displayName||'',referredUid:window.U.uid,referredName:window.UD.ign||'',bonus:150,createdAt:Date.now()});
          window.db.ref('users/'+refUid+'/notifications').push({title:'🎁 Referral Bonus!',message:(window.UD.ign||'Someone')+' ne tumhara code use kiya! +🪙150',type:'referral_bonus',read:false,createdAt:Date.now()});
          window.db.ref('users/'+window.U.uid+'/referralBonusReceived').set(true);
          window.db.ref('users/'+window.U.uid+'/pendingReferralJoinBonus').set(50);
        });
      });
    }
  } catch(e){}
},60);

/* ════════════════════════════════════════════
   ✨ ADMIN DAILY BONUS CONFIG
════════════════════════════════════════════ */
waitFor(function(){return window.db;},function(){
  window.db.ref('appSettings/dailyBonusRewards').on('value',function(s){
    if(!s.exists())return;
    var cfg=s.val(),arr=[];
    for(var i=1;i<=7;i++) arr.push(Number(cfg['day'+i])||[5,7,10,12,15,20,30][i-1]);
    window._adminDailyBonusRewards=arr;
  });
});

/* ════════════════════════════════════════════
   ✨ PUSH NOTIFICATIONS+
════════════════════════════════════════════ */
waitFor(function(){return window.db&&window.U;},function(){
  var uid=window.U.uid, _ready=false;
  window.db.ref('matches').orderByChild('createdAt').startAt(Date.now()-86400000).on('child_added',function(s){
    var m=s.val();if(!m||!_ready)return;
    if((Date.now()-(m.createdAt||0))>300000)return;
    if(window.toast)window.toast('🆕 New Match: '+(m.name||'Tournament')+' added!','ok');
    window.db.ref('users/'+uid+'/notifications').push({title:'🆕 New Match!',message:'"'+(m.name||'Match')+'" add hua! Entry:💎'+(m.entryFee||0)+' Prize:₹'+(m.prizePool||0),type:'new_match',read:false,createdAt:Date.now()});
  });
  setTimeout(function(){_ready=true;},4000);
  setTimeout(function(){
    if(!window.UD)return;
    if(window.UD.lastCheckIn!==new Date().toDateString())
      if(window.toast)window.toast('🎁 Daily bonus available! Check-in karo.','inf');
  },9000);
},60);

/* ════════════════════════════════════════════
   ✨ RECENTLY WON FEED
════════════════════════════════════════════ */
waitFor(function(){return window.db&&window.renderHome;},function(){
  if(window._wonFeedHooked)return;window._wonFeedHooked=true;
  function loadFeed(){
    var el=document.getElementById('recentWonFeed');if(!el)return;
    window.db.ref('joinRequests').orderByChild('resultStatus').equalTo('completed').limitToLast(30).once('value',function(s){
      if(!s.exists()){el.style.display='none';return;}
      var winners=[];
      s.forEach(function(c){var jr=c.val();if(jr.reward&&jr.reward>0&&jr.userName)winners.push(jr);});
      winners.sort(function(a,b){return(b.completedAt||b.timestamp||0)-(a.completedAt||a.timestamp||0);});
      if(!winners.length){el.style.display='none';return;}
      el.style.display='';
      var h='<div style="margin-bottom:10px"><div style="font-size:11px;font-weight:800;color:var(--txt2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">🏆 Recently Won</div>';
      h+='<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch">';
      winners.slice(0,8).forEach(function(jr){
        var name=(jr.userName||'Player').slice(0,10);
        var mins=Math.floor((Date.now()-(jr.completedAt||jr.timestamp||Date.now()))/60000);
        var tStr=mins<60?mins+'m ago':Math.floor(mins/60)+'h ago';
        h+='<div style="min-width:90px;background:linear-gradient(135deg,rgba(0,255,156,.06),rgba(255,215,0,.03));border:1px solid rgba(0,255,156,.15);border-radius:12px;padding:10px;flex-shrink:0;text-align:center">';
        h+='<div style="font-size:18px;margin-bottom:3px">🏆</div>';
        h+='<div style="font-size:10px;font-weight:700;color:var(--txt)">'+name+'</div>';
        h+='<div style="font-size:13px;font-weight:900;color:#00ff9c">₹'+jr.reward+'</div>';
        h+='<div style="font-size:9px;color:var(--txt2)">'+tStr+'</div>';
        h+='</div>';
      });
      h+='</div></div>';
      el.innerHTML=h;
    });
  }
  var origRH=window.renderHome;
  window.renderHome=function(){
    origRH.apply(this,arguments);
    setTimeout(function(){
      var hl=document.getElementById('homeList');if(!hl)return;
      if(!document.getElementById('recentWonFeed')){
        var d=document.createElement('div');d.id='recentWonFeed';d.style.cssText='display:none;padding:0 0 4px';
        hl.parentNode.insertBefore(d,hl);
      }
      loadFeed();
    },500);
  };
  setTimeout(function(){
    var hl=document.getElementById('homeList');if(!hl)return;
    if(!document.getElementById('recentWonFeed')){
      var d=document.createElement('div');d.id='recentWonFeed';d.style.cssText='display:none;padding:0 0 4px';
      hl.parentNode.insertBefore(d,hl);
    }
    loadFeed();
  },3500);
  setInterval(loadFeed,60000);
},60);

/* ════════════════════════════════════════════
   ✨ WHATSAPP/TELEGRAM MATCH SHARE
════════════════════════════════════════════ */
window.shareMatchWhatsApp=function(matchId,matchName,prize){
  var code=(window.UD&&window.UD.referralCode)||'MINI';
  var link=(window.location&&window.location.origin||'https://mini-esports.app')+'/index.html?ref='+code;
  var msg='🎮 मैंने MINI ESPORT पर "'+(matchName||'match')+'" join की!\n💰 Prize Pool: ₹'+(prize||0)+'\n🔥 तुम भी join करो!\n📲 '+link+'\n🎁 Code: '+code+' (Dono को 🪙 bonus)';
  var h='<div>';
  h+='<div style="background:rgba(0,0,0,.4);border-radius:12px;padding:12px;margin-bottom:14px;font-size:12px;color:var(--txt2);line-height:1.8;white-space:pre-wrap">'+msg+'</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">';
  h+='<a href="https://wa.me/?text='+encodeURIComponent(msg)+'" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#25d366,#128c7e);color:#fff;font-weight:700;font-size:12px;text-decoration:none"><i class="fab fa-whatsapp"></i> WhatsApp</a>';
  h+='<a href="https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(msg)+'" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border-radius:12px;background:linear-gradient(135deg,#0088cc,#005fa3);color:#fff;font-weight:700;font-size:12px;text-decoration:none"><i class="fab fa-telegram"></i> Telegram</a>';
  h+='</div>';
  h+='<button onclick="(function(){var m='+JSON.stringify(msg)+';if(navigator.share)navigator.share({title:\'Mini eSports\',text:m}).catch(function(){});else if(navigator.clipboard)navigator.clipboard.writeText(m).then(function(){if(window.toast)toast(\'Copied!\',\'ok\')})})()" style="width:100%;padding:11px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-weight:700;font-size:12px;cursor:pointer"><i class="fas fa-share-alt"></i> More Options</button>';
  h+='</div>';
  if(window.openModal)window.openModal('📢 Share Match',h);
};

/* ════════════════════════════════════════════
   STYLES
════════════════════════════════════════════ */
var _s=document.createElement('style');
_s.textContent='@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}'+
  '#recentWonFeed>div>div:last-child::-webkit-scrollbar{display:none}'+
  '.rank-row{transition:background .2s}'+
  '#inviteEarnBtn:active{opacity:.85}';
document.head.appendChild(_s);

console.log('[Mini eSports] ✅ fixes-v7 v3 — Rank INSTANT cache, 8 bugs fixed, 5 features');
})();
