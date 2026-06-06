/* ============================================================
   FIX 12: PUSH NOTIFICATION PERMISSION — MOBILE BROWSER FIX
   - Notification.requestPermission() result properly handle karo
   - iOS Safari, Android Chrome, Firefox sab cover
   - User-gesture requirement handle karo
   - Denied state gracefully handle karo with instructions
   ============================================================ */

(function() {
  'use strict';

  var STORAGE_KEY = 'mes_notif_perm_asked';

  /* ── Detect platform ── */
  var isIOS     = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  var isAndroid = /Android/.test(navigator.userAgent);
  var isSafari  = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  var isPWA     = window.matchMedia('(display-mode: standalone)').matches ||
                  window.navigator.standalone === true;

  /* ── Check if notifications are supported ── */
  function isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  function isSupportedBasic() {
    return 'Notification' in window;
  }

  /* ── Get current permission state ── */
  function getPermission() {
    if (!isSupportedBasic()) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  }

  /* ── Show platform-specific instructions for denied state ── */
  function showDeniedHelp() {
    var msg = '';
    if (isIOS && isSafari) {
      msg = 'iOS Safari pe notifications ke liye:\nSettings → Safari → Notifications → Mini eSports → Allow';
    } else if (isIOS) {
      msg = 'iOS pe notifications ke liye pehle app ko Home Screen pe add karo (PWA), phir retry karo.';
    } else if (isAndroid) {
      msg = 'Android pe notifications allow karne ke liye:\nBrowser Settings → Site Settings → Notifications → Allow';
    } else {
      msg = 'Notifications blocked hain. Browser address bar ke lock icon pe click karo → Notifications → Allow';
    }

    /* Toast + modal */
    if (window.toast) toast(msg.split('\n')[0], 'err');
    if (window.showModal) {
      showModal('🔔 Notifications Blocked', '<p style="font-size:13px;line-height:1.6">' + msg.replace(/\n/g, '<br>') + '</p>');
    } else {
      /* Fallback: inline alert banner */
      var banner = document.createElement('div');
      banner.style.cssText = 'position:fixed;bottom:80px;left:12px;right:12px;background:#1a1a2e;border:1px solid #ff6b6b;border-radius:12px;padding:14px;z-index:99998;font-size:12px;color:#ff6b6b;line-height:1.6';
      banner.innerHTML = '<strong>🔔 Notifications Blocked</strong><br>' + msg.replace(/\n/g, '<br>') + '<br><button onclick="this.parentNode.remove()" style="margin-top:8px;background:rgba(255,107,107,.15);border:1px solid #ff6b6b;color:#ff6b6b;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:11px">Close</button>';
      document.body.appendChild(banner);
      setTimeout(function() { if (banner.parentNode) banner.remove(); }, 8000);
    }
  }

  /* ── iOS PWA workaround ── */
  function iosPWANotif(title, body) {
    /* iOS doesn't support Web Push; show in-app notification instead */
    if (window.toast) toast('🔔 ' + title + ': ' + body, 'inf');
  }

  /* ── Core permission request ── */
  function requestPermission(callback) {
    callback = callback || function() {};

    if (!isSupportedBasic()) {
      /* iOS non-PWA: notifications not supported */
      if (isIOS && !isPWA) {
        if (window.toast) toast('📱 iOS pe notifications ke liye app install karo (Add to Home Screen)', 'inf');
        callback(false, 'unsupported-ios');
      } else {
        if (window.toast) toast('❌ Is browser mein notifications supported nahi hain', 'err');
        callback(false, 'unsupported');
      }
      return;
    }

    var perm = getPermission();

    if (perm === 'granted') {
      localStorage.setItem(STORAGE_KEY, 'granted');
      callback(true, 'granted');
      return;
    }

    if (perm === 'denied') {
      showDeniedHelp();
      callback(false, 'denied');
      return;
    }

    /* 'default' — need to ask */
    /* On iOS Safari < 16.4, requestPermission uses callback style */
    try {
      var result = Notification.requestPermission(function(p) {
        /* Callback style (legacy Safari) */
        handlePermResult(p, callback);
      });

      /* Promise style (modern browsers) */
      if (result && typeof result.then === 'function') {
        result.then(function(p) {
          handlePermResult(p, callback);
        }).catch(function(err) {
          console.error('[Notif] Permission request error:', err);
          if (window.toast) toast('Notification permission request failed', 'err');
          callback(false, 'error');
        });
      }
    } catch(e) {
      console.error('[Notif] requestPermission exception:', e);
      /* Some browsers throw if not called from user gesture */
      if (window.toast) toast('🔔 Notifications ke liye button pe tap karo', 'inf');
      callback(false, 'gesture-required');
    }
  }

  function handlePermResult(permission, callback) {
    localStorage.setItem(STORAGE_KEY, permission);
    if (permission === 'granted') {
      if (window.toast) toast('✅ Notifications enabled! Match reminders milenge.', 'ok');
      /* Register service worker for push if available */
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function(reg) {
          window._swRegistration = reg;
          console.log('[Notif] SW ready for push:', reg);
        }).catch(function() {});
      }
      callback(true, 'granted');
    } else if (permission === 'denied') {
      showDeniedHelp();
      callback(false, 'denied');
    } else {
      /* 'default' — user dismissed without choosing */
      if (window.toast) toast('🔔 Notifications abhi allow nahi ki gayi', 'inf');
      callback(false, 'dismissed');
    }
  }

  /* ── Send local notification (cross-platform) ── */
  function sendNotification(title, body, opts) {
    opts = opts || {};
    /* iOS PWA fallback */
    if (isIOS && !isPWA) { iosPWANotif(title, body); return; }
    if (!isSupportedBasic()) { iosPWANotif(title, body); return; }
    if (getPermission() !== 'granted') return;

    try {
      /* Try service worker notification (better on Android) */
      if ('serviceWorker' in navigator && window._swRegistration) {
        window._swRegistration.showNotification(title, {
          body:    body,
          icon:    opts.icon    || '/favicon.ico',
          badge:   opts.badge   || '/favicon.ico',
          vibrate: opts.vibrate || [200, 100, 200],
          tag:     opts.tag     || 'mes-notif',
          data:    opts.data    || {},
          requireInteraction: opts.sticky || false
        });
      } else {
        /* Fallback: basic Notification API */
        var n = new Notification(title, {
          body:    body,
          icon:    opts.icon  || '/favicon.ico',
          badge:   opts.badge || '/favicon.ico',
          tag:     opts.tag   || 'mes-notif'
        });
        setTimeout(function() { n.close(); }, opts.duration || 8000);
        if (opts.onclick) n.onclick = opts.onclick;
      }
    } catch(e) {
      console.warn('[Notif] Send failed:', e);
      /* In-app fallback */
      if (window.toast) toast('🔔 ' + title, 'inf');
    }
  }

  /* ── Patch the existing _reqNotifPerm ── */
  window._reqNotifPerm = function() {
    requestPermission(function(ok, reason) {
      if (ok && window.enablePushNotifs) enablePushNotifs();
    });
  };

  /* ── Enhanced enablePushNotifs ── */
  window.enablePushNotifs = function() {
    if (!window.U || !window.db) return;
    requestPermission(function(ok) {
      if (ok) {
        db.ref('users/' + U.uid).update({ notifEnabled: true, notifUpdatedAt: firebase.database.ServerValue.TIMESTAMP });
        /* Save FCM token if available */
        if (window.messaging) {
          window.messaging.getToken({ vapidKey: window.VAPID_KEY }).then(function(token) {
            if (token) db.ref('users/' + U.uid + '/fcmToken').set(token);
          }).catch(function() {});
        }
      }
    });
  };

  /* ── Public exports ── */
  window.NotifManager = {
    request:     requestPermission,
    send:        sendNotification,
    getStatus:   getPermission,
    isSupported: isSupportedBasic,
    showHelp:    showDeniedHelp,
    platform: {
      isIOS: isIOS, isAndroid: isAndroid, isSafari: isSafari, isPWA: isPWA
    }
  };

  /* ── Auto-prompt logic: don't ask immediately on load ── */
  /* Only prompt after user has interacted with a match */
  window._notifAutoPrompt = function() {
    var asked = localStorage.getItem(STORAGE_KEY);
    if (asked) return; /* Already asked */
    if (getPermission() !== 'default') return;

    /* Show gentle prompt banner */
    setTimeout(function() {
      var banner = document.createElement('div');
      banner.id = 'notifPromptBanner';
      banner.style.cssText = 'position:fixed;bottom:80px;left:12px;right:12px;background:rgba(0,255,156,.1);border:1px solid var(--green,#00ff9c);border-radius:12px;padding:12px 14px;z-index:9990;display:flex;align-items:center;gap:10px;animation:toastIn .3s ease';
      banner.innerHTML = '<span style="font-size:20px">🔔</span><div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--green,#00ff9c)">Match Reminders Enable Karo</div><div style="font-size:11px;color:#aaa;margin-top:2px">Match se pehle alert milega</div></div><button onclick="window._reqNotifPerm();this.closest(\'#notifPromptBanner\').remove()" style="background:var(--green,#00ff9c);color:#000;border:none;border-radius:8px;padding:6px 12px;font-size:11px;font-weight:700;cursor:pointer">Enable</button><button onclick="this.closest(\'#notifPromptBanner\').remove()" style="background:transparent;border:none;color:#aaa;font-size:16px;cursor:pointer;padding:0 4px">✕</button>';
      document.body.appendChild(banner);
      setTimeout(function() { if (banner.parentNode) banner.remove(); }, 12000);
    }, 3000);
  };

  console.log('[Mini eSports] ✅ Fix 12: Push Notification Manager loaded. Platform:', isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop');
})();
