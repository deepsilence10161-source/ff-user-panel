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
  /* Android bridge available hai to 100% WebView hai */
  if (window.Android && typeof window.Android.isAndroidApp === 'function') {
    try { return window.Android.isAndroidApp(); } catch(e) {}
  }
  if (window.isAndroidApp === true) return true;
  var ua = navigator.userAgent || '';
  /* "; wv)" is the definitive Android WebView marker */
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
      /* ── Native Android Google Sign-In ───────────────────────
         Flow:
         1. Android.nativeGoogleSignIn() call hota hai
         2. Google ka OFFICIAL account picker khulta hai
            (wahan pehle se saved Google accounts dikh'te hain ✅)
         3. User apna account select karta hai
         4. Android ko Google ID token milta hai
         5. Android → window.onNativeGoogleToken(token) inject karta hai
         6. WebView mein Firebase signInWithCredential(token) hota hai
         7. onAuthStateChanged fires → normal login flow ✅
         No redirect_uri issues. No 400 errors. ✅ */

      if (window.Android && typeof window.Android.nativeGoogleSignIn === 'function') {
        window.Android.nativeGoogleSignIn();
        /* Token callback: window.onNativeGoogleToken() — neeche define hai */
        return; /* wait for callback */
      }

      /* Fallback — agar native bridge nahi hai (purani app) */
      window._redirectAuthPending = true;
      fbGp.setCustomParameters({ prompt: 'select_account' });
      fbAuth.signInWithRedirect(fbGp)
        .catch(function(e) {
          window._redirectAuthPending = false;
          _loginError(_friendlyErr(e));
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

/* ════════════════════════════════════════════════════════════════
   NATIVE ANDROID GOOGLE SIGN-IN CALLBACKS
   MainActivity.java → webView.evaluateJavascript() se aate hain
════════════════════════════════════════════════════════════════ */

/* Android ne Google ID token diya — Firebase mein sign in karo */
window.onNativeGoogleToken = async function(googleIdToken) {
  try {
    var GoogleAuthProvider = window.firebase && window.firebase.auth &&
                             window.firebase.auth.GoogleAuthProvider;
    if (!GoogleAuthProvider) throw new Error('Firebase auth not loaded');
    var credential = GoogleAuthProvider.credential(googleIdToken);
    await window.auth.signInWithCredential(credential);
    /* onAuthStateChanged fire hoga → _handleSignIn → login complete ✅ */
  } catch(e) {
    console.error('[Auth] Native sign-in credential error:', e);
    _loginLoading(false);
    _loginError(_friendlyErr(e));
  }
};

/* Android ne error diya — proper handling with helpful messages */
window.onNativeGoogleError = function(errMsg) {
  console.warn('[Auth] Native Google Sign-In error:', errMsg);
  _loginLoading(false);

  var code = '';
  var m = errMsg && errMsg.match(/Code:(\d+)/);
  if (m) code = m[1];

  if (code === '12501') {
    /* User ne cancel kiya — silently reset */
    var btn = document.getElementById('googleLoginBtn');
    if (btn) { btn.style.display = 'flex'; btn.disabled = false; }
    var load = document.getElementById('loginLoading');
    if (load) load.style.display = 'none';
    return;
  }

  if (code === '10') {
    /* DEVELOPER_ERROR: SHA-1 Firebase mein register nahi hai
       → GitHub Actions build logs mein "Print SHA-1" step dekho
       → Firebase Console → Project Settings → Android App → Add Fingerprint */
    _loginError('Setup incomplete: GitHub Actions logs mein SHA-1 copy karo → Firebase Console mein register karo');
    return;
  }

  if (code === '7') {
    _loginError('No internet — check connection aur retry karo');
    return;
  }

  _loginError('Google sign-in failed — dobara try karo');
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
    /* Agar redirect se wapas aaye hain → flag set karo taaki boot.js timer
       loginScreen na dikhaye jab tak auth complete na ho */
    window._redirectAuthPending = true;
    fbAuth.getRedirectResult()
      .then(function(result) {
        window._redirectAuthPending = false;
        if (result && result.user) {
          console.log('[Auth] Redirect login success');
          /* _hideSplash karo — ab loginScreen nahi chahiye */
          if (window._hideSplash) window._hideSplash();
        } else {
          /* Redirect nahi tha — normal page load */
        }
      })
      .catch(function(e) {
        window._redirectAuthPending = false;
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
      /* ── Splash turant hide karo — black screen prevent karo ── */
      if (window._hideSplash) window._hideSplash();
      var ls = document.getElementById('loginScreen');
      if (ls) ls.style.display = 'none';
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

  /* Native Google Sign-Out — next login pe account picker phir se aaye */
  try {
    if (window.Android && typeof window.Android.nativeGoogleSignOut === 'function') {
      window.Android.nativeGoogleSignOut();
    }
  } catch(e) {}

  /* Signal Android: user logged out */
  try {
    if (window.Android && typeof window.Android.onUserLoggedOut === 'function') {
      window.Android.onUserLoggedOut();
    }
  } catch(e) {}

  window.U  = null;
  window.UD = null;
};

/* ── Deep Link Auth Handler ─────────────────────────────────────────────
   MainActivity.onNewIntent() yeh call karta hai jab Chrome Custom Tab se
   miniesports://auth deep link ke through app wapas aata hai.
   Tab band ho gayi — ab Firebase se getRedirectResult() lena hai. ──────── */
window._onAuthDeepLink = function(deepLinkUrl) {
  window._redirectAuthPending = false;
  console.log('[Auth] Deep link received:', deepLinkUrl);

  /* Firebase getRedirectResult() ab result dega kyunki Custom Tab mein
     Firebase ne auth complete kar liya aur session set kar diya */
  if (fbAuth && typeof fbAuth.getRedirectResult === 'function') {
    fbAuth.getRedirectResult()
      .then(function(result) {
        if (result && result.user) {
          console.log('[Auth] Custom Tab login success via deep link');
          /* onAuthStateChanged bhi fire hoga — _handleSignIn double-guard hai */
        } else {
          /* Result nahi mila — onAuthStateChanged pe rely karo */
          console.log('[Auth] No redirect result — waiting for onAuthStateChanged');
          /* Agar 5s mein bhi kuch nahi hua to login screen dikhao */
          setTimeout(function() {
            if (!window.U) { _loginLoading(false); }
          }, 5000);
        }
      })
      .catch(function(e) {
        console.warn('[Auth] Deep link getRedirectResult error:', e && e.code);
        _loginError(_friendlyErr(e));
      });
  }
};

/* Start auth */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initFirebaseAuth);
} else {
  _initFirebaseAuth();
}
