/* ─────────────────────────────────────────────────────
   BOOT — auth.js (Google login) handles auth state.
   boot.js only manages splash + timing.
───────────────────────────────────────────────────── */

function _hideSplash() {
  var sp = $('splash');
  if (sp) { sp.style.opacity = '0'; sp.style.transition = 'opacity 0.3s'; setTimeout(function(){ if(sp) sp.style.display = 'none'; }, 300); }
}

/* Show login screen if not signed in after 4s
   EXCEPT: agar signInWithRedirect se wapas aaya hai → getRedirectResult() pending hoti hai
   Tab loginScreen nahi dikhana — Firebase thodi der mein onAuthStateChanged fire karega */
setTimeout(function() {
  if (!window.U && !window._redirectAuthPending) {
    _hideSplash();
    var ls = $('loginScreen');
    if (ls) ls.style.display = 'flex';
  }
}, 4000);

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

