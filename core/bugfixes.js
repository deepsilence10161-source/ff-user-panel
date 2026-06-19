/* ================================================================
   BUG FIXES — core/bugfixes.js
   MiniESports v2.0 | May 2026

   FIXES APPLIED:
   1. $ function duplicate (utils.js + growth.js) — growth.js wala remove
   2. init() function duplicate (premium-creator.js + growth.js) — rename kiye
   3. Firebase version unified to 9.23.0 (Admin panel mein manually update karo)
   4. app-config.js → DB.config.load() se override (Supabase)
   5. SW registration added

   YEH FILE index.html mein SABSE PEHLE load karo (core/firebase.js ke baad)
================================================================ */

(function() {
  'use strict';

  /* ── FIX 1: $ function conflict guard ──
     growth.js aur utils.js dono mein $ defined thi.
     Ab check karo — already defined hai to skip karo */
  if (typeof window.$ === 'undefined') {
    window.$ = function(id) { return document.getElementById(id); };
  }

  /* ── FIX 2: init() name collision ──
     premium-creator.js ki init() → initPremiumCreator()
     growth.js ki init() → initGrowth()
     Yeh wrappers old names ko safely remap karte hain */
  window._fixInitCollision = function() {
    /* premium-creator.js ne apni init define ki hogi */
    if (typeof window._premiumCreatorInitFn === 'function') {
      window.initPremiumCreator = window._premiumCreatorInitFn;
    }
    /* growth.js ne apni init define ki hogi */
    if (typeof window._growthInitFn === 'function') {
      window.initGrowth = window._growthInitFn;
    }
  };

  /* ── FIX 3: SW Registration ── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      /* Bug #96 Fix: SW registration with exponential backoff retry */
      (function _registerSW(attempt) {
        navigator.serviceWorker.register('/sw.js', { scope: '/' })
          .then(function(reg) {
            console.log('[SW] Registered, scope:', reg.scope);
            setInterval(function() { reg.update(); }, 1800000);
          })
          .catch(function(err) {
            console.warn('[SW] Registration failed (attempt ' + attempt + '):', err.message);
            if (attempt < 4) {
              /* Retry with exponential backoff: 2s, 4s, 8s, 16s */
              setTimeout(function() { _registerSW(attempt + 1); }, Math.pow(2, attempt) * 1000);
            }
          });
      })(1);

      /* Listen for SW messages */
      navigator.serviceWorker.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'SYNC_JOIN_REQUESTS') {
          if (window._pendingJoinQueue && window._pendingJoinQueue.length > 0) {
            window._pendingJoinQueue.forEach(function(fn) {
              try { fn(); } catch(e) {}
            });
            window._pendingJoinQueue = [];
          }
        }
      });
    });
  }

  /* ── FIX 4: PWA install prompt ── */
  var _deferredInstall = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    _deferredInstall = e;
    /* Show install button if present */
    var btn = document.getElementById('installAppBtn');
    if (btn) btn.style.display = 'flex';
  });

  window.showInstallPrompt = function() {
    if (!_deferredInstall) {
      if (window.toast) toast('App already installed ya browser support nahi karta', 'inf');
      return;
    }
    _deferredInstall.prompt();
    _deferredInstall.userChoice.then(function(result) {
      if (result.outcome === 'accepted') {
        if (window.toast) toast('✅ App install ho raha hai!', 'ok');
        if (window.analytics) analytics.logEvent('app_installed');
      }
      _deferredInstall = null;
      var btn = document.getElementById('installAppBtn');
      if (btn) btn.style.display = 'none';
    });
  };

  window.addEventListener('appinstalled', function() {
    console.log('[PWA] App installed');
    if (window.analytics) analytics.logEvent('app_installed');
  });

  /* ── FIX 5: Auth fallback — window._authFired ── */
  window._authFired = false;

  /* ── FIX 6: Offline detection ── */
  function _handleOffline() {
    if (window.toast) toast('⚠️ Internet nahi hai — offline mode', 'err');
  }
  function _handleOnline() {
    if (window.toast) toast('✅ Internet wapas aaya!', 'ok');
    /* Re-poll */
    if (window.DB) {
      DB.config.load();
      if (window.U) DB.users.getMe().then(function(u) { if (u) { window.UD = u; if (window.updateHdr) updateHdr(); } });
    }
  }
  window.addEventListener('offline', _handleOffline);
  window.addEventListener('online',  _handleOnline);

  /* ── FIX 7: Admin Firebase version reminder (comment) ──
     Admin panel ke index.html mein:
     CHANGE: firebasejs/10.7.1 → firebasejs/9.23.0
     Dono panels same version use karein */

  
  /* ── ONESIGNAL: Save player ID after login ── */
  window._saveOneSignalId = function(uid) {
    try {
      if (window.OneSignalDeferred) {
        OneSignalDeferred.push(function(OneSignal) {
          OneSignal.login(uid).catch(function(){});
          OneSignal.User.PushSubscription.optIn().catch(function(){});
        });
      }
    } catch(e) {}
  };

  /* ── APP URL ── */
  window.APP_URL = 'https://ff-user-panel.deepsilence10161.workers.dev/';
  window.SUPABASE_URL = 'https://hddhkculuyrfoevxmlwy.supabase.co';

  /* ── logActivity proxy — queues calls until friends.js defines the real function ── */
  var _activityQueue = [];
  if (!window.logActivity) {
    window.logActivity = function(type, text) {
      _activityQueue.push({ type: type, text: text, ts: Date.now() });
    };
  }
  /* Flush queue when real logActivity is defined (called by friends.js after load) */
  window._flushActivityQueue = function() {
    if (!_activityQueue.length) return;
    var q = _activityQueue.splice(0);
    q.forEach(function(item) { if (window.logActivity && window.logActivity !== window._flushActivityQueue) window.logActivity(item.type, item.text); });
  };

  console.log('[BugFixes] v2.0 loaded — all fixes applied');

})();
