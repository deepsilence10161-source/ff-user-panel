/* ================================================================
   FEATURE f87: Comeback Alert
   - 3+ days inactive → "Welcome back! Yeh hua aapke jaane ke baad"
   - Shows missed matches count, new tournaments, new notifications
   ================================================================ */
(function () {
  'use strict';

  var INACTIVE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

  function checkComeback() {
    var db = window.db; var U = window.U; var UD = window.UD;
    if (!db || !U || !UD) return;

    var lastSeen = UD.lastSeen || UD.lastLogin || 0;
    var gap = Date.now() - lastSeen;
    if (gap < INACTIVE_THRESHOLD_MS) {
      // Update lastSeen and exit
      db.ref('users/' + U.uid + '/lastSeen').set(Date.now());
      return;
    }

    var days = Math.floor(gap / 86400000);

    // Count new matches since lastSeen
    db.ref('matches').orderByChild('createdAt').startAt(lastSeen).once('value', function (snap) {
      var newMatches = 0;
      if (snap.exists()) snap.forEach(function () { newMatches++; });

      // Count unread notifs
      var unread = 0;
      var rd = UD.readNotifications || {};
      (window.NOTIFS || []).forEach(function (n) {
        if (!rd[n._key]) unread++;
      });

      showComebackBanner(days, newMatches, unread);

      // Update lastSeen
      db.ref('users/' + U.uid + '/lastSeen').set(Date.now());
    });
  }

  function showComebackBanner(days, newMatches, unread) {
    if (document.getElementById('_f87Banner')) return;

    var banner = document.createElement('div');
    banner.id = '_f87Banner';
    banner.style.cssText = [
      'position:fixed;top:0;left:0;right:0;z-index:99998;',
      'background:linear-gradient(135deg,#0f1a2e,#1a1a38);',
      'border-bottom:2px solid rgba(0,212,255,.3);',
      'padding:14px 16px;',
      'animation:f87slide .4s ease'
    ].join('');

    banner.innerHTML =
      '<style>@keyframes f87slide{from{transform:translateY(-100%)}to{transform:translateY(0)}}</style>' +
      '<div style="display:flex;align-items:flex-start;gap:12px">' +
        '<div style="font-size:32px;margin-top:2px">👋</div>' +
        '<div style="flex:1">' +
          '<div style="font-size:14px;font-weight:900;color:#fff">Welcome Back!</div>' +
          '<div style="font-size:12px;color:#888;margin-top:2px">' + days + ' din baad aaye ho. Kuch new updates hain:</div>' +
          '<div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">' +
            (newMatches > 0 ?
              '<span style="background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);border-radius:8px;padding:4px 10px;font-size:11px;color:#00ff9c;font-weight:700">🏆 ' + newMatches + ' new matches</span>' : '') +
            (unread > 0 ?
              '<span style="background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.2);border-radius:8px;padding:4px 10px;font-size:11px;color:#ffd700;font-weight:700">🔔 ' + unread + ' notifications</span>' : '') +
            '<span style="background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);border-radius:8px;padding:4px 10px;font-size:11px;color:#00d4ff;font-weight:700">🎮 Join a match!</span>' +
          '</div>' +
        '</div>' +
        '<div onclick="document.getElementById(\'_f87Banner\').remove()" style="color:#444;font-size:20px;cursor:pointer;padding:2px 6px">✕</div>' +
      '</div>';

    document.body.appendChild(banner);

    // Push header down
    var hdr = document.getElementById('header');
    var mc  = document.getElementById('mainContent');
    var bannerH = 90;
    if (hdr) hdr.style.marginTop = bannerH + 'px';
    if (mc)  mc.style.paddingTop  = bannerH + 'px';

    // Auto-dismiss after 12s
    setTimeout(function () {
      if (banner.parentNode) {
        banner.style.transition = 'opacity .4s';
        banner.style.opacity = '0';
        setTimeout(function () {
          if (banner.parentNode) banner.remove();
          if (hdr) hdr.style.marginTop = '';
          if (mc)  mc.style.paddingTop  = '';
        }, 400);
      }
    }, 12000);

    // Manual close resets margins
    banner.querySelector('div[onclick]') && banner.addEventListener('click', function (e) {
      if (e.target.getAttribute('onclick') && e.target.getAttribute('onclick').includes('f87Banner')) {
        if (hdr) hdr.style.marginTop = '';
        if (mc)  mc.style.paddingTop  = '';
      }
    });
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.U && window.db) {
      clearInterval(_iv);
      setTimeout(checkComeback, 1500);
    }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f87] ✅ Comeback Alert loaded');
})();
