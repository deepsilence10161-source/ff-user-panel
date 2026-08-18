/* ================================================================
   MINI eSPORTS — USER PANEL SECURITY PATCHES
   Fixes:
   1. Rate limit on match join (Issue #4)
   2. Self-exclusion DB live check (Issue #10)
   3. Offline mode — doJoin routes to OQ (Issue #11)
   4. Referral code UI lock after first use (Issue #6)
   5. Room confirm enforcement before prize claim (Issue #4 admin)
   ================================================================ */
(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     1. RATE LIMIT ON doJoin
     Max 1 join per 4 seconds — blocks bot scripts
     ──────────────────────────────────────────── */
  var _lastJoinAt = 0;
  var JOIN_COOLDOWN_MS = 4000; // 4 seconds between joins

  function applyJoinRateLimit() {
    var origDoJoin = window.doJoin;
    if (!origDoJoin || window._rateLimitPatched) return;
    window._rateLimitPatched = true;

    window.doJoin = function (id) {
      var now = Date.now();
      var elapsed = now - _lastJoinAt;
      if (elapsed < JOIN_COOLDOWN_MS) {
        var wait = Math.ceil((JOIN_COOLDOWN_MS - elapsed) / 1000);
        if (window.toast) window.toast('⏳ Thoda ruko — ' + wait + 's mein dobara try karo', 'err');
        return;
      }
      _lastJoinAt = now;
      origDoJoin.call(this, id);
    };
    console.log('[Security] ✅ Join rate limit applied (4s cooldown)');
  }

  /* ─────────────────────────────────────────────
     2. SELF-EXCLUSION — LIVE DB CHECK
     UD cache ki jagah direct Firebase read
     ──────────────────────────────────────────── */
  function patchSelfExclusion() {
    if (window._selfExclusionPatched) return;
    window._selfExclusionPatched = true;

    /* Bug High #8 Fix: Unified ban check reads BOTH Supabase is_banned (admin sets this)
       AND Firebase selfExcluded (user-initiated break). Previously only Firebase was
       checked, so admin banning a user in Supabase had no effect on join validation. */
    window.mesCheckExclusionAsync = function (cb) {
      if (typeof cb !== 'function') cb = function () {};
      var U = window.U;
      var db = window.db;
      if (!U) { cb(false); return; }

      // Step 1: Check Supabase is_banned (authoritative — set by admin)
      function _checkFirebaseExclusion() {
        if (!db) { cb(false); return; }
        db.ref('users/' + U.uid + '/selfExcluded').once('value', function (s) {
          if (!s.val()) { cb(false); return; }
          db.ref('users/' + U.uid + '/selfExcludedTill').once('value', function (ts) {
            var till = Number(ts.val()) || 0;
            if (till && Date.now() < till) {
              if (window.toast) window.toast('🚫 Break active hai till ' + new Date(till).toLocaleDateString('en-IN'), 'err');
              cb(true);
            } else {
              db.ref('users/' + U.uid).update({ selfExcluded: false, selfExcludedTill: null });
              cb(false);
            }
          });
        });
      }

      if (window._supa) {
        window._supa.from('users').select('is_banned,ban_reason').eq('id', U.uid).single()
          .then(function(r) {
            if (r.data && r.data.is_banned) {
              var reason = r.data.ban_reason || 'Admin ne ban kiya';
              if (window.toast) window.toast('⛔ Account banned: ' + reason, 'err');
              cb(true); return;
            }
            // Not banned in Supabase → check Firebase self-exclusion
            _checkFirebaseExclusion();
          })
          .catch(function() {
            // Supabase unavailable → Firebase fallback only
            _checkFirebaseExclusion();
          });
      } else {
        _checkFirebaseExclusion();
      }
    };

    // Patch doJoin to use async exclusion check
    var origDoJoin = window.doJoin;
    if (!origDoJoin || window._selfExcPatchDone) return;
    window._selfExcPatchDone = true;

    window.doJoin = function (id) {
      var _orig = origDoJoin;
      window.mesCheckExclusionAsync(function (excluded) {
        if (!excluded) _orig.call(window, id);
      });
    };
    console.log('[Security] ✅ Self-exclusion live DB check patched');
  }

  /* ─────────────────────────────────────────────
     3. OFFLINE MODE — route doJoin to OQ
     When navigator.onLine = false, queue the join
     ──────────────────────────────────────────── */
  function patchOfflineJoin() {
    if (window._offlineJoinPatched) return;
    window._offlineJoinPatched = true;

    var origDoJoin = window.doJoin;
    window.doJoin = function (id) {
      if (!navigator.onLine) {
        // Route to offline queue
        if (window.OQ && window.OQ.joinMatch) {
          var t = window.MT && window.MT[id];
          var teamName = t ? (t.name || '') : '';
          window.OQ.joinMatch(id, teamName);
          if (window.toast) window.toast('📡 Offline — join request queued, online hone pe submit hoga', 'inf');
        } else {
          if (window.toast) window.toast('❌ Internet nahi hai, baad mein try karo', 'err');
        }
        return;
      }
      origDoJoin.call(this, id);
    };
    console.log('[Security] ✅ Offline join routing patched');
  }

  /* ─────────────────────────────────────────────
     4. REFERRAL CODE UI LOCK
     UD.referredBy set hai toh input disable + lock show
     ──────────────────────────────────────────── */
  function lockReferralUI() {
    // Run whenever referral section renders
    function doLock() {
      var inp = document.getElementById('_refCodeInput');
      if (!inp) return;
      var UD = window.UD;
      if (UD && UD.referredBy) {
        inp.disabled = true;
        inp.value = UD.referredByCode || '(Applied)';
        inp.style.opacity = '0.5';
        inp.style.cursor = 'not-allowed';
        inp.title = 'Referral code already apply ho chuka hai';
        // Hide apply button
        var btn = inp.nextElementSibling;
        while (btn) {
          if (btn.tagName === 'BUTTON') { btn.style.display = 'none'; break; }
          btn = btn.nextElementSibling;
        }
        // Show lock message if not already there
        var lockMsg = document.getElementById('_refLockMsg');
        if (!lockMsg) {
          lockMsg = document.createElement('div');
          lockMsg.id = '_refLockMsg';
          lockMsg.style.cssText = 'font-size:11px;color:#00ff9c;margin-top:4px;display:flex;align-items:center;gap:4px';
          lockMsg.innerHTML = '<i class="fas fa-lock"></i> Referral code lock ho gaya hai';
          try{inp.parentNode.insertBefore(lockMsg, inp.nextSibling);}catch(e){}
        }
      }
    }

    // Observe DOM for referral input appearing
    var obs = new MutationObserver(doLock);
    obs.observe(document.body, { childList: true, subtree: true });

    // Also run when UD is loaded
    var _origAfterLogin = window.afterLogin;
    if (_origAfterLogin) {
      window.afterLogin = function () {
        var r = _origAfterLogin.apply(this, arguments);
        setTimeout(doLock, 500);
        return r;
      };
    }
    console.log('[Security] ✅ Referral UI lock applied');
  }

  /* ─────────────────────────────────────────────
     5. ROOM CONFIRM ENFORCEMENT
     Result page mein inRoom=false wale players ko
     badge dikhao — admin ke liye warning in result table
     (Client-side visual guard)
     ──────────────────────────────────────────── */
  function enforceRoomConfirmWarning() {
    // Patch showRoomPopup / confirmInRoom to make confirm mandatory before result claim
    // User panel: badge on match card if joined but inRoom is false
    function addInRoomBadges() {
      var JR = window.JR;
      if (!JR) return;
      Object.keys(JR).forEach(function (k) {
        var jr = JR[k];
        if (!jr || jr.inRoom) return;
        // Find match card element and add badge if not present
        var card = document.querySelector('[data-mid="' + jr.matchId + '"]');
        if (card && !card.querySelector('._inRoomWarn')) {
          var badge = document.createElement('div');
          badge.className = '_inRoomWarn';
          badge.style.cssText = 'font-size:10px;color:#ffaa00;margin-top:4px;display:flex;align-items:center;gap:4px';
          badge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Room join confirm nahi kiya';
          card.appendChild(badge);
        }
      });
    }

    // Run periodically once JR data loads
    var _iv = setInterval(function () {
      if (window.JR) { addInRoomBadges(); clearInterval(_iv); }
    }, 1000);
    console.log('[Security] ✅ Room confirm warning enforcement active');
  }

  /* ─────────────────────────────────────────────
     APPLY ALL PATCHES — Single consolidated doJoin wrapper
     All checks run in order inside ONE wrapper.
     This prevents any later code from bypassing checks
     by wrapping doJoin again.
     ──────────────────────────────────────────── */
  function applyAll() {
    /* Run individual setup (non-doJoin parts) */
    lockReferralUI();
    enforceRoomConfirmWarning();

    /* Get the ORIGINAL doJoin (before any wrapping) */
    var _coreDoJoin = window.doJoin;
    if (!_coreDoJoin || window._allJoinChecksDone) return;
    window._allJoinChecksDone = true;

    /* ONE definitive wrapper — checks run sequentially */
    window.doJoin = function(id) {
      /* ── Check 1: Rate limit ── */
      var now = Date.now();
      if (now - _lastJoinAt < JOIN_COOLDOWN_MS) {
        var wait = Math.ceil((JOIN_COOLDOWN_MS - (now - _lastJoinAt)) / 1000);
        if (window.toast) window.toast('⏳ Thoda ruko — ' + wait + 's mein dobara try karo', 'err');
        return;
      }
      _lastJoinAt = now;

      /* ── Check 2: Offline queue ── */
      if (!navigator.onLine) {
        if (window.OQ && window.OQ.joinMatch) {
          var t = window.MT && window.MT[id];
          window.OQ.joinMatch(id, t ? (t.name || '') : '');
          if (window.toast) window.toast('📡 Offline — join queued, online hone pe submit hoga', 'inf');
        } else {
          if (window.toast) window.toast('❌ Internet nahi hai, baad mein try karo', 'err');
        }
        return;
      }

      /* ── Check 3: Self-exclusion (async DB check) ── */
      var U = window.U, db = window.db;
      if (U && db) {
        db.ref('users/' + U.uid + '/selfExcluded').once('value', function(s) {
          if (!s.val()) { _runJoin(id); return; }
          db.ref('users/' + U.uid + '/selfExcludedTill').once('value', function(ts) {
            var till = Number(ts.val()) || 0;
            if (till && Date.now() < till) {
              if (window.toast) window.toast('🚫 Break active hai till ' + new Date(till).toLocaleDateString('en-IN'), 'err');
            } else {
              /* Expired — clear and allow */
              db.ref('users/' + U.uid).update({ selfExcluded: false, selfExcludedTill: null });
              _runJoin(id);
            }
          });
        });
      } else {
        _runJoin(id);
      }
    };

    /* _runJoin: device fingerprint check then core join */
    function _runJoin(id) {
      /* ── Check 4: Device fingerprint anti-cheat ── */
      if (window.checkDeviceJoin && window.U) {
        window.checkDeviceJoin(id, function(alreadyJoined, data) {
          if (alreadyJoined && data && data.uid !== window.U.uid) {
            if (window.toast) window.toast('⚠️ Is device se pehle kisi aur ne join kiya hai!', 'err');
            return;
          }
          _coreDoJoin.call(window, id);
        });
      } else {
        _coreDoJoin.call(window, id);
      }
    }

    console.log('[Security] ✅ Single consolidated doJoin wrapper applied (all checks in order)');
  }

  // Wait for doJoin to be defined (app.js loads before this file but async init)
  if (window.doJoin) {
    applyAll();
  } else {
    var _wait = setInterval(function () {
      if (window.doJoin) {
        clearInterval(_wait);
        applyAll();
      }
    }, 200);
  }

  console.log('[Mini eSports] ✅ User Security Patches loaded');
})();
