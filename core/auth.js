/* ════════════════════════════════════════════════════════════════
   AUTH v4 — GOOGLE VIA FIREBASE ONLY
   Flow:
   1. User clicks "Continue with Google"
   2. Firebase handles Google OAuth (popup / redirect WebView)
   3. Firebase ID token → Supabase client recreated with Bearer header
      (Supabase Third-Party Auth — NOT signInWithIdToken)
   4. Supabase RLS works — auth.uid() = Firebase UID ✅
   5. Token auto-refresh: onIdTokenChanged re-syncs when Firebase
      silently refreshes the token (every ~1 hour)
   6. Device fingerprint stored for anti-cheat (not for auth)
════════════════════════════════════════════════════════════════ */

/* ── WebView detection ── */
function _isWebView() {
  if (window.isAndroidApp === true) return true;
  var ua = navigator.userAgent || '';
  /* "; wv)" is the definitive Android WebView marker.
     Removed Version/X Chrome/X pattern — it false-positives on real Android Chrome. */
  return /; wv\)/.test(ua);
}

/* ── Show/hide loading state ── */
function _loginLoading(on) {
  var btn  = document.getElementById('googleLoginBtn');
  var load = document.getElementById('loginLoading');
  var err  = document.getElementById('loginErr');
  if (btn)  btn.style.display  = on ? 'none' : 'flex';
  if (load) load.style.display = on ? 'flex'  : 'none';
  if (err && on) err.style.display = 'none';
}

function _loginError(msg) {
  var btn  = document.getElementById('googleLoginBtn');
  var load = document.getElementById('loginLoading');
  var err  = document.getElementById('loginErr');
  if (btn)  { btn.style.display = 'flex'; btn.disabled = false; }
  if (load) load.style.display = 'none';
  if (err)  { err.textContent = msg; err.style.display = 'block'; }
}

/* ════════════════════════════════════════════════════════════════
   MAIN GOOGLE LOGIN
════════════════════════════════════════════════════════════════ */
window.doGoogleLogin = function() {
  var btn = document.getElementById('googleLoginBtn');
  if (btn) { btn.disabled = true; }

  /* ── Wait for Firebase Auth to be ready (max 6 seconds) ── */
  var _attempts = 0;
  function _tryLogin() {
    _attempts++;
    var fbAuth = window.auth;
    var fbGp   = window.gp;

    if (!fbAuth || !fbGp) {
      if (_attempts < 30) {
        /* Retry every 200ms — Firebase usually loads within 1-2s */
        setTimeout(_tryLogin, 200);
        return;
      }
      /* After 6s still not ready — show error */
      if (btn) btn.disabled = false;
      _loginError('Firebase load nahi hua — page refresh karo');
      return;
    }

    _loginLoading(true);

    if (_isWebView()) {
      /* Android WebView — Google blocks signInWithRedirect since 2021.
         Strategy: try popup first → if blocked, try redirect with LOCAL persistence
         → if Google blocks that too, show "open in browser" fallback. */
      fbGp.setCustomParameters({ prompt: 'select_account' });

      fbAuth.signInWithPopup(fbGp)
        .then(function() { /* onAuthStateChanged handles rest */ })
        .catch(function(e) {
          var code = (e && e.code) || '';

          if (code === 'auth/popup-blocked' ||
              code === 'auth/operation-not-supported-in-this-environment' ||
              code === 'auth/cancelled-popup-request') {
            /* Popup blocked — fallback: redirect with LOCAL persistence
               (avoids sessionStorage clearing issue in WebView) */
            var persist = (window.firebase && window.firebase.auth &&
                           window.firebase.auth.Auth &&
                           window.firebase.auth.Auth.Persistence &&
                           window.firebase.auth.Auth.Persistence.LOCAL) || 'local';
            fbAuth.setPersistence(persist)
              .then(function() { return fbAuth.signInWithRedirect(fbGp); })
              .catch(function(e2) {
                /* Google blocked redirect too — show browser fallback */
                _showBrowserFallback();
              });
          } else {
            _loginError(_friendlyErr(e));
          }
        });
    } else {
      /* Browser — signInWithPopup */
      fbAuth.signInWithPopup(fbGp)
        .then(function() { /* onAuthStateChanged handles rest */ })
        .catch(function(e) {
          if (e.code === 'auth/popup-blocked' ||
              e.code === 'auth/operation-not-supported-in-this-environment') {
            /* Fallback to redirect */
            fbAuth.signInWithRedirect(fbGp)
              .catch(function(e2) { _loginError(_friendlyErr(e2)); });
          } else {
            _loginError(_friendlyErr(e));
          }
        });
    }
  } /* end _tryLogin */

  _tryLogin();
};

/* ── Browser fallback for WebView Google-auth block ── */
function _showBrowserFallback() {
  var err = document.getElementById('loginErr');
  var appUrl = window.location.href.split('?')[0];
  var msg = '⚠️ Google login WebView mein restricted hai.\n' +
            'Chrome mein kholkar login karo:';
  if (err) {
    err.innerHTML =
      '<div style="font-size:13px;line-height:1.5">' +
        '⚠️ Google login in-app browser mein nahi chalta.<br>' +
        '<a href="' + appUrl + '" target="_blank" ' +
           'style="color:#6366f1;font-weight:bold;text-decoration:underline">' +
          '👉 Chrome mein kholkar login karo' +
        '</a><br>' +
        '<small style="opacity:0.7">Login ke baad wapas app mein aao</small>' +
      '</div>';
    err.style.display = 'block';
  }
  var btn = document.getElementById('googleLoginBtn');
  if (btn) { btn.style.display = 'flex'; btn.disabled = false; }
  var load = document.getElementById('loginLoading');
  if (load) load.style.display = 'none';
}

function _friendlyErr(e) {
  var code = (e && e.code) || '';
  if (code === 'auth/popup-closed-by-user')   return 'Login cancel kar diya — dobara try karo';
  if (code === 'auth/unauthorized-domain')     return '⚠️ Domain authorized nahi — Firebase Console mein add karo';
  if (code === 'auth/network-request-failed')  return '📡 Network error — internet check karo';
  if (code === 'auth/too-many-requests')       return '⏳ Too many attempts — thodi der baad try karo';
  return e.message || 'Login failed — dobara try karo';
}

/* ════════════════════════════════════════════════════════════════
   FIREBASE AUTH STATE — handles login + redirect result
════════════════════════════════════════════════════════════════ */
function _initFirebaseAuth() {
  var fbAuth = window.auth;
  if (!fbAuth) { setTimeout(_initFirebaseAuth, 400); return; }

  /* Handle redirect result (WebView) */
  if (typeof fbAuth.getRedirectResult === 'function') {
    fbAuth.getRedirectResult()
      .then(function(result) {
        if (result && result.user) {
          console.log('[Auth] Redirect login success');
        }
      })
      .catch(function(e) {
        if (e && e.code && e.code !== 'auth/no-auth-event') {
          console.warn('[Auth] Redirect result error:', e.code);
          _loginError(_friendlyErr(e));
        }
      });
  }

  /* Auth state listener */
  fbAuth.onAuthStateChanged(async function(user) {
    if (user) {
      console.log('[Auth] User signed in:', user.uid);
      _loginLoading(false);
      await _handleSignIn(user);
    } else {
      /* Signed out — show login */
      _loginLoading(false);
      var ls = document.getElementById('loginScreen');
      var mc = document.getElementById('mainContent');
      var hd = document.getElementById('header');
      var bn = document.getElementById('bottomNav');
      if (ls) ls.style.display = 'flex';
      if (mc) mc.style.display = 'none';
      if (hd) hd.style.display = 'none';
      if (bn) bn.style.display = 'none';
    }
  });

  /* Token refresh listener — Firebase silently refreshes token every ~1hr.
     Re-sync with Supabase so RLS keeps working without requiring re-login. */
  if (typeof fbAuth.onIdTokenChanged === 'function') {
    fbAuth.onIdTokenChanged(async function(user) {
      if (user && window.U) {
        /* Only sync if already logged in (not on initial login — handled above) */
        if (window.DB && window.DB.auth && window.DB.auth.syncFirebaseToken) {
          await window.DB.auth.syncFirebaseToken(user);
          console.log('[Auth] Firebase token refreshed → Supabase re-synced ✅');
        }
      }
    });
  }
}

/* ════════════════════════════════════════════════════════════════
   HANDLE SIGN IN — Firebase → Supabase JWT sync
════════════════════════════════════════════════════════════════ */
async function _handleSignIn(user) {
  /* Set global user object */
  window.U = {
    uid:         user.uid,
    displayName: user.displayName || user.email || 'Player',
    email:       user.email       || '',
    photoURL:    user.photoURL    || null
  };

  /* ── Sync Firebase JWT → Supabase (Third-Party Auth) ──
     Supabase Third-Party Auth is enabled for Firebase project fft-app-1e283.
     Correct method: recreate Supabase client with Firebase token as
     Authorization Bearer header (NOT signInWithIdToken — that's for OAuth).
     Supabase then validates the token via Firebase's JWKS endpoint. */
  if (window.DB && window.DB.auth && window.DB.auth.syncFirebaseToken) {
    await window.DB.auth.syncFirebaseToken(user);
  } else if (window._supa) {
    /* Fallback: wait for DB to init then sync */
    setTimeout(async function() {
      if (window.DB && window.DB.auth && window.DB.auth.syncFirebaseToken) {
        await window.DB.auth.syncFirebaseToken(user);
      }
    }, 500);
  }

  /* Hide login, proceed to app */
  var ls = document.getElementById('loginScreen');
  if (ls) ls.style.display = 'none';

  /* Signal Android: user logged in — interstitial ab dikhana safe hai */
  try {
    if (window.Android && typeof window.Android.onUserLoggedIn === 'function') {
      window.Android.onUserLoggedIn();
    }
  } catch(e) {}

  /* Save device fingerprint for anti-cheat */
  if (window.generateAdvancedFingerprint) {
    window.generateAdvancedFingerprint().then(function(fp) {
      if (window.db) {
        window.db.ref('users/' + user.uid + '/lastFP').set(fp);
        window.db.ref('users/' + user.uid + '/lastSeen').set(Date.now());
      }
      if (window._supa) {
        window._supa.from('users').update({ device_fp: fp })
          .eq('id', user.uid).catch(function(){});
      }
    });
  }

  /* Save OneSignal tag */
  if (window._saveOneSignalId) window._saveOneSignalId(user.uid);

  /* Boot app */
  if (window.afterLogin) window.afterLogin(window.U);
}

/* ════════════════════════════════════════════════════════════════
   LOGOUT
════════════════════════════════════════════════════════════════ */
window.doLogout = function() {
  /* Clear offline queue */
  try {
    window._unreadNotifCount = 0;
    var badge = document.querySelector('.notif-badge,#notifBadge');
    if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
    if (window.OQ && window.OQ.clearAll) window.OQ.clearAll();
  } catch(e) {}

  /* Sign out both Firebase and Supabase */
  try { if (window.auth) window.auth.signOut(); } catch(e) {}
  try { if (window._supa) window._supa.auth.signOut(); } catch(e) {}

  /* Signal Android: user logged out */
  try {
    if (window.Android && typeof window.Android.onUserLoggedOut === 'function') {
      window.Android.onUserLoggedOut();
    }
  } catch(e) {}

  window.U  = null;
  window.UD = null;
};

/* Start auth */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initFirebaseAuth);
} else {
  _initFirebaseAuth();
}
