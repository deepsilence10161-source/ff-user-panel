/* ================================================================
   FIREBASE — core/firebase.js | MiniESports v3.0
   
   Firebase RTDB = REMOVED (Supabase Realtime pe migrate ho gaya)
   
   Firebase sirf yeh karta hai:
   ✅ Analytics — user behavior track
   ✅ Crashlytics — crash reports
   ✅ Auth — Google login fallback (Supabase primary hai)
   ✅ support/ chat — RTDB ka sirf yahi ek use bacha
================================================================ */

/* ── Firebase App Init ── */
var _fireApp = firebase.initializeApp({
  apiKey:            "AIzaSyA-v9AYigDrg96D_fos0vOW3wU2GY2UYec",
  authDomain:        "fft-app-1e283.firebaseapp.com",
  databaseURL:       "https://fft-app-1e283-default-rtdb.firebaseio.com",
  projectId:         "fft-app-1e283",
  storageBucket:     "fft-app-1e283.firebasestorage.app",
  messagingSenderId: "247829466483",
  appId:             "1:247829466483:web:6961488f1d3c4e3fff4906",
  /* ✅ FIX (2026-09-30): yeh placeholder chhoot gaya tha, isliye Firebase
     Analytics har load par error deta tha —
     "@firebase/analytics: The measurement ID in the local Firebase config
      (G-XXXXXXXXXX) does not match the measurement ID fetched from the server"
     aur saara analytics data silently drop ho raha tha (live verified: failed
     beacon request mein asli measurement id G-5TNKW1TVB1 dikh raha tha).
     Ab wahi asli measurement id set hai. */
  measurementId:     "G-5TNKW1TVB1"
}, "mainApp");

/* ── Firebase RTDB — SIRF support/ chat ke liye ── */
var db = _fireApp.database();

/* ── Firebase Analytics ── */
var _analytics = null;
try {
  if (firebase.analytics) {
    _analytics = firebase.analytics(_fireApp);
    console.log("[Firebase] Analytics ready");
  }
} catch(e) { console.warn("[Firebase] Analytics init failed:", e.message); }

/* ── Analytics helper ── */
window.logEvent = function(eventName, params) {
  try { if (_analytics) _analytics.logEvent(eventName, params || {}); } catch(e) {}
};
window.analytics = {
  login:         function(method)        { logEvent("login",          { method: method }); },
  signup:        function(method)        { logEvent("sign_up",        { method: method }); },
  joinMatch:     function(mid, fee, type){ logEvent("join_match",     { match_id: mid, entry_fee: fee, entry_type: type }); },
  matchResult:   function(mid, k, pl)   { logEvent("match_result",   { match_id: mid, kills: k, placement: pl }); },
  sdPurchase:    function(amount)        { logEvent("sd_purchase",    { amount: amount }); },
  coinEarned:    function(reason, amt)   { logEvent("coin_earned",    { reason: reason, amount: amt }); },
  screenView:    function(screen)        { logEvent("screen_view",    { screen_name: screen }); },
  adWatched:     function()              { logEvent("ad_watched"); },
  checkin:       function(streak)        { logEvent("daily_checkin",  { streak: streak }); },
  missionDone:   function(key)           { logEvent("mission_complete",{ mission: key }); },
  clanJoined:    function()              { logEvent("clan_joined"); },
  battlePass:    function(tier)          { logEvent("battle_pass_tier",{ tier: tier }); },
  premiumBought: function(tier)          { logEvent("premium_purchased",{ tier: tier }); }
};

/* ── Firebase Auth — fallback (Supabase is primary) ── */
var auth = null, gp = null;
try {
  if (firebase.auth) {
    auth = _fireApp.auth();
    gp = new firebase.auth.GoogleAuthProvider();
    gp.setCustomParameters({ prompt: "select_account" });
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(){});
  }
} catch(e) { console.warn("[Firebase] Auth init:", e.message); }

/* ── window.fbAuth() — ALWAYS use this instead of bare firebase.auth() ──
   ✅ FIX (2026-09-15, CRITICAL) — "No Firebase App '[DEFAULT]' has been
   created - call Firebase App.initializeApp() (app-compat/no-app)".

   The only app this codebase ever creates is the NAMED one above
   ("mainApp"). Nothing anywhere calls firebase.initializeApp() without a
   name, so an app called "[DEFAULT]" has never existed. But a bare
   firebase.auth() call resolves by app NAME and defaults to "[DEFAULT]" —
   so every single one of them threw the error above, immediately and
   every time (verified against firebase-app-compat 9.23.0, the exact
   version index.html loads).

   Most call sites wrapped it in try/catch, so the failure was invisible
   and just quietly disabled the feature:
     • core/imgbb.js line 39   → swallowed → cb(null) → "Login required
       to upload" on every screenshot/profile/banner upload
     • js/paytm-checkout.js    → swallowed → cb(null) → no Paytm token
     • core/db.js logout       → swallowed → Firebase session never cleared
   But core/imgbb.js line 73 called firebase.auth() a SECOND time while
   building its error message — OUTSIDE any try/catch — so there the throw
   escaped the whole upload path, propagated up into quick-deposit.js's
   _onDupCheckResult, and surfaced as the red
   "❌ DEBUG ERROR (dupcheck)" toast that aborted every Sky Diamond
   purchase submission right after the screenshot + UTR were filled in
   correctly. (That toast's try/catch was added 2026-09-14 as temporary
   instrumentation to find exactly this — it did its job.)

   This helper returns Auth from the real app. Prefer the already-built
   `auth` global; otherwise resolve explicitly against _fireApp, so
   "[DEFAULT]" is never consulted. Never call bare firebase.auth() in
   this codebase. */
window.fbAuth = function() {
  if (auth) return auth;                                   /* _fireApp.auth() */
  if (!window.firebase || typeof firebase.auth !== 'function') return null;
  /* No _fireApp means no app was created at all — return null rather than
     falling back to a bare firebase.auth(), which would just re-throw. */
  if (!_fireApp) return null;
  try {
    return firebase.auth(_fireApp);
  } catch (e) {
    console.warn("[Firebase] fbAuth() could not resolve Auth:", e.message);
    return null;
  }
};

/* ── Global State Variables (unchanged for screen compatibility) ── */
var U = null, UD = null, MT = {}, JR = {}, NOTIFS = [], PAY = {}, WH = [], REFS = [], TXNS = [], prevMTKeys = {};
/* ✅ BUG FIX (2026-08-24): "Sponsored match admin panel me ban gaya aur
   show bhi hua, lekin user panel me show hi nahi ho raha" — root cause
   wasn't a query/RLS bug at all (both were already correct — GRANTs and
   an open `st_select_all` policy on sponsored_tournaments confirmed live
   on the DB). The User Panel simply never had ANY code that read from
   sponsored_tournaments — admin's "Sponsored" feature was built and
   wired end-to-end on the Admin Panel side only, with no matching User
   Panel screen ever built to show it. New global SP_T mirrors MT's
   pattern for this table (see _bootSponsored in listeners.js). */
var SP_T = {};
var _READ_KEYS = {};
(function() {
  try { var saved = localStorage.getItem("_mes_read_keys"); if (saved) Object.assign(_READ_KEYS, JSON.parse(saved)); } catch(e) {}
})();
function _saveReadKeys() {
  try { localStorage.setItem("_mes_read_keys", JSON.stringify(_READ_KEYS)); } catch(e) {}
}
var curScr = "home", prevScr = "home", hSF = "upcoming", hCF = "all", mmSF = "upcoming";
var spType = "weekly", cdInt = null, partnerCache = {};
var wfStep = 0, wfAmt = 0, wfScreenshot = "";

/* NOTE: db = Firebase RTDB — ONLY used for support/ chat now
   All other data → Supabase via window.DB or window._supa */
console.log("[Firebase] Analytics + Auth ready | Data → Supabase");

/* ════ Firebase Cloud Messaging (FCM) — AB EK-MATRA PUSH PATH ════
   OneSignal → FCM migration (2026-10-31): OneSignal ka free mobile-push
   1,000 MAU par cap ho gaya tha (1-Oct-2026 se LIVE). FCM direct =
   $0 + unlimited (research: reports/push-tools-comparison-2026-10-31.html).
   Token flow:
     login → _bindPushIdentity(uid)
       • APK WebView: Android.fcmSyncToken bridge → _onNativeFcmToken(token)
       • Browser:     messaging.getToken({vapidKey, serviceWorkerRegistration})
     → push-token edge fn (Firebase idToken RS256 verified) → user_push_tokens
   Background display: sw.js (FCM block). Foreground: onMessage → toast. */
window.messaging = null;
/* Web Push certificate (VAPID public key) — Firebase Console → Project
   Settings → Cloud Messaging → Web Push certificates se 2026-10-31 ko
   copy kiya gaya (owner ne generate kiya). Purani key (BCxMf_…) project
   me registered hi nahi thi — fcmregistrations 401 de raha tha
   (API-level H1–H9 matrix se confirm; run fcm3 ki PUSH02 fail isi se). */
window.VAPID_KEY = 'BCgrRXslxWdhOpeDLCrjUSqXHCZ3vCjWg7tzPj3zIQyhUYJYfVsdlsmzKKS4YGP_ME0wcgp9A1vdyycm9GVYhiE';
window.PUSH_FN_URL = (window.SUPABASE_URL || 'https://hddhkculuyrfoevxmlwy.supabase.co') + '/functions/v1/push-token';
window._PUSH_ANON_KEY = window._SUPA_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZGhrY3VsdXlyZm9ldnhtbHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTQ1MTgsImV4cCI6MjA5NDAzMDUxOH0.2hhDGez1fVFjS5ljSU3tSOEJuusLmQpERjcrh45T7po';

/* push-token edge fn call — Authorization: Firebase idToken (server par RS256 verify) */
window._pushTokenCall = function(action, platform, token, cb) {
  try {
    var auth = window.auth && window.auth.currentUser;
    if (!auth || !auth.getIdToken) { if (cb) cb(false); return; }
    auth.getIdToken().then(function(idTok) {
      fetch(window.PUSH_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window._PUSH_ANON_KEY,
          'Authorization': 'Bearer ' + idTok
        },
        body: JSON.stringify({ action: action, platform: platform, token: token })
      }).then(function(r) {
        /* fcm4-run instrumentation: response status+body console par —
           push-e2e driver console capture se exact fail-reason dikhta hai */
        return r.text().then(function(txt) {
          var j = {}; try { j = JSON.parse(txt); } catch (e) { }
          try {
            window._pushTokenLast = { status: r.status, body: txt.slice(0, 200) };
            console.log('[FCM-token-sync]', action, platform, 'HTTP', r.status, txt.slice(0, 160));
          } catch (e2) { }
          if (cb) cb(!!(j && j.ok));
        });
      }).catch(function(err) {
        try {
          window._pushTokenLast = { fetchErr: String((err && err.message) || err) };
          console.warn('[FCM-token-sync] fetch FAIL:', String((err && err.message) || err));
        } catch (e2) { }
        if (cb) cb(false);
      });
    }).catch(function(err) {
      try {
        window._pushTokenLast = { idTokenErr: String((err && err.message) || err) };
        console.warn('[FCM-token-sync] getIdToken FAIL:', String((err && err.message) || err));
      } catch (e2) { }
      if (cb) cb(false);
    });
  } catch (e) { if (cb) cb(false); }
};

/* Native (APK) se token aaye → DB me upsert (bridge callback) */
window._onNativeFcmToken = function(token) {
  try {
    if (token && token.length > 20) {
      window._fcmTokenAndroid = token;
      window._pushTokenCall('set', 'android', token);
    }
  } catch (e) { }
};

/* Native foreground push → in-app toast (system-tray me notification service bhi dikhata hai) */
window._onNativePush = function(title, body, url) {
  try { window._lastPushPayload = { data: { title: title || '', body: body || '', url: url || '' } }; } catch (e) { }
  try { if (window.toast && title) window.toast('🔔 ' + title + (body ? ': ' + body : ''), 'inf'); } catch (e) { }
};

/* Notification tap → app khulti hai (native PendingIntent); url mile to wahi page */
window._onPushTap = function(url) {
  try { if (url && /^https?:\/\//.test(url)) window.location.href = url; } catch (e) { }
};

/* LOGIN bind: native bridge + web getToken + OneSignal SW cleanup (ek-baar) */
window._bindPushIdentity = function(uid) {
  if (!uid) return;
  window._pushUid = uid;
  try {
    if (window.Android && typeof window.Android.fcmSyncToken === 'function') {
      window.Android.fcmSyncToken('_onNativeFcmToken');
    }
  } catch (e) { }
  try { if (window._getFCMToken) window._getFCMToken(); } catch (e) { }
  try {
    if (!localStorage.getItem('_mes_oss_sw_cleaned') && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(function(regs) {
        regs.forEach(function(r) {
          var u = (r.active && r.active.scriptURL) || '';
          if (u.indexOf('OneSignal') !== -1) { try { r.unregister(); } catch (e) { } }
        });
      }).catch(function() { });
      localStorage.setItem('_mes_oss_sw_cleaned', '1');
    }
  } catch (e) { }
};

/* LOGOUT unbind: is device ke tokens DB se delete — अगले user को पिछले के pushes न मिलें */
window._unbindPushIdentity = function() {
  try { if (window._fcmTokenAndroid) window._pushTokenCall('delete', 'android', window._fcmTokenAndroid); } catch (e) { }
  try { if (window._fcmToken) window._pushTokenCall('delete', 'web', window._fcmToken); } catch (e) { }
};

try {
  if (firebase.messaging && 'serviceWorker' in navigator) {
    window.messaging = _fireApp.messaging();
    window._fcmStage = 'init';
    console.log("[Firebase] FCM Messaging ready (OneSignal-migration 2026-10-31)");
    /* WEB token: permission granted par getToken → push-token fn → user_push_tokens */
    window._getFCMToken = function() {
      if (!window.messaging) { window._fcmStage = 'no-messaging'; return; }
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        window._fcmStage = 'perm-denied';
        console.log('[FCM] Notification permission denied — skipping getToken');
        return;
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        window._fcmStage = 'perm-request';
        Notification.requestPermission().then(function(perm) {
          if (perm === 'granted') window._getFCMToken();
          else console.log('[FCM] Permission not granted by user');
        });
        return;
      }
      window._fcmStage = 'sw-wait';
      navigator.serviceWorker.ready.then(function(reg) {
        window._fcmStage = 'get-token';
        return window.messaging.getToken({ vapidKey: window.VAPID_KEY, serviceWorkerRegistration: reg });
      }).then(function(token) {
        if (token) {
          window._fcmStage = 'done';
          console.log('[FCM] Token obtained: …' + token.slice(-6));
          window._fcmToken = token;
          window._pushTokenCall('set', 'web', token);
          /* Backward-compat: purana users.fcm_token column bhi bhara jata rahega */
          if (window.U && window._supa) {
            try {
              window._supa.from('users').update({ fcm_token: token, fcm_updated_at: new Date().toISOString() })
                .eq('id', window.U.uid).then(null, function(){});
            } catch (e) { }
          }
        } else { window._fcmStage = 'empty-token'; }
      }).catch(function(err) {
        /* Notification permission denied/blocked — expected in many cases */
        window._fcmStage = 'error';
        try {
          window._fcmError = (((err && err.code) ? err.code + ': ' : '') + ((err && err.message) || String(err))).slice(0, 300);
        } catch (e2) { }
        console.warn('[FCM] Token error (normal if notifications denied):', (err && (err.code || err.message)) || err);
      });
    };
    /* Foreground message → in-app toast + E2E hook (_lastPushPayload) */
    window.messaging.onMessage(function(payload) {
      console.log('[FCM] Foreground message:', payload);
      try { window._lastPushPayload = payload; } catch (e) { }
      if (window.toast && payload && (payload.notification || payload.data)) {
        var t = (payload.notification && payload.notification.title) || (payload.data && payload.data.title) || 'Notification';
        var b = (payload.notification && payload.notification.body) || (payload.data && payload.data.body) || '';
        window.toast('🔔 ' + t + (b ? ': ' + b : ''), 'inf');
      }
    });
  }
} catch(e) {
  console.warn("[Firebase] FCM init failed (expected in some browsers):", e.message);
  try { window._fcmStage = 'init-fail'; window._fcmError = ('init-fail: ' + (e && e.message || e)).slice(0, 300); } catch (e2) { }
}
