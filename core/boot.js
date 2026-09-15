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
      /* ✅ BUG FIX (2026-08-25): ign was seeded from the Google account's
         displayName/email at signup — so a brand-new user's Free Fire
         IGN field showed their Google name ("Abc Pqr") pre-filled as if
         it were already their real, verified in-game name. ign is FF-
         specific identity data; it must start empty and only ever be
         set by what the user actually types into the FF IGN field.
         Google's name is kept separately as accountName for
         avatar-letter/greeting purposes only, never as ign. */
      ign:          '',
      accountName:  user.displayName || user.email || 'Player',
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

/* ✅ BUG FIX (2026-07): referral_code assignment split out from account
   creation (see afterLogin below) so a collision here can NEVER block a
   new user's core row from being created. Retries with a different
   random code a few times on collision, then just gives up quietly —
   the user still has a full working account either way; referral_code
   can be backfilled later if it ever ends up null. */
function _assignReferralCode(uid, attempt) {
  attempt = attempt || 0;
  if (attempt >= 3 || !window._supa) return;
  var rc = attempt === 0
    ? uid.substring(0, 8).toUpperCase()
    : (uid.substring(0, 4) + Math.random().toString(36).substring(2, 6)).toUpperCase();
  window._supa.from('users').update({ referral_code: rc }).eq('id', uid)
    .then(function(r) {
      if (r && r.error && r.error.code === '23505') _assignReferralCode(uid, attempt + 1);
    })
    .catch(function() { /* best-effort — not critical enough to retry on network errors */ });
}

/* ✅ BUG FIX (2026-07): closes the retry gap above — retries getMe() a
   few times with backoff (2s, 5s, 10s) after a network/DB error. If it
   turns out to genuinely be a brand new user (null) or comes back fine
   (a real profile), handle it then; if every retry fails, give up
   quietly — the user keeps using the app on cached UD and the next
   action with a self-heal check (e.g. profile submission) can still
   recover it. */
function _retryGetMe(user, attempt) {
  var delays = [2000, 5000, 10000];
  if (attempt >= delays.length || !window.DB || !window.DB.users) return;
  setTimeout(function() {
    DB.users.getMe().then(function(p) {
      if (p === undefined) { _retryGetMe(user, attempt + 1); return; }
      if (p === null) {
        /* ✅ BUG FIX (2026-08-25): don't seed ign from Google displayName —
           see the matching fix + full explanation in _earlyBoot above.
           The users.ign column must start NULL/empty for a real new user;
           it only gets a real value once they submit the FF IGN field. */
        DB.users.create(user.uid, {
          ign: null,
          email: user.email || '',
          avatar_url: user.photoURL || null
        }).then(function() { _assignReferralCode(user.uid); });
        return;
      }
      /* ✅ BUG FIX (2026-08-24): "Green Diamond (aur baaki har snake_case
         field) header me 0 dikhta hai" — was a raw `window.UD = p`
         here with p being the raw Supabase row (green_diamonds,
         sky_diamonds, ...). Every screen reads the camelCase fields
         (greenDiamonds, skyDiamonds) that only _applyUser's snake→camel
         mapping produces — route through it instead of overwriting UD
         with unmapped raw data. */
      if (window._applyUser) window._applyUser(p); else window.UD = p;
      _syncToFirebase(user, p);
      if (window.updateHdr) try { updateHdr(); } catch(e) {}
      if (window.renderHome) try { renderHome(); } catch(e) {}
    }).catch(function() {});
  }, delays[attempt]);
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

      if (profile === null) {
        /* getMe() returns null ONLY when there's genuinely no profile row
           yet (see core/db.js) — safe to treat as a brand new user. */
        /* ✅ BUG FIX (2026-07): referral_code used to be generated
           deterministically (first 8 chars of the Firebase UID) and sent
           in THIS critical insert. If it ever collided with another
           user's code (rare, but the whole point of a bug report is the
           rare case), the row creation failed — permanently, since this
           only runs once per account. Moved referral_code assignment to
           a separate, non-blocking follow-up call with its own retry, so
           the core account row can never fail to be created because of it. */
        /* ✅ BUG FIX (2026-08-24): expose this create() call as an
           awaitable promise on window so profile.js's own self-heal
           (_ensureUserRowExists, used by the "Submit for Verification"
           button) can just await THIS instead of firing a second,
           racing create() call for the same brand-new uid — removes the
           root cause of the PGRST116 race entirely rather than just
           handling its symptom. */
        /* ✅ BUG FIX (2026-08-25): don't seed ign from Google displayName —
           see _earlyBoot for full explanation. */
        window._userRowCreatePromise = DB.users.create(user.uid, {
          ign:          null,
          email:        user.email       || '',
          avatar_url:   user.photoURL    || null
        });
        window._userRowCreatePromise.then(function() {
          _assignReferralCode(user.uid); // best-effort, retries on collision, never blocks
          DB.users.getMe().then(function(p) {
            /* ✅ BUG FIX (2026-08-24): same snake_case-vs-camelCase bug
               as elsewhere — route through _applyUser's mapping. */
            if (p && window._applyUser) window._applyUser(p); else window.UD = p || window.UD;
            _refreshUI();
            setTimeout(function() {
              /* BUG FIX (2026-07): getMe() used to return null for BOTH
                 "genuinely new user" and "network error on an existing
                 user" — so any transient fetch failure for a RETURNING
                 user made the app think they were new and re-show this
                 popup, over and over. getMe() now only returns null for a
                 real new user, so this branch itself is reliable again.
                 Keeping the localStorage check here too as a second,
                 harmless safety net in case this ever runs more than
                 once for the same person. */
              var alreadyAccepted = window.U && localStorage.getItem('_mes_policy_' + window.U.uid) === '1';
              if (!alreadyAccepted && window.showWithdrawalPolicy) window.showWithdrawalPolicy(null);
            }, 2500);
          });
        }).catch(function() {
          _refreshUI(); /* Existing UD se hi kaam chalo */
        });
      } else if (profile === undefined) {
        /* getMe() returns undefined when the fetch itself failed (network/
           DB error) — NOT the same as "no profile exists". Render with
           whatever window.UD already has for now, but actually retry a
           few times with backoff instead of just hoping something else
           triggers a re-check later (nothing did — this was the gap that
           let a user's Supabase row stay unconfirmed for an entire
           session if only the very first check hit a network hiccup). */
        _refreshUI();
        _retryGetMe(user, 0);
      } else {
        /* ✅ BUG FIX (2026-08-24): same snake_case-vs-camelCase bug. */
        if (window._applyUser) window._applyUser(profile); else window.UD = profile;
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
      /* ✅ BUG FIX (2026-08-25): don't seed ign from Google displayName —
         see _earlyBoot for full explanation. */
      DB.users.create(user.uid, {
        ign:          null,
        email:        user.email       || '',
        avatar_url:   user.photoURL    || null,
        referral_code: rc
      }).then(function() {
        DB.users.getMe().then(function(p) {
          if (p) {
            /* ✅ BUG FIX (2026-08-24): same snake_case-vs-camelCase bug. */
            if (window._applyUser) window._applyUser(p); else window.UD = p;
            _refreshUI();
            try { if (window.mesInit) mesInit(); } catch(e) {}
            setTimeout(function() {
              try { if (window._getFCMToken) window._getFCMToken(); } catch(e) {}
            }, 2000);
          }
        }).catch(function() {});
      }).catch(function() {
        DB.users.getMe().then(function(p) {
          if (p) { if (window._applyUser) window._applyUser(p); else window.UD = p; _refreshUI(); }
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
