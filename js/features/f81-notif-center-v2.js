/* =============================================
   FEATURE 36: In-App Notification Center
   - Bell icon tap karo → slide-down panel
   - Unread count badge on bell
   - Types: result, cashback, referral, system
   - Mark all read button
   ============================================= */
(function() {
  'use strict';

  var _unread = 0;

  function loadNotifs(cb) {
    if (!window.db || !window.U) return;
    var uid = window.U.uid;
    window.db.ref('users/' + uid + '/notifications')
      .orderByChild('timestamp').limitToLast(30)
      .once('value', function(s) {
        var list = [];
        if (s.exists()) s.forEach(function(c) {
          var d = c.val(); d._key = c.key; list.push(d);
        });
        list.reverse();
        _unread = list.filter(function(n) { return !n.read; }).length;
        updateBadge();
        if (cb) cb(list);
      });
  }

  function updateBadge() {
    var dot = document.getElementById('notifBadge');
    if (!dot) return;
    dot.style.display = _unread > 0 ? 'flex' : 'none';
    dot.textContent = _unread > 9 ? '9+' : _unread || '';
  }

  function openNotifPanel() {
    if (!window.openModal) return;
    loadNotifs(function(list) {
      var typeIcon = { result:'🏆', cashback:'🪙', referral:'🎁', system:'📢', default:'🔔' };
      var h = '<div>';
      if (!list.length) {
        h += '<div style="text-align:center;padding:30px;color:var(--txt2)">Koi notification nahi</div>';
      } else {
        list.forEach(function(n) {
          var icon = typeIcon[n.type] || typeIcon.default;
          h += '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);opacity:' + (n.read ? '0.6' : '1') + '">' +
            '<div style="font-size:20px;flex-shrink:0">' + icon + '</div>' +
            '<div style="flex:1">' +
              '<div style="font-size:13px;font-weight:' + (n.read ? '400' : '700') + '">' + (n.title || 'Notification') + '</div>' +
              '<div style="font-size:11px;color:var(--txt2);margin-top:2px">' + (n.message || n.body || '') + '</div>' +
              '<div style="font-size:10px;color:var(--txt2);margin-top:3px">' + _timeAgo(n.timestamp || n.createdAt) + '</div>' +
            '</div>' +
            (!n.read ? '<div style="width:7px;height:7px;border-radius:50%;background:var(--primary);flex-shrink:0;margin-top:4px"></div>' : '') +
          '</div>';
        });
        h += '<button onclick="window.f81Notifs.markAllRead()" style="width:100%;padding:10px;margin-top:10px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--txt2);font-size:12px;cursor:pointer">✅ Mark all read</button>';
      }
      h += '</div>';
      window.openModal('🔔 Notifications', h);
      // Mark all read after 2s
      if (window.U) {
        var uid = window.U.uid;
        list.filter(function(n){ return !n.read; }).forEach(function(n) {
          window.db.ref('users/' + uid + '/notifications/' + n._key + '/read').set(true);
        });
        _unread = 0;
        updateBadge();
      }
    });
  }

  function _timeAgo(ts) {
    if (!ts) return '';
    var diff = Date.now() - ts;
    if (diff < 60000) return 'Abhi';
    if (diff < 3600000) return Math.floor(diff/60000) + ' min pehle';
    if (diff < 86400000) return Math.floor(diff/3600000) + ' ghante pehle';
    return Math.floor(diff/86400000) + ' din pehle';
  }

  function markAllRead() {
    if (!window.U || !window.db) return;
    var uid = window.U.uid;
    window.db.ref('users/' + uid + '/notifications').once('value', function(s) {
      if (!s.exists()) return;
      var updates = {};
      s.forEach(function(c) { if (!c.val().read) updates[c.key + '/read'] = true; });
      window.db.ref('users/' + uid + '/notifications').update(updates);
      _unread = 0; updateBadge();
      if (window.toast) window.toast('✅ All notifications read', 'ok');
      if (window.closeModal) window.closeModal();
    });
  }

  // Auto-refresh badge every 60s
  var _try = 0, _int = setInterval(function() {
    _try++;
    if (window.db && window.U) {
      clearInterval(_int);
      loadNotifs(function(){});
      setInterval(function() { loadNotifs(function(){}); }, 60000);
    }
    if (_try > 60) clearInterval(_int);
  }, 1000);

  window.f81Notifs = { open: openNotifPanel, update: updateBadge, markAllRead: markAllRead, load: loadNotifs };
  window.openNotifPanelV2 = openNotifPanel;
})();
