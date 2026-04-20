/* =============================================
   FEATURE 17: Push Notifications + In-App Toggle
   - Match reminders (30min + 5min)
   - In-app toggle in Settings/Profile
   - Permission request with explanation
   ============================================= */
(function() {
  'use strict';

  var _remindersSet = {};

  function isEnabled() {
    return localStorage.getItem('notifEnabled') !== 'false';
  }

  function requestPermission(callback) {
    if (!('Notification' in window)) {
      if (callback) callback(false);
      return;
    }
    if (Notification.permission === 'granted') {
      localStorage.setItem('notifEnabled', 'true');
      if (callback) callback(true);
      return;
    }
    if (Notification.permission === 'denied') {
      if (callback) callback(false);
      return;
    }
    Notification.requestPermission().then(function(perm) {
      var ok = perm === 'granted';
      localStorage.setItem('notifEnabled', ok ? 'true' : 'false');
      if (callback) callback(ok);
    });
  }

  function sendNotif(title, body) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!isEnabled()) return;
    try {
      var n = new Notification(title, {
        body: body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [200, 100, 200]
      });
      setTimeout(function() { n.close(); }, 8000);
    } catch(e) {}
  }

  function setReminder(match) {
    if (!match || !match.id || !match.matchTime) return;
    var mid = match.id;
    var matchTime = Number(match.matchTime);
    var now = Date.now();
    if (matchTime <= now) return;
    if (_remindersSet[mid]) return;
    _remindersSet[mid] = true;
    var diff = matchTime - now;
    if (diff > 30 * 60 * 1000) {
      setTimeout(function() {
        sendNotif('⏰ Match 30 min mein!', (match.name||'Match') + ' — 30 minutes mein shuru hoga!');
      }, diff - 30 * 60 * 1000);
    }
    if (diff > 5 * 60 * 1000) {
      setTimeout(function() {
        sendNotif('🚨 Match sirf 5 min!', (match.name||'Match') + ' — abhi room join karo!');
        if (window.toast) window.toast('⚡ ' + (match.name||'Match') + ' 5 min mein!', 'ok');
      }, diff - 5 * 60 * 1000);
    }
  }

  function setupReminders() {
    if (!window.MT || !window.JR) return;
    for (var jk in window.JR) {
      var jr = window.JR[jk];
      var mid = jr.matchId || jr.tournamentId;
      if (!mid) continue;
      var match = window.MT[mid];
      if (match) setReminder(match);
    }
  }

  /* ── In-App Notification Toggle UI ── */
  function renderNotifToggle() {
    var perm = ('Notification' in window) ? Notification.permission : 'unsupported';
    var enabled = isEnabled() && perm === 'granted';
    var html = '<div class="notif-toggle-card">' +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:700;color:var(--text)">🔔 Match Notifications</div>' +
          '<div style="font-size:11px;color:var(--text-muted);margin-top:2px">' +
            (perm === 'denied' ? '⚠️ Browser ne block kiya hai — browser settings se allow karo' :
             perm === 'unsupported' ? '❌ Yeh browser support nahi karta' :
             'Match shuru hone se 30min + 5min pehle alert') +
          '</div>' +
        '</div>' +
        (perm !== 'denied' && perm !== 'unsupported' ?
          '<div class="notif-toggle ' + (enabled ? 'on' : '') + '" onclick="window.f17MatchReminder.toggle(this)">' +
            '<div class="notif-toggle-knob"></div>' +
          '</div>' : '') +
      '</div>' +
    '</div>';
    return html;
  }

  function toggleNotif(el) {
    var perm = Notification.permission;
    if (perm === 'default') {
      requestPermission(function(ok) {
        if (ok) {
          el.classList.add('on');
          if (window.toast) window.toast('🔔 Notifications enabled!', 'ok');
        } else {
          if (window.toast) window.toast('❌ Permission denied', 'err');
        }
      });
      return;
    }
    if (perm === 'granted') {
      var nowEnabled = el.classList.contains('on');
      if (nowEnabled) {
        el.classList.remove('on');
        localStorage.setItem('notifEnabled', 'false');
        if (window.toast) window.toast('🔕 Notifications off', 'ok');
      } else {
        el.classList.add('on');
        localStorage.setItem('notifEnabled', 'true');
        if (window.toast) window.toast('🔔 Notifications on!', 'ok');
      }
    }
  }

  /* Hook renderMM */
  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.UD && window.renderMM && !window._f17Hooked) {
      clearInterval(_check);
      window._f17Hooked = true;
      var orig = window.renderMM;
      window.renderMM = function() { orig.apply(this, arguments); setupReminders(); };
      setupReminders();
      /* Auto-request after 5s if not yet asked */
      setTimeout(function() {
        if (('Notification' in window) && Notification.permission === 'default') {
          requestPermission(function(){});
        }
      }, 5000);
    }
    if (_try > 30) clearInterval(_check);
  }, 1000);

  window.f17MatchReminder = {
    setup: setupReminders,
    send: sendNotif,
    toggle: toggleNotif,
    renderToggle: renderNotifToggle,
    request: requestPermission
  };
})();
