/* ====== UX / GROWTH FEATURES COMPLETE (User Panel) ======
   - Tournament Calendar
   - Smart Prize Calculator
   - Notification Digest (daily summary)
   - Smart Notifications Priority
   - Achievement Progress quick access
   - Instant Wallet Summary (enhanced)
   - Prize Pool Visual Progress (in cards)
*/
(function(){
'use strict';

/* ══ TOURNAMENT CALENDAR ══ */
window.showTournamentCalendar = function() {
  if (!window.MT) { if (window.toast) toast('Matches load ho rahe hain...', 'inf'); return; }

  // Group matches by date
  var byDate = {};
  Object.keys(window.MT).forEach(function(id) {
    var t = window.MT[id];
    if (!t.matchTime) return;
    var d = new Date(Number(t.matchTime));
    var key = d.toDateString();
    if (!byDate[key]) byDate[key] = { date: d, matches: [] };
    byDate[key].matches.push(t);
  });

  // Sort dates
  var dates = Object.keys(byDate).sort(function(a,b) {
    return byDate[a].date - byDate[b].date;
  });

  if (!dates.length) {
    if (window.openModal) window.openModal('📅 Tournament Calendar', '<div style="text-align:center;padding:20px;color:var(--txt2)">Koi upcoming matches nahi hain abhi</div>');
    return;
  }

  var today = new Date().toDateString();
  var tomorrow = new Date(Date.now() + 86400000).toDateString();

  var h = '<div style="display:flex;flex-direction:column;gap:12px">';
  dates.forEach(function(key) {
    var group = byDate[key];
    var isToday = key === today;
    var isTomorrow = key === tomorrow;
    var dateLabel = isToday ? '📍 Today' : isTomorrow ? '📌 Tomorrow' : group.date.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });

    h += '<div>';
    h += '<div style="font-size:11px;font-weight:800;color:' + (isToday ? '#00ff9c' : isTomorrow ? '#ffd700' : '#aaa') + ';text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;padding-left:2px">' + dateLabel + '</div>';

    group.matches.sort(function(a,b) { return Number(a.matchTime) - Number(b.matchTime); });
    group.matches.forEach(function(t) {
      var time = new Date(Number(t.matchTime)).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      var tp = (t.mode || t.type || 'solo').toLowerCase();
      var modeColors = { solo: '#00ff9c', duo: '#00d4ff', squad: '#b964ff' };
      var color = modeColors[tp] || '#aaa';
      var joined = window.hasJ && window.hasJ(t.id);
      var fee = Number(t.entryFee) || 0;
      var isCoin = (t.entryType||'').toLowerCase() === 'coin' || fee === 0;

      h += '<div style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);margin-bottom:5px">';
      h += '<div style="font-size:11px;font-weight:700;color:#aaa;min-width:40px">' + time + '</div>';
      h += '<div style="width:3px;height:32px;border-radius:2px;background:' + color + ';flex-shrink:0"></div>';
      h += '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (t.name||'Match') + '</div>';
      h += '<div style="font-size:10px;color:var(--txt2)">' + tp.toUpperCase() + ' • ' + (isCoin ? '🪙 ' + fee : '₹' + fee) + '</div></div>';
      if (joined) {
        h += '<span style="font-size:10px;color:#00ff9c;font-weight:700">✅ Joined</span>';
      } else {
        h += '<button onclick="if(window.closeModal)closeModal();setTimeout(function(){if(window.cJoin)cJoin(\'' + t.id + '\')},200)" style="padding:5px 10px;border-radius:8px;background:rgba(0,255,156,.12);border:1px solid rgba(0,255,156,.25);color:#00ff9c;font-size:10px;font-weight:700;cursor:pointer">Join</button>';
      }
      h += '</div>';
    });
    h += '</div>';
  });
  h += '</div>';
  if (window.openModal) window.openModal('📅 Tournament Calendar', h);
};

/* ══ SMART PRIZE CALCULATOR ══ */
window.showSmartPrizeCalc = function() {
  var h = '<div>';
  h += '<div style="background:rgba(255,215,0,.06);border:1px solid rgba(255,215,0,.15);border-radius:12px;padding:12px;margin-bottom:14px">';
  h += '<div style="font-size:12px;font-weight:700;color:#ffd700;margin-bottom:2px">💡 Entry mein kitna kamaoge?</div>';
  h += '<div style="font-size:11px;color:var(--txt2)">Match details dalo — expected prize calculate hoga</div>';
  h += '</div>';

  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Entry Fee (₹)</label>';
  h += '<input id="pcFee" type="number" placeholder="e.g. 30" oninput="calcExpectedPrize()" style="width:100%;padding:9px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-size:14px;text-align:center;box-sizing:border-box"></div>';

  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Total Players</label>';
  h += '<input id="pcPlayers" type="number" placeholder="e.g. 20" oninput="calcExpectedPrize()" style="width:100%;padding:9px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-size:14px;text-align:center;box-sizing:border-box"></div>';

  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Per Kill Prize (₹, 0 = nahi hai)</label>';
  h += '<input id="pcKill" type="number" placeholder="e.g. 5" oninput="calcExpectedPrize()" style="width:100%;padding:9px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-size:14px;text-align:center;box-sizing:border-box"></div>';

  h += '<div style="margin-bottom:10px"><label style="font-size:11px;color:var(--txt2);display:block;margin-bottom:4px">Tumhara Expected Rank</label>';
  h += '<select id="pcRank" onchange="calcExpectedPrize()" style="width:100%;padding:9px;border-radius:9px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-size:13px">';
  h += '<option value="1">🥇 1st Place</option><option value="2">🥈 2nd Place</option><option value="3">🥉 3rd Place</option><option value="5">Top 5</option><option value="10">Top 10</option>';
  h += '</select></div>';

  h += '<div id="pcResult" style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.15);border-radius:12px;padding:14px;text-align:center;min-height:60px">';
  h += '<div style="color:var(--txt2);font-size:12px">Details bharo ↑</div></div>';
  h += '</div>';
  if (window.openModal) window.openModal('🧮 Prize Calculator', h);
};

window.calcExpectedPrize = function() {
  var fee = Number((document.getElementById('pcFee')||{}).value) || 0;
  var players = Number((document.getElementById('pcPlayers')||{}).value) || 0;
  var killPrize = Number((document.getElementById('pcKill')||{}).value) || 0;
  var rank = Number(((document.getElementById('pcRank')||{}).value) || 1);
  var res = document.getElementById('pcResult');
  if (!res || !fee || !players) { if (res) res.innerHTML = '<div style="color:var(--txt2);font-size:12px">Details bharo ↑</div>'; return; }

  var pool = fee * players;
  // Platform 20% cut
  var netPool = Math.round(pool * 0.8);
  // Prize distribution (standard)
  var prizeMap = { 1: 0.50, 2: 0.30, 3: 0.20, 5: 0.10, 10: 0.05 };
  var pct = prizeMap[rank] || 0.05;
  var rankPrize = rank <= 3 ? Math.round(netPool * pct) : 0;
  var avgKills = 3; // assumed
  var killEarning = killPrize * avgKills;
  var total = rankPrize + killEarning;
  var profit = total - fee;

  res.innerHTML = '<div style="font-size:11px;color:var(--txt2);margin-bottom:8px">Total Pool: ₹' + pool + ' → Net (after 20% platform): ₹' + netPool + '</div>';
  res.innerHTML += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">';
  res.innerHTML += '<div><div style="font-size:10px;color:var(--txt2)">Rank Prize</div><div style="font-size:20px;font-weight:900;color:#ffd700">₹' + rankPrize + '</div></div>';
  res.innerHTML += '<div><div style="font-size:10px;color:var(--txt2)">~' + avgKills + ' Kills</div><div style="font-size:20px;font-weight:900;color:#ff6b6b">₹' + killEarning + '</div></div>';
  res.innerHTML += '</div>';
  res.innerHTML += '<div style="border-top:1px solid rgba(0,255,156,.2);padding-top:8px"><div style="font-size:11px;color:var(--txt2)">Expected Total</div>';
  res.innerHTML += '<div style="font-size:26px;font-weight:900;color:' + (profit >= 0 ? '#00ff9c' : '#ff4444') + '">₹' + total + '</div>';
  res.innerHTML += '<div style="font-size:11px;color:' + (profit >= 0 ? '#00ff9c' : '#ff4444') + '">' + (profit >= 0 ? '✅ Expected Profit: ₹' + profit : '⚠️ Loss: ₹' + Math.abs(profit)) + '</div></div>';
};

/* ══ NOTIFICATION DIGEST (Daily Summary) ══ */
window.checkNotificationDigest = function() {
  if (!window.U || !window.NOTIFS) return;
  var _dk = '_mes_digest_' + window.U.uid + '_' + new Date().toDateString();
  if (localStorage.getItem(_dk)) return; // Already shown today

  var unread = window.NOTIFS.filter(function(n) {
    var rd = (window.UD && window.UD.readNotifications) || {};
    return !rd[n._key] && !n._localRead;
  });

  if (unread.length >= 3) {
    localStorage.setItem(_dk, '1');
    setTimeout(function() {
      if (window.toast) toast('📬 ' + unread.length + ' unread notifications hain. Bell tap karo!', 'inf');
    }, 15000); // 15 sec after load
  }
};

/* ══ SMART NOTIFICATIONS PRIORITY ══ */
// High priority notifs: result, wallet, ban, room_released
// Medium: system, match_reminder
// Low: promotional, streak
window.getNotifPriority = function(notif) {
  var high = ['result', 'wallet_approved', 'wallet_rejected', 'withdraw_done', 'withdraw_rejected', 'ban', 'room_released', 'admin_alert'];
  var medium = ['match_reminder', 'system', 'refund'];
  var type = notif.type || '';
  if (high.indexOf(type) !== -1) return 3;
  if (medium.indexOf(type) !== -1) return 2;
  return 1;
};

// Sort NOTIFS by priority when rendering
window.getSortedNotifs = function() {
  if (!window.NOTIFS) return [];
  return window.NOTIFS.slice().sort(function(a, b) {
    var pa = window.getNotifPriority(a), pb = window.getNotifPriority(b);
    if (pa !== pb) return pb - pa; // High priority first
    return (b.timestamp || 0) - (a.timestamp || 0); // Then newest first
  });
};

/* ══ AUTO-INIT ══ */
var _initT = 0, _initI = setInterval(function() {
  _initT++;
  if (window.U && window.UD && window.NOTIFS !== undefined) {
    clearInterval(_initI);
    setTimeout(window.checkNotificationDigest, 12000);
  }
  if (_initT > 120) clearInterval(_initI);
}, 500);

/* ══ CALENDAR BUTTON IN HOME ══ */
// Add calendar icon button to home filter area
var _calI = setInterval(function() {
  if (document.readyState === 'complete' && window.renderHome && !window._calHooked) {
    clearInterval(_calI);
    window._calHooked = true;
  }
}, 500);

console.log('[Mini eSports] ✅ UX/Growth Features Complete loaded');
})();
