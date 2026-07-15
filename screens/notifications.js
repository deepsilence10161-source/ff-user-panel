/* ====== NOTIFICATIONS ====== */
function toggleAchievements() {
  var ac = document.getElementById('achContent');
  var ch = document.getElementById('achChevron');
  if (!ac) return;
  var isOpen = ac.style.display !== 'none';
  ac.style.display = isOpen ? 'none' : 'block';
  if (ch) ch.style.transform = isOpen ? '' : 'rotate(180deg)';
}

function renderNotifs() {
  var nl = $('notifList'); if (!nl) return;
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
  // Clear All button at top
  h += '<div style="display:flex;justify-content:flex-end;margin-bottom:10px">';
  h += '<button onclick="clearAllNotifs()" style="background:rgba(255,50,50,.12);border:1px solid rgba(255,50,50,.25);color:#ff5555;font-size:11px;font-weight:700;padding:6px 14px;border-radius:10px;cursor:pointer"><i class="fas fa-trash"></i> Clear All</button>';
  h += '</div>';
  // Filter out system-type notifications that shouldn't be shown in list
  var HIDDEN_TYPES = ['back_online', 'online', 'profile_approved', 'profile_update_approved', 'system'];
  var visibleNotifs = NOTIFS.filter(function(n) { return HIDDEN_TYPES.indexOf(n.type) === -1; });
  if (!visibleNotifs.length) { h += '<div class="empty-state"><i class="fas fa-bell"></i><p>No notifications</p></div>'; }
  visibleNotifs.forEach(function(n) {
    var unread = false; // All shown as read since we just marked them
    var ic = 'ny'; // default yellow
    if (n.type === 'room_released') ic = 'ng';
    else if (n.type === 'new_match' || n.type === 'match_starting') ic = 'nb';
    else if (n.type === 'chat_reply') ic = 'np';
    else if (n.type === 'wallet_approved' || n.type === 'withdraw_done') ic = 'ng';
    else if (n.type === 'wallet_rejected' || n.type === 'withdraw_rejected') ic = 'nr';
    else if (n.type === 'match_completed' || n.type === 'result') ic = 'ng';
    h += '<div class="notif-card' + (unread ? ' unread' : '') + '" style="position:relative" onclick="openNotif(\'' + n._key + '\')">';
    h += '<div class="notif-icon ' + ic + '"><i class="fas ' + (n.faIcon || 'fa-bell') + '"></i></div>';
    h += '<div class="notif-body"><div class="notif-title">' + (window.escHtml?window.escHtml(n.title||'Notification'):(n.title||'Notification')) + '</div>';
    h += '<div class="notif-msg">' + (window.escHtml?window.escHtml(n.message||''):(n.message||'')) + '</div>';
    h += '<div class="notif-time">' + timeAgo(n.createdAt) + '</div>';
    if (n.matchName) h += '<span style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:600;background:rgba(185,100,255,.1);color:var(--purple);margin-top:4px">' + n.matchName + '</span>';
    h += '</div>';
    // Delete button right side
    h += '<button onclick="event.stopPropagation();deleteNotif(\'' + n._key + '\',\'' + (n._srcUser ? 'user' : 'global') + '\')" style="position:absolute;top:10px;right:10px;background:rgba(255,50,50,.12);border:1px solid rgba(255,50,50,.2);color:#ff5555;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas fa-times"></i></button>';
    h += '</div>';
  });
  nl.innerHTML = h;
}
function deleteNotif(key, src) {
  // Remove from local NOTIFS
  NOTIFS = NOTIFS.filter(function(n) { return n._key !== key; });
  _READ_KEYS[key] = true;
  if (U && window._supa) { window._supa.from('notifications').delete().eq('id', key).eq('user_id', U.uid).catch(function(){}); }
  updateBell();
  renderNotifs();
}
function clearAllNotifs() {
  if (!U) return;
  // PERMANENT FIX: Save clearedAt so Firebase listener skips old notifs
  var _clearedNow = Date.now();
  _notifClearedAt = _clearedNow;
  if (window._supa && U) { window._supa.from('notifications').update({ is_read: true }).eq('user_id', U.uid).eq('is_read', false).catch(function(){}); }
  NOTIFS = [];
  _READ_KEYS = {};
  if (UD) UD.readNotifications = {};
  updateBell();
  renderNotifs();
}
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
    if (t && t.roomId && t.roomPassword && hasJ(n.matchId)) {
      h += '<div class="room-box rb-green" style="margin-top:14px"><div style="font-size:11px;color:var(--txt2);text-transform:uppercase;margin-bottom:4px">Room ID</div><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:20px;font-weight:900">' + t.roomId + '</span><button onclick="copyTxt(String(t.roomId||\'\'))" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div>';
      h += '<div style="font-size:11px;color:var(--txt2);text-transform:uppercase;margin-top:8px;margin-bottom:4px">Password</div><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:20px;font-weight:900">' + t.roomPassword + '</span><button onclick="copyTxt(String(t.roomPassword||\'\'))" style="background:rgba(0,255,106,.15);border:none;color:var(--green);padding:6px 10px;border-radius:8px;cursor:pointer"><i class="fas fa-copy"></i></button></div></div>';
    }
  }
  openModal('Notification', h);
}
/* ========================================
   COIN SHOP — Manual UPI flow
   ======================================== */
function showCoinShop() {
  var modal = document.getElementById('coinShopModal');
  if (modal) modal.style.display = 'flex';
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
