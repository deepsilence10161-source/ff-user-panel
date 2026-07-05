/* ─────────────────────────────────────────────────────
   BOOT — auth.js (Google login) handles auth state.
   boot.js only manages splash + timing.
   v32-FIX: UI immediately show karo — black screen nahi
───────────────────────────────────────────────────── */

function _hideSplash() {
  var sp = $('splash');
  if (sp) {
    sp.style.opacity = '0';
    sp.style.transition = 'opacity 0.25s';
    setTimeout(function() { if (sp) sp.style.display = 'none'; }, 250);
  }
}

/* Login screen: 4s ke baad show karo ONLY agar logged out hai */
setTimeout(function() {
  if (!window.U && !window._redirectAuthPending) {
    _hideSplash();
    var ls = $('loginScreen');
    if (ls) ls.style.display = 'flex';
  }
}, 4000);

/* ── EARLY BOOT: UI immediately show karo with minimal UD ──
   Problem: pehle Supabase load hone ka wait karta tha → black screen
   Fix: skeleton UD set karo, UI show karo, phir data background mein
   load karo aur UI refresh karo silently. */
function _earlyBoot(user) {
  if (window._bootCalled) return; /* already booted */
  /* Minimal UD — profile data aane se pehle ka placeholder */
  if (!window.UD) {
    window.UD = {
      uid:          user.uid,
      ign:          user.displayName || user.email || 'Player',
      email:        user.email       || '',
      profileImage: user.photoURL    || '',
      coins:        0,
      skyDiamonds:  0,
      greenDiamonds:0,
      realMoney:    { deposited: 0, winnings: 0, bonus: 0 },
      stats:        { matches: 0, wins: 0, kills: 0, earnings: 0 },
      profileStatus: 'not_requested',
      rankTier:     'bronze',
      rankPoints:   0
    };
  }
  boot(); /* Show header + bottomNav + mainContent immediately */
}

function afterLogin(user) {
  /* ── STEP 1: UI turant dikhao ── */
  _earlyBoot(user);

  /* ── STEP 2: Real data background mein load karo ── */
  var _dataLoaded = false;
  var _dataTimer = setTimeout(function() {
    if (!_dataLoaded) {
      console.warn('[Boot] Data load timeout (10s) — using minimal UD');
      _dataLoaded = true;
      _refreshUI();
    }
  }, 10000);

  function _refreshUI() {
    /* Data aa gaya — silently refresh UI */
    try { if (window.updateHdr)  updateHdr();  } catch(e) {}
    try { if (window.renderHome) renderHome(); } catch(e) {}
  }

  function _doSupaLoad() {
    if (!window.DB || !window._supaReady) return false;
    DB.users.getMe().then(function(profile) {
      clearTimeout(_dataTimer);
      if (_dataLoaded) return;
      _dataLoaded = true;

      if (!profile) {
        /* Naya user — Supabase mein create karo */
        var rc = user.uid.substring(0, 8).toUpperCase();
        DB.users.create(user.uid, {
          ign:          user.displayName || user.email || 'Player',
          email:        user.email       || '',
          avatar_url:   user.photoURL    || null,
          referral_code: rc
        }).then(function() {
          DB.users.getMe().then(function(p) {
            window.UD = p || window.UD;
            _refreshUI();
            setTimeout(function() {
              if (window.showWithdrawalPolicy) window.showWithdrawalPolicy(null);
            }, 2500);
          });
        }).catch(function() {
          _refreshUI(); /* Existing UD se hi kaam chalo */
        });
      } else {
        window.UD = profile;
        _syncToFirebase(user, profile);
        _refreshUI(); /* Real data se UI update */
      }
    }).catch(function(err) {
      console.warn('[afterLogin] Supabase failed, Firebase fallback:', err && err.message);
      _doFirebaseLoad();
    });
    return true;
  }

  function _syncToFirebase(user, supaProfile) {
    try { if (window.analytics) analytics.login('supabase'); } catch(e) {}
  }

  function _doFirebaseLoad() {
    clearTimeout(_dataTimer);
    if (_dataLoaded) return;
    _dataLoaded = true;
    /* UD already set by _earlyBoot — just refresh after a moment */
    _refreshUI();

    /* Background: Supabase mein user ensure karo */
    setTimeout(function() {
      if (!window.DB || !window._supaReady) return;
      var rc = user.uid.substring(0, 8).toUpperCase();
      DB.users.create(user.uid, {
        ign:          user.displayName || user.email || 'Player',
        email:        user.email       || '',
        avatar_url:   user.photoURL    || null,
        referral_code: rc
      }).then(function() {
        DB.users.getMe().then(function(p) {
          if (p) {
            window.UD = p;
            _refreshUI();
            try { if (window.mesInit) mesInit(); } catch(e) {}
            setTimeout(function() {
              try { if (window._getFCMToken) window._getFCMToken(); } catch(e) {}
            }, 2000);
          }
        }).catch(function() {});
      }).catch(function() {
        DB.users.getMe().then(function(p) {
          if (p) { window.UD = p; _refreshUI(); }
        }).catch(function() {});
      });
    }, 1500);
  }

  /* Supabase try karo */
  if (!_doSupaLoad()) {
    /* Supabase abhi ready nahi — 1s baad retry */
    setTimeout(function() {
      if (!_doSupaLoad()) _doFirebaseLoad();
    }, 1000);
  }
}
