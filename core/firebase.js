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
  measurementId:     "G-XXXXXXXXXX"
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

/* ── Firebase Cloud Messaging (FCM) — for web push on browsers ── */
/* OneSignal handles most push, but FCM token needed for browsers without OneSignal */
window.messaging = null;
window.VAPID_KEY = 'BCxMf_HYHFdoRgI0-9YZZL9aU7tkoBaWEsAJXOsijzgCz1VxGCUBhSqbkqdLFpJ-TbVXR_hKb_ykENVCvQ7TGFY';
try {
  if (firebase.messaging && 'serviceWorker' in navigator) {
    window.messaging = _fireApp.messaging();
    console.log("[Firebase] FCM Messaging ready");
    /* Get FCM token after user grants notification permission */
    window._getFCMToken = function() {
      if (!window.messaging) return;
      /* ✅ Bug 37 Fix: Check permission before calling getToken */
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        console.log('[FCM] Notification permission denied — skipping getToken');
        return;
      }
      /* Request permission first if not granted */
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().then(function(perm) {
          if (perm === 'granted') window._getFCMToken();
          else console.log('[FCM] Permission not granted by user');
        });
        return;
      }
      window.messaging.getToken({ vapidKey: window.VAPID_KEY })
        .then(function(token) {
          if (token) {
            console.log('[FCM] Token obtained:', token.substring(0,20) + '...');
            /* Save to user record so admin can target them */
            if (window.U && window._supa) {
              window._supa.from('users').update({ fcm_token: token, fcm_updated_at: new Date().toISOString() })
                .eq('id', window.U.uid).then(null, function(){});
            }
            window._fcmToken = token;
          }
        })
        .catch(function(err) {
          /* Notification permission denied or blocked — expected in many cases */
          console.warn('[FCM] Token error (normal if notifications denied):', err.code || err.message);
        });
    };
    /* Background message handler */
    window.messaging.onMessage(function(payload) {
      console.log('[FCM] Foreground message:', payload);
      /* Show in-app toast for foreground messages */
      if (window.toast && payload.notification) {
        window.toast('🔔 ' + (payload.notification.title || 'Notification') + ': ' + (payload.notification.body || ''), 'inf');
      }
    });
  }
} catch(e) {
  console.warn("[Firebase] FCM init failed (expected in some browsers):", e.message);
}
