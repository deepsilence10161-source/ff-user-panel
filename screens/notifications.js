/* ====== NOTIFICATIONS ====== */
/* ══ R6 TEAM AUTHORIZATION ══
   _respondTeamInvite(matchId, accept) — invited member apni pending
   team_invitation accept/decline karta hai (server-authoritative consent).
   sirf member_uid == auth.uid() wali row respond hoti hai — koi bhi
   किसी और की invitation change nahi kar sakta (server double-checks). */
window._respondTeamInvite = function (matchId, accept) {
  if (!window.U || !window.U.uid || !window._supa) { if (window.toast) toast('Login karo pehle', 'err'); return; }
  window._supa.from('team_invitations')
    .select('id').eq('match_id', matchId).eq('member_uid', window.U.uid).eq('status', 'pending')
    .maybeSingle()
    .then(function (r) {
      if (r && r.error) { if (window.toast) toast('Invitation load nahi hui', 'err'); return; }
      if (!r.data) { if (window.toast) toast('Pending invitation nahi mili', 'inf'); return; }
      return window._supa.rpc('respond_team_invite', { p_invite_id: r.data.id, p_accept: accept });
    })
    .then(function (rr) {
      if (!rr) return;
      var d = rr && rr.data;
      if ((rr && rr.error) || (d && d.ok === false)) {
        if (window.toast) toast('Error: ' + ((d && d.error) || 'response failed'), 'err');
        return;
      }
      if (window.toast) toast(accept ? '✅ Team invite accept ho gayi! Captain ab join kar sakta hai.' : 'Invite decline ho gayi.', 'ok');
      if (window.renderNotifs) renderNotifs();
    })
    .catch(function (e) { if (window.toast) toast('Response failed', 'err'); });
};

function toggleAchievements() {  var ac = document.getElementById('achContent');
  var ch = document.getElementById('achChevron');
  if (!ac) return;
  var isOpen = ac.style.display !== 'none';
  ac.style.display = isOpen ? 'none' : 'block';
  if (ch) ch.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function renderNotifs() {
  var nl = $('notifList'); if (!nl) return;
  /* ✅ R28k (2026-09-22): DB me same notification double-INSERTED rehta
     hai (admin-side dual-write — same body+ref_id ~300-400ms apart; live
     proven Supabase rows me: "🏆 Match Result!"/"💬 Support Reply" sab
     pairs me). User-panel display dedup karta hai. SAFETY: sirf
     NEAR-duplicates collapse hote hain — same type+title+body AND
     createdAt 3s ke andar (asli double-write signature ~300-400ms).
     Alag matches ke same-text legit notifs (alg time par) safe rehte
     hain. Data delete nahi hota — sirf display. Backend dual-write
     alag issue hai (admin repo fix). */
  try {
    var _sorted = (NOTIFS || []).slice().sort(function(a, b) {
      return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
    });
    var _kept = [];
    _sorted.forEach(function(n) {
      var fp = String(n.type || '') + '|' + String(n.title || '') + '|' + String(n.message || n.body || '');
      fp = fp.replace(/\s+/g, ' ').trim().slice(0, 200);
      var ts = Number(n.createdAt) || 0;
      var dup = false;
      if (fp) {
        for (var i = 0; i < _kept.length; i++) {
          var k = _kept[i];
          if (k._fp === fp && Math.abs(ts - (Number(k.createdAt) || 0)) <= 3000) { dup = true; break; }
        }
      }
      if (!dup) { n._fp = fp; _kept.push(n); }
    });
    NOTIFS = _kept;
  } catch (e) { /* dedup best-effort — render as-is if anything throws */ }
  if (!NOTIFS.length) { nl.innerHTML = '<div class="empty-state"><i class="fas fa-bell"></i><p>No notifications</p></div>'; if (window.updateBell) updateBell(); return; }
  // Mark ALL as read when panel opens
  if (U && UD) {
    var toMark = {};
    NOTIFS.forEach(function(n) {
      if (!n._key) return;
      n._localRead = true;
      _READ_KEYS[n._key] = true;
      toMark[n._key] = true;
    });
    if (!UD.readNotifications) UD.readNotifications = {};
    Object.assign(UD.readNotifications, toMark);
    if (Object.keys(toMark).length) {
      /* Supabase handles read status via markNotifRead */
      Object.keys(toMark).forEach(function(k) { if (window.markNotifRead) markNotifRead(k); });
      // localStorage cache
      try {
        var _lsAll = JSON.parse(localStorage.getItem('_mes_read_' + U.uid) || '{}');
        Object.assign(_lsAll, toMark);
        localStorage.setItem('_mes_read_' + U.uid, JSON.stringify(_lsAll));
      } catch(e) {}
    }
    setTimeout(updateBell, 100);
  }
  var rd = (UD && UD.readNotifications) || {}, h = '';
  /* ✅ D95 (2026-11-09, owner live report): notification UI stylish redesign —
     gradient glass cards, type-colored glow icon tiles, time/match chips. */
  // Filter out system-type notifications that shouldn't be shown in list
  var HIDDEN_TYPES = ['back_online', 'online', 'profile_approved', 'profile_update_approved', 'system'];
  var visibleNotifs = NOTIFS.filter(function(n) { return HIDDEN_TYPES.indexOf(n.type) === -1; });
  // Header row: count + Clear All
  h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
  h += '<span style="display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:800;color:#8b93a0;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);padding:5px 12px;border-radius:20px"><i class="fas fa-bell" style="color:#ffd700;font-size:10px"></i> ' + visibleNotifs.length + ' notifications</span>';
  h += '<button onclick="clearAllNotifs()" style="background:linear-gradient(120deg,rgba(255,80,80,.16),rgba(255,80,80,.08));border:1px solid rgba(255,80,80,.3);color:#ff6b6b;font-size:11px;font-weight:800;padding:6px 14px;border-radius:20px;cursor:pointer"><i class="fas fa-trash"></i> Clear All</button>';
  h += '</div>';
  if (!visibleNotifs.length) {
    h += '<div style="text-align:center;padding:44px 16px;color:#8b93a0"><div style="width:64px;height:64px;margin:0 auto 12px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;background:linear-gradient(140deg,rgba(255,215,0,.12),rgba(255,140,0,.08));border:1px solid rgba(255,215,0,.22)"><i class="fas fa-bell" style="color:#ffd700"></i></div><p style="font-size:13px;font-weight:700;color:#cdd3dc">Koi notification nahi</p><p style="font-size:11px;margin-top:3px">Naye matches, results aur rewards yahan dikhenge</p></div>';
  }
  visibleNotifs.forEach(function(n) {
    var unread = false; // All shown as read since we just marked them
    /* type → accent color */
    var col = '#ffd700';
    if (n.type === 'room_released' || n.type === 'wallet_approved' || n.type === 'withdraw_done' || n.type === 'match_completed' || n.type === 'result') col = '#00ff9c';
    else if (n.type === 'new_match' || n.type === 'match_starting') col = '#00d4ff';
    else if (n.type === 'chat_reply' || n.type === 'team_invite') col = '#b964ff';
    else if (n.type === 'wallet_rejected' || n.type === 'withdraw_rejected') col = '#ff5555';
    var colRgb = col === '#00ff9c' ? '0,255,156' : col === '#00d4ff' ? '0,212,255' : col === '#b964ff' ? '185,100,255' : col === '#ff5555' ? '255,85,85' : '255,215,0';
    h += '<div class="notif-card' + (unread ? ' unread' : '') + '" onclick="openNotif(\'' + n._key + '\')" style="position:relative;display:flex;gap:11px;align-items:flex-start;padding:12px 40px 12px 12px;margin-bottom:9px;border-radius:16px;cursor:pointer;' +
         'background:linear-gradient(120deg,rgba(' + colRgb + ',.09),rgba(255,255,255,.025) 55%);border:1px solid rgba(' + colRgb + ',.22)">' +
         '<span style="position:absolute;left:0;top:12px;bottom:12px;width:3px;border-radius:0 3px 3px 0;background:linear-gradient(180deg,' + col + ',rgba(' + colRgb + ',.25))"></span>';
    h += '<div style="width:38px;height:38px;flex-shrink:0;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:15px;background:rgba(' + colRgb + ',.14);border:1px solid rgba(' + colRgb + ',.35);box-shadow:0 0 12px rgba(' + colRgb + ',.18);color:' + col + '"><i class="fas ' + (n.faIcon || 'fa-bell') + '"></i></div>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:13px;font-weight:800;color:var(--txt);line-height:1.3;padding-right:4px">' + (window.escHtml?window.escHtml(n.title||'Notification'):(n.title||'Notification')) + '</div>';
    h += '<div style="font-size:12px;color:#aab3c0;margin-top:3px;line-height:1.45;word-break:break-word">' + (window.escHtml?window.escHtml(n.message||''):(n.message||'')) + '</div>';
    h += '<div style="display:flex;align-items:center;gap:6px;margin-top:7px;flex-wrap:wrap">';
    h += '<span style="font-size:10px;font-weight:700;color:#8b93a0;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);padding:2px 9px;border-radius:8px"><i class="far fa-clock" style="font-size:9px"></i> ' + timeAgo(n.createdAt) + '</span>';
    if (n.matchName) h += '<span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:8px;background:rgba(185,100,255,.1);border:1px solid rgba(185,100,255,.28);color:#c99aff">' + (window.escHtml?window.escHtml(n.matchName):n.matchName) + '</span>';
    h += '</div>';
    /* ══ R6 TEAM AUTHORIZATION ══
       team_invite notification पर member Accept/Decline करता है (voice consent).
       Accept = server respond_team_invite (member JWT) → captain ka join ab
       authorize hota hai. Client-side कोई wallet/slot write नहीं — सिर्फ़ consent इंटेंट। */
    if (n.type === 'team_invite' && n.matchId) {
      h += '<div style="display:flex;gap:8px;margin-top:9px"><button onclick="event.stopPropagation();window._respondTeamInvite&&_respondTeamInvite(\'' + n.matchId + '\', true)" style="flex:1;padding:8px 10px;border-radius:11px;border:1px solid rgba(0,255,156,.35);background:rgba(0,255,156,.14);color:#00ff9c;font-size:11px;font-weight:800;cursor:pointer">✓ Accept</button>'
        + '<button onclick="event.stopPropagation();window._respondTeamInvite&&_respondTeamInvite(\'' + n.matchId + '\', false)" style="flex:1;padding:8px 10px;border-radius:11px;border:1px solid rgba(255,80,80,.35);background:rgba(255,80,80,.12);color:#ff6b6b;font-size:11px;font-weight:800;cursor:pointer">✗ Decline</button></div>';
    }
    h += '</div>';
    // Delete button right side
    h += '<button onclick="event.stopPropagation();deleteNotif(\'' + n._key + '\',\'' + (n._srcUser ? 'user' : 'global') + '\')" aria-label="Notification hatao" style="position:absolute;top:10px;right:10px;background:rgba(255,80,80,.1);border:1px solid rgba(255,80,80,.22);color:#ff6b6b;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-times"></i></button>';
    h += '</div>';
  });
  nl.innerHTML = h;
}
function deleteNotif(key, src) {
  // Persist deleted key so poll/realtime never resurrects it
  if (key) {
    var d = {}; d[key] = true;
    if (window._saveDeletedNotifKeys) window._saveDeletedNotifKeys(d);
  }
  // Remove from local NOTIFS
  NOTIFS = NOTIFS.filter(function(n) { return n._key !== key; });
  _READ_KEYS[key] = true;
  if (U && window._supa) { window._supa.from('notifications').delete().eq('id', key).eq('user_id', U.uid).then(null, function(){}); }
  updateBell();
  renderNotifs();
}
/* ✅ DEDUP (P2 refactor): clearAllNotifs yahan duplicate tha — asli LIVE version
   core/listeners.js mein hai (window.clearAllNotifs = clearAllNotifs, line ~830),
   jo Supabase bulk-mark-read + toast deta hai aur is file ke baad load hota hai,
   isliye yah bare copy hamesha shadow ho jaati thi (never ran). Button onclick
   "clearAllNotifs()" bhi global resolve karta hai → listeners.js version hi chalta hai. */
function openNotif(key) {
  if (window.markNotifRead) markNotifRead(key);
  // Mark locally and in persistent set
  _READ_KEYS[key] = true;
  NOTIFS.forEach(function(n) { if (n._key === key) n._localRead = true; });
  if (!UD.readNotifications) UD.readNotifications = {};
  UD.readNotifications[key] = true;
  // ✅ FIX: localStorage mein bhi save karo taaki badge baar baar na aaye
  try {
    var _lsRead = JSON.parse(localStorage.getItem('_mes_read_' + U.uid) || '{}');
    _lsRead[key] = true;
    localStorage.setItem('_mes_read_' + U.uid, JSON.stringify(_lsRead));
  } catch(e) {}
  updateBell();
  var n = null; NOTIFS.forEach(function(x) { if (x._key === key) n = x; }); if (!n) return;
  var h = '<div style="text-align:center;font-size:36px;margin-bottom:12px"><i class="fas ' + (n.faIcon || 'fa-bell') + '"></i></div>';
  h += '<div style="font-size:16px;font-weight:700;text-align:center;margin-bottom:4px">' + (window.escHtml?window.escHtml(n.title||'Notification'):(n.title||'Notification')) + '</div>';
  h += '<div style="font-size:13px;color:var(--txt2);text-align:center;margin-bottom:14px">' + timeAgo(n.createdAt) + '</div>';
  h += '<div style="font-size:14px;line-height:1.6;color:var(--txt)">' + (window.escHtml?window.escHtml(n.message||''):(n.message||'')) + '</div>';
  if (n.matchId && n.type === 'room_released') {
    var t = MT[n.matchId];
    /* ✅ R3 (2026-09-20): creds MT me nahi hote (room-leak fix) —
       released + joined par RPC-fetch button, warna cached creds box. */
    if (t && t.roomStatus === 'released' && hasJ(n.matchId)) {
      if (t.roomId && t.roomPassword) {
        h += '<div class="room-box rb-green" style="margin-top:14px"><div style="font-size:11px;color:var(--txt2);text-transform:uppercase;margin-bottom:4px">Room ID</div><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:20px;font-weight:900">' + t.roomId + '</span><button onclick="copyTxt(String(t.roomId||\'\'))" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div>';
        h += '<div style="font-size:11px;color:var(--txt2);text-transform:uppercase;margin-top:8px;margin-bottom:4px">Password</div><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:20px;font-weight:900">' + t.roomPassword + '</span><button onclick="copyTxt(String(t.roomPassword||\'\'))" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div></div>';
      } else {
        h += '<button onclick="_showRoomViaRpc(\'' + n.matchId + '\', this)" style="width:100%;margin-top:14px;background:rgba(0,255,106,.12);border:1px solid rgba(0,255,106,.35);color:var(--green);padding:10px;border-radius:10px;font-weight:800;cursor:pointer"><i class="fas fa-key"></i> 🔑 Room Details dekho</button>';
      }
    }
  }
  openModal('Notification', h);
}
/* ========================================
   COIN SHOP — Manual UPI flow
   ======================================== */
function showCoinShop() {
  var modal = document.getElementById('coinShopModal');
  if (modal) {
    modal.style.display = 'flex';
    try { history.pushState(null, null, null); } catch(e) {}
  }
}
function closeCoinShop() {
  var modal = document.getElementById('coinShopModal');
  if (modal) modal.style.display = 'none';
}

/* Bug #33 Fix: Close coin shop on overlay click */
(function() {
  function _addCoinShopOverlayClose() {
    var modal = document.getElementById('coinShopModal');
    if (!modal) { setTimeout(_addCoinShopOverlayClose, 1000); return; }
    if (modal._overlayClickBound) return;
    modal._overlayClickBound = true;
    modal.addEventListener('click', function(e) {
      /* Only close if clicking the backdrop (not inner content) */
      if (e.target === modal) closeCoinShop();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _addCoinShopOverlayClose);
  } else {
    setTimeout(_addCoinShopOverlayClose, 500);
  }
})();
function buyCoinPkg(price, coins, pkg) {
  // Coins are FREE — no UPI purchase. Redirect to earn methods.
  showCoinShop();
  /* ✅ Bug 18 Fix: Clearly differentiate Coins (free) vs Sky Diamonds (paid) */
  toast('🪙 Coins = FREE: Watch Ad, Daily Check-In, Referral se kamao | 💎 Sky Diamonds = Real money se kharido (Wallet > Buy)', 'ok');
}

/* ====== ANTI-SPAM HOOK ALIASES ======
   Anti-spam features hook into these window.* names.
   Mapping them to actual app functions.
*/
window.doJoin = window.doJoin || doJoin;
window.submitWithdrawal = window.submitWithdrawal || submitWd;
window.submitCoinRequest = window.submitCoinRequest || buyCoinPkg;
window.sendChatMessage = window.sendChatMessage || sendChat;
window.submitResult = window.submitResult || function(matchId, data) {
  // Called when result screenshot is submitted
  if (data && data.screenshotUrl) {
    wfScreenshot = data.screenshotUrl;
  }
};
