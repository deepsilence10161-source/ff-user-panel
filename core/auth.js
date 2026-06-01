/* ════════════════════════════════════════════════════════════════
   AUTH v3 — GOOGLE ONLY
   Flow:
   1. User clicks "Continue with Google"
   2. Firebase handles Google OAuth (popup browser / redirect WebView)
   3. Firebase JWT token → Supabase signInWithIdToken (Firebase provider)
   4. Supabase RLS now works — auth.uid() = Firebase UID ✅
   5. Device fingerprint stored for anti-cheat (not for auth)
════════════════════════════════════════════════════════════════ */

/* ── WebView detection ── */
function _isWebView() {
  if (window.isAndroidApp === true) return true;
  var ua = navigator.userAgent || '';
  return /; wv\)/.test(ua) ||
         /Version\/[\d.]+.*Chrome\/[\d.]+.*Mobile Safari/.test(ua);
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
  var fbAuth = window.auth;
  if (!fbAuth || !window.gp) {
    _loginError('Firebase not ready — please refresh karo');
    return;
  }
  _loginLoading(true);

  if (_isWebView()) {
    /* Android WebView — signInWithRedirect */
    window.gp.setCustomParameters({ prompt: 'select_account' });
    fbAuth.signInWithRedirect(window.gp)
      .catch(function(e) { _loginError(_friendlyErr(e)); });
  } else {
    /* Browser — signInWithPopup */
    fbAuth.signInWithPopup(window.gp)
      .then(function() { /* onAuthStateChanged handles rest */ })
      .catch(function(e) {
        if (e.code === 'auth/popup-blocked' ||
            e.code === 'auth/operation-not-supported-in-this-environment') {
          /* Fallback to redirect */
          fbAuth.signInWithRedirect(window.gp)
            .catch(function(e2) { _loginError(_friendlyErr(e2)); });
        } else {
          _loginError(_friendlyErr(e));
        }
      });
  }
};

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

  /* ── Sync Firebase JWT to Supabase ──
     Supabase Firebase integration is enabled → signInWithIdToken works.
     This creates a Supabase session so RLS (auth.uid()) works correctly. */
  if (window._supa) {
    try {
      var token = await user.getIdToken(true);
      await window._supa.auth.signInWithIdToken({
        provider: 'firebase',
        token:    token
      });
      console.log('[Auth] Supabase session created via Firebase JWT ✅');
    } catch(e) {
      console.warn('[Auth] Supabase JWT sync warn:', e.message);
      /* Not fatal — Supabase will use anon role if JWT fails */
    }
  }

  /* Hide login, proceed to app */
  var ls = document.getElementById('loginScreen');
  if (ls) ls.style.display = 'none';

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

  window.U  = null;
  window.UD = null;
};

/* Start auth */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initFirebaseAuth);
} else {
  _initFirebaseAuth();
}
