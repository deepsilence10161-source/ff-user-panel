var _authFired = window._authFired;
function _hideSplash() {
  var sp = $('splash');
  if (sp) { sp.style.opacity = '0'; sp.style.transition = 'opacity 0.3s'; setTimeout(function(){ if(sp) sp.style.display = 'none'; }, 300); }
}
setTimeout(function() {
  if (!window._authFired) {
    _hideSplash();
    var ls = $('loginScreen');
    if (ls) ls.style.display = 'flex';
  }
}, 3000);

/* ── REDIRECT RESULT — WebView Google login ke baad ── */
/* Firebase Auth redirect result (Google login from WebView) */
if (window.auth && typeof auth.getRedirectResult === 'function') {
  auth.getRedirectResult().then(function(result) {
    if (result && result.user) {
      console.log('✅ Google redirect login success:', result.user.email);
    }
  }).catch(function(err) {
    if (err && err.code && err.code !== 'auth/no-auth-event') {
      console.warn('Redirect result error:', err.code, err.message);
    }
  });
}

/* Firebase Auth state - handles Google login */
if (window.auth && typeof auth.onAuthStateChanged === 'function') {
  auth.onAuthStateChanged(function(user) {
    window._authFired = true; _authFired = true;
    _hideSplash();
    if (user) {
      /* If Supabase already handled this login, skip duplicate */
      if (window._supaAuthHandled) { console.log('[Boot] Supabase already handled auth, skipping Firebase dup'); return; }
      U = { uid: user.uid, displayName: user.displayName || user.email, email: user.email, photoURL: user.photoURL };
      $('loginScreen').style.display = 'none';
      afterLogin(U);
      if (window.saveDeviceFingerprint) window.saveDeviceFingerprint(user.uid);
      if (window._saveOneSignalId) _saveOneSignalId(user.uid);
    } else {
      /* Only show login if Supabase also not logged in */
      if (!window._supaAuthHandled) {
        $('loginScreen').style.display = 'flex';
        $('header').style.display = 'none';
        $('bottomNav').style.display = 'none';
        $('mainContent').style.display = 'none';
      }
    }
  });
}

function afterLogin(user) {
  /* C6 Fix: Increase safety timeout to 10000ms (10s). Supabase profile loads
     can take 7-9s on very slow mobile connections. 6s and 8s both caused blank
     screens. Guard: only fire if _bootDone still false (prevents double-boot). */
  var _bootDone = false;
  var _bootTimer = setTimeout(function() {
    if (!_bootDone) { _bootDone = true; console.warn('[Boot] Force-boot after 10s timeout'); boot(); }
  }, 10000);

  /* Try Supabase first, Firebase RTDB as fallback */
  function _doSupaLoad() {
    if (!window.DB || !window._supaReady) return false;
    DB.users.getMe().then(function(profile) {
      clearTimeout(_bootTimer);
      if (!profile) {
        /* New user — create in Supabase */
        var rc = user.uid.substring(0, 8).toUpperCase();
        DB.users.create(user.uid, {
          ign: user.displayName || user.email || 'Player',
          email: user.email || '',
          avatar_url: user.photoURL || null,
          referral_code: rc
        }).then(function() {
          DB.users.getMe().then(function(p) {
            window.UD = p || { uid: user.uid, ign: user.displayName || 'Player', coins: 0, sky_diamonds: 0, profileStatus: 'not_requested' };
            if (!_bootDone) { _bootDone = true; boot(); }
            setTimeout(function() { if (window.showWithdrawalPolicy) window.showWithdrawalPolicy(null); }, 2500);
          });
        }).catch(function() {
          window.UD = { uid: user.uid, ign: user.displayName || 'Player', coins: 0, sky_diamonds: 0, profileStatus: 'not_requested' };
          if (!_bootDone) { _bootDone = true; boot(); }
        });
      } else {
        window.UD = profile;
        /* Also sync to Firebase RTDB for compatibility with realtime listeners */
        _syncToFirebase(user, profile);
        if (!_bootDone) { _bootDone = true; boot(); }
      }
    }).catch(function(err) {
      console.warn('[afterLogin] Supabase load failed, trying Firebase:', err && err.message);
      _doFirebaseLoad();
    });
    return true;
  }

  function _syncToFirebase(user, supaProfile) {
    /* v3.0: No longer syncing to Firebase RTDB — Supabase is source of truth */
    /* Only keep user identity in Firebase for Analytics */
    try { if (window.analytics) analytics.login('supabase'); } catch(e) {}
  }

  function _doFirebaseLoad() {
    /* v3.0: Firebase fallback — but STILL ensure user exists in Supabase */
    clearTimeout(_bootTimer);
    /* Set minimal UD from Firebase immediately so boot() can proceed */
    window.UD = {
      uid: user.uid, ign: user.displayName || user.email || 'Player',
      email: user.email || '', profileImage: user.photoURL || '',
      coins: 0, skyDiamonds: 0, greenDiamonds: 0,
      realMoney: { deposited: 0, winnings: 0, bonus: 0 },
      stats: { matches: 0, wins: 0, kills: 0, earnings: 0 },
      profileStatus: 'not_requested'
    };
    if (!_bootDone) { _bootDone = true; boot(); }

    /* Background: ensure Supabase has this user (upsert — safe to call even if exists) */
    /* This prevents _doSupaLoad() failing with "user not found" on next login */
    setTimeout(function() {
      if (!window.DB || !window._supaReady) return;
      var rc = user.uid.substring(0, 8).toUpperCase();
      DB.users.create(user.uid, {
        ign: user.displayName || user.email || 'Player',
        email: user.email || '',
        avatar_url: user.photoURL || null,
        referral_code: rc
      }).then(function() {
        /* Re-load full profile into UD so features get real data */
        DB.users.getMe().then(function(p) {
          if (p) {
            window.UD = p;
            try { if (window.updateHdr) updateHdr(); } catch(e) {}
            try { if (window.mesInit) mesInit(); } catch(e) {}
            setTimeout(function() { try { if (window._getFCMToken) window._getFCMToken(); } catch(e) {} }, 2000);
          }
        }).catch(function() {});
      }).catch(function() {
        /* User already exists — load profile */
        DB.users.getMe().then(function(p) {
          if (p) {
            window.UD = p;
            try { if (window.updateHdr) updateHdr(); } catch(e) {}
          }
        }).catch(function() {});
      });
    }, 1500);
  }

  /* Try Supabase first */
  if (!_doSupaLoad()) {
    /* Supabase not ready yet — wait then try again */
    setTimeout(function() {
      if (!_doSupaLoad()) _doFirebaseLoad();
    }, 1000);
  }
}

