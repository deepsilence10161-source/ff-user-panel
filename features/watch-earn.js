/* ================================================================
   WATCH & EARN SPECTATOR — watch-earn.js
   
   Live match dekhte waqt coins milte hain
   Every 5 min watching = +2 coins (admin configurable)
   Daily limit: 30 min max watching
   
   Firebase:
   matches/{matchId}/spectators/{uid}: { joinedAt, lastPing }
   users/{uid}/watchEarnings/{date}: { totalMins, totalCoins }
   ================================================================ */

(function() {
'use strict';

var _watchInterval = null;
var _watchMatchId  = null;
var _watchStart    = null;
var _pingInterval  = null;

/* ── Start Watching ── */
window.startWatching = function(matchId) {
  if (!window.db || !window.U) { toast('Login karo pehle', 'err'); return; }
  if (_watchMatchId === matchId) { toast('Pehle se dekh rahe ho! 👀', 'inf'); return; }

  var t = window.MT && window.MT[matchId];
  if (!t) { toast('Match nahi mila', 'err'); return; }
  if (!t.streamLink && !t.youtubeLink) { toast('Is match ka live stream available nahi hai', 'inf'); return; }

  // Check daily limit
  var today = new Date().toDateString().replace(/ /g,'_');
  window.db.ref('users/' + window.U.uid + '/watchEarnings/' + today).once('value', function(snap) {
    var earned = snap.val() || { totalMins: 0, totalCoins: 0 };
    var dailyLimit = (window.CFG && window.CFG.watchDailyLimitMins) || 30;
    var coinsPerInterval = (window.CFG && window.CFG.watchCoinsPerInterval) || 2;
    var intervalMins = (window.CFG && window.CFG.watchIntervalMins) || 5;

    if (earned.totalMins >= dailyLimit) {
      toast('Aaj ki daily limit ' + dailyLimit + ' min ho gayi! Kal dobara aao 🌙', 'inf');
      return;
    }

    _watchMatchId = matchId;
    _watchStart   = Date.now();

    // Register as spectator
    window.db.ref('matches/' + matchId + '/spectators/' + window.U.uid).set({
      uid:      window.U.uid,
      ign:      (window.UD && window.UD.ign) || 'Spectator',
      joinedAt: Date.now(),
      lastPing: Date.now()
    });

    // Update spectator count
    window.db.ref('matches/' + matchId + '/spectatorCount').transaction(function(v) {
      return (v||0) + 1;
    });

    // Show watch UI
    showWatchUI(matchId, t, dailyLimit - earned.totalMins, coinsPerInterval, intervalMins);

    // Ping every 30 sec to verify still watching
    _pingInterval = setInterval(function() {
      if (!_watchMatchId) { clearInterval(_pingInterval); return; }
      window.db.ref('matches/' + _watchMatchId + '/spectators/' + window.U.uid + '/lastPing').set(Date.now());
    }, 30000);

    // Coin reward timer
    var msInterval = intervalMins * 60000;
    _watchInterval = setInterval(function() {
      if (!_watchMatchId) { clearInterval(_watchInterval); return; }
      var todayKey = new Date().toDateString().replace(/ /g,'_');
      window.db.ref('users/' + window.U.uid + '/watchEarnings/' + todayKey).transaction(function(v) {
        var d = v || { totalMins: 0, totalCoins: 0 };
        if (d.totalMins >= dailyLimit) return; // Limit reached
        d.totalMins  += intervalMins;
        d.totalCoins += coinsPerInterval;
        return d;
      });
      window.db.ref('users/' + window.U.uid + '/coins').transaction(function(v) {
        return (v||0) + coinsPerInterval;
      });
      /* ✅ Sync to Supabase */
      if (window._supa && window.U) {
        window._supa.rpc('increment_balance', { p_uid: window.U.uid, p_col: 'coins', p_amount: coinsPerInterval }).catch(function(){});
        window._supa.from('wallet_transactions').insert({ user_id: window.U.uid, currency: 'coins', txn_type: 'credit', amount: coinsPerInterval, reason: 'watch_earn' }).catch(function(){});
      }
      if (window.UD) { window.UD.coins = (window.UD.coins||0) + coinsPerInterval; if (window.updateHdr) updateHdr(); }
      toast('+' + coinsPerInterval + '🪙 Watch bonus mila!', 'ok');
      if (window.updateHdr) window.updateHdr();

      // Update watch UI counter
      var el = document.getElementById('watchCoinsEarned');
      if (el) el.textContent = (parseInt(el.textContent||0) + coinsPerInterval);
    }, msInterval);

    toast('👀 Watch karna shuru! Har ' + intervalMins + ' min mein +' + coinsPerInterval + '🪙', 'ok');
  });
};

/* ── Watch UI Overlay ── */
function showWatchUI(matchId, t, minsLeft, coinsPerInterval, intervalMins) {
  // Remove existing
  var existing = document.getElementById('watchEarnBar');
  if (existing) existing.remove();

  var bar = document.createElement('div');
  bar.id = 'watchEarnBar';
  bar.style.cssText = 'position:fixed;bottom:70px;left:0;right:0;z-index:8888;padding:0 12px';

  var streamUrl = t.streamLink || t.youtubeLink || '#';
  var elapsed = 0;

  bar.innerHTML = '<div style="background:linear-gradient(135deg,#1a0d2e,#0d1a2e);border:1.5px solid rgba(185,100,255,.3);border-radius:14px;padding:12px 14px;display:flex;align-items:center;gap:10px;backdrop-filter:blur(10px)">' +
    '<div style="width:8px;height:8px;border-radius:50%;background:#ff4444;animation:pulse 1s infinite;flex-shrink:0"></div>' +
    '<div style="flex:1;min-width:0">' +
      '<div style="font-size:12px;font-weight:800;color:#b964ff">👀 LIVE Watch & Earn</div>' +
      '<div style="font-size:10px;color:var(--txt2);margin-top:1px">Har ' + intervalMins + ' min = +' + coinsPerInterval + '🪙 • <span id="watchTimeLeft">' + minsLeft + ' min baaki</span></div>' +
    '</div>' +
    '<div style="text-align:right;flex-shrink:0">' +
      '<div style="font-size:16px;font-weight:900;color:#ffd700">+<span id="watchCoinsEarned">0</span>🪙</div>' +
      '<div style="font-size:10px;color:var(--txt2)">earned</div>' +
    '</div>' +
    '<a href="' + streamUrl + '" target="_blank" style="padding:7px 12px;border-radius:10px;background:linear-gradient(135deg,#ff0000,#cc0000);border:none;color:#fff;font-size:11px;font-weight:800;text-decoration:none;flex-shrink:0"><i class="fab fa-youtube"></i> Watch</a>' +
    '<button onclick="stopWatching()" style="padding:7px 10px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:var(--txt2);font-size:11px;cursor:pointer">✕</button>' +
  '</div>';

  document.body.appendChild(bar);
}

/* ── Stop Watching ── */
window.stopWatching = function() {
  if (!_watchMatchId) return;
  clearInterval(_watchInterval);
  clearInterval(_pingInterval);

  if (window.db && window.U) {
    window.db.ref('matches/' + _watchMatchId + '/spectators/' + window.U.uid).remove();
    window.db.ref('matches/' + _watchMatchId + '/spectatorCount').transaction(function(v) {
      return Math.max((v||0) - 1, 0);
    });
  }
  _watchMatchId = null;
  _watchStart   = null;

  var bar = document.getElementById('watchEarnBar');
  if (bar) bar.remove();
  toast('Watch session end. Kal dobara aana! 👋', 'inf');
};

/* ── Spectator Count Display ── */
window.renderSpectatorCount = function(matchId) {
  if (!window.db) return '';
  var count = 0;
  // Get from match data if available
  var mt = window.MT && window.MT[matchId];
  if (mt && mt.spectatorCount) count = mt.spectatorCount;
  if (!count) return '';
  return '<span style="font-size:10px;color:#ff4444;font-weight:700"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff4444;margin-right:3px;vertical-align:middle"></span>' + count + ' watching</span>';
};

/* ── Show Live Matches to Spectate ── */
window.showLiveSpectateList = function() {
  /* Load live matches from Supabase */
  if (window._supa) {
    window._supa.from('matches').select('id,title,mode,status,banner_url').eq('status','live').limit(10)
      .then(function(r) {
        var live = (r.data||[]).map(function(m) { return { id: m.id, d: { name: m.title, mode: m.mode, bannerUrl: m.banner_url, streamLink: '', youtubeLink: '' } }; });
        if (window.renderLiveSpectateList) renderLiveSpectateList(live);
      }).catch(function(){});
    return;
  }
  if (!window.db) return;
  window.db.ref('matches').orderByChild('status').equalTo('live').once('value', function(snap) {
    var live = [];
    snap.forEach(function(c) {
      var d = c.val();
      if (d.streamLink || d.youtubeLink) {
        live.push({ id: c.key, d: d });
      }
    });

    var h = '';
    if (!live.length) {
      h = '<div style="text-align:center;padding:24px"><div style="font-size:32px;margin-bottom:8px">📺</div><div style="color:var(--txt2)">Abhi koi live match nahi — jab match live ho tab yahan dikhega</div></div>';
    } else {
      h = '<div style="display:flex;flex-direction:column;gap:10px">';
      live.forEach(function(m) {
        var count = m.d.spectatorCount || 0;
        h += '<div style="background:rgba(255,0,0,.04);border:1px solid rgba(255,0,0,.15);border-radius:14px;padding:12px;display:flex;align-items:center;gap:12px">';
        h += '<div style="width:8px;height:8px;border-radius:50%;background:#ff4444;animation:pulse 1s infinite;flex-shrink:0"></div>';
        h += '<div style="flex:1"><div style="font-size:13px;font-weight:800">' + (m.d.name||'Match') + '</div>';
        h += '<div style="font-size:11px;color:var(--txt2);margin-top:2px">' + count + ' watching • ' + (m.d.gameMode||'BR') + '</div></div>';
        h += '<button onclick="startWatching(\'' + m.id + '\')" style="padding:8px 14px;border-radius:10px;background:linear-gradient(135deg,#ff4444,#cc0000);border:none;color:#fff;font-size:12px;font-weight:800;cursor:pointer">👀 Watch</button>';
        h += '</div>';
      });
      h += '</div>';
    }
    if (window.openModal) openModal('📺 Live Matches', h);
  });
};

})();
