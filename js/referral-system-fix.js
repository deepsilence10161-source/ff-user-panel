/* ================================================================
   MINI eSPORTS — REFERRAL SYSTEM v5.0
   ----------------------------------------------------------------
   RULE: Referral popup SIRF brand-new account pe aata hai.
   "Brand new" = is session mein snap.exists() === FALSE tha,
   yaani Firebase mein user record abhi pehli baar create hua.

   HOW IT WORKS:
   - app.js ka afterLogin() hook karte hain BEFORE it runs
   - Hum khud snap check karte hain: exists=false → naya user
   - Agar exists=true → purana user → popup KABHI nahi
   - Firebase flag 'referralPopupDone' cross-device safety
   - localStorage flag same-device double-show rokne ke liye
   ================================================================ */
(function () {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     SECTION 1: APPLY REFERRAL CODE
     ══════════════════════════════════════════════════════════════ */
  window.applyReferralCode = function (code) {
    var UD = window.UD; var U = window.U; var db = window.db;
    if (!UD || !U) return;

    code = (code || '').trim().toUpperCase();
    if (!code) { if (window.toast) window.toast('Referral code daalo pehle', 'err'); return; }
    if (UD.referredBy) { if (window.toast) window.toast('Aapne already ek code use kar liya hai', 'err'); return; }
    if (code === (UD.referralCode || '').toUpperCase()) {
      if (window.toast) window.toast('Apna khud ka code use nahi kar sakte', 'err'); return;
    }
    /* Bug 9 Fix: Re-read total_matches from Supabase before checking — UD.total_matches
       can be stale within the same session (updated in Firebase but UD not refreshed).
       A user who just played their first match would still see UD.total_matches = 0. */
    function _checkAndApply() {
      var _totalMatches = Number(UD.total_matches || (UD.stats && UD.stats.matches) || 0);
      if (_totalMatches > 0) {
        if (window.toast) window.toast('Referral code sirf pehle match se pehle apply ho sakta hai!', 'err');
        return;
      }
      _doLookupAndApply();
    }

    if (window._supa) {
      window._supa.from('users').select('total_matches').eq('id', U.uid).single()
        .then(function(r) {
          if (r.data && Number(r.data.total_matches) > 0) {
            if (window.toast) window.toast('Referral code sirf pehle match se pehle apply ho sakta hai!', 'err');
            return;
          }
          _checkAndApply();
        })
        .catch(function() { _checkAndApply(); });
    } else {
      _checkAndApply();
    }

    function _doLookupAndApply() {

    /* Bug Critical #2 Fix: Referral code lookup via Supabase (source of truth).
       Firebase RTDB users/ is empty after migration — orderByChild('referralCode')
       always returns nothing, making all referral codes invalid. */
    var _doApply = function(referrerUid) {
      if (!referrerUid || referrerUid === U.uid) {
        if (window.toast) window.toast('Invalid referral code', 'err'); return;
      }
      /* Issue #14 Fix: Check Supabase referrals table for existing referral
         to prevent applying multiple referral codes via race condition or retries */
      function _applyIfNotDuplicate() {
        if (window._supa) {
          window._supa.from('referrals').select('id').eq('referred_id', U.uid).maybeSingle()
            .then(function(r) {
              if (r.data) {
                if (window.toast) window.toast('ℹ️ Aap already ek referral code use kar chuke ho!', 'inf'); return;
              }
              _commitApply(referrerUid);
            })
            .catch(function() { _commitApply(referrerUid); }); // Supabase fail → proceed
        } else { _commitApply(referrerUid); }
      }
      _applyIfNotDuplicate();
    };

    function _commitApply(referrerUid) {
      var _applyData = { referredBy: referrerUid, referredByCode: code, referralAppliedAt: Date.now() };
      // Write to Supabase (primary)
      if (window._supa) {
        window._supa.from('users').update({ referred_by: referrerUid, referral_applied_at: new Date().toISOString() })
          .eq('id', U.uid).catch(function(){});
      }
      // Mirror to Firebase for immediate local UD cache
      if (db) db.ref('users/' + U.uid).update(_applyData);
      UD.referredBy = referrerUid;

      // Reward referrer via Supabase
      var _reward = (window.CFG && window.CFG.referralReward) || 50;
      if (window._supa) {
        window._supa.rpc('increment_balance', { p_uid: referrerUid, p_col: 'coins', p_amount: _reward })
          .catch(function(){});
        // Log referral in Supabase
        /* Bug #56 Fix: Use upsert with onConflict to handle race condition
           between duplicate check and insert (two tabs simultaneously) */
        window._supa.from('referrals').upsert({
          referrer_id: referrerUid, referred_id: U.uid,
          referred_name: UD.ign || UD.displayName || '',
          referrer_ign: '', code: code, reward: _reward
        }, { onConflict: 'referred_id', ignoreDuplicates: true }).catch(function(){});
        // Notify referrer via dual-write
        window._supa.from('notifications').insert({
          user_id: referrerUid, type: 'referral', is_read: false,
          title: '🎁 Referral Reward!',
          body: (UD.ign || 'Someone') + ' ne aapka code use kiya! +' + _reward + ' coins mile!'
        }).catch(function(){});
      }
      // Firebase mirror for referrer coins + notification
      if (db) {
        db.ref('users/' + referrerUid + '/coins').transaction(function(v) { return (v||0) + _reward; });
        db.ref('users/' + referrerUid + '/referralCount').transaction(function(v) { return (v||0) + 1; });
        db.ref('users/' + referrerUid + '/notifications').push({
          title: '🎁 Referral Reward!',
          message: (UD.ign || 'Someone') + ' ne aapka code use kiya! +' + _reward + ' coins!',
          type: 'referral', timestamp: Date.now(), read: false
        });
      }

      /* Permanently mark done */
      if (db) db.ref('users/' + U.uid + '/referralPopupDone').set(true);
      if (window._supa) window._supa.from('users').update({ referral_popup_done: true }).eq('id', U.uid).catch(function(){});
      try { localStorage.setItem('_refDone_' + U.uid, '1'); } catch(e) {}
      if (window.toast) window.toast('🎁 Code apply ho gaya! Account linked!', 'ok');
      var pop = document.getElementById('_refCodePopup');
      if (pop) pop.remove();
    } // end _commitApply

    // Supabase lookup (primary)
    if (window._supa) {
      window._supa.from('users').select('id').eq('referral_code', code).limit(1)
        .then(function(r) {
          if (!r.data || !r.data.length) {
            if (window.toast) window.toast('Invalid referral code', 'err'); return;
          }
          _doApply(r.data[0].id);
        })
        .catch(function() {
          // Supabase failed — Firebase fallback
          if (!db) { if (window.toast) window.toast('Service unavailable', 'err'); return; }
          db.ref('users').orderByChild('referralCode').equalTo(code).once('value', function(s) {
            if (!s.exists()) { if (window.toast) window.toast('Invalid referral code', 'err'); return; }
            var rid = null; s.forEach(function(c) { rid = c.key; });
            _doApply(rid);
          });
        });
    } else if (db) {
      // No Supabase — Firebase fallback
      db.ref('users').orderByChild('referralCode').equalTo(code).once('value', function(s) {
        if (!s.exists()) { if (window.toast) window.toast('Invalid referral code', 'err'); return; }
        var rid = null; s.forEach(function(c) { rid = c.key; });
        _doApply(rid);
      });
    } else {
      if (window.toast) window.toast('Service unavailable — dobara try karo', 'err');
    }
    } // end _doLookupAndApply (Bug 9 Fix)


  /* ══════════════════════════════════════════════════════════════
     SECTION 2: SHOW POPUP (called only for brand-new accounts)
     ══════════════════════════════════════════════════════════════ */
  window.showFirstLoginReferralPopup = function () {
    var UD = window.UD; var U = window.U; var db = window.db;
    if (!UD || !U || !db) return;

    /* Safety guards — should already be clear but double-check */
    if (UD.referredBy) return;
    if (UD.referralPopupDone) return;
    try { if (localStorage.getItem('_refDone_' + U.uid)) return; } catch (e) {}

    /* Mark immediately — no double show */
    db.ref('users/' + U.uid + '/referralPopupDone').set(true);
    try { localStorage.setItem('_refDone_' + U.uid, '1'); } catch (e) {}
    /* ✅ Audit Fix: also persist to Supabase (source of truth for isNewUser
       check above) — without this, skipping the popup only stuck on the
       same device/localStorage; a reinstall or new device would show it again. */
    if (window._supa) window._supa.from('users').update({ referral_popup_done: true }).eq('id', U.uid).catch(function(){});
    UD.referralPopupDone = true;

    setTimeout(function () {
      if (document.getElementById('_refCodePopup')) return;

      var myCode = UD.referralCode || U.uid.substring(0, 8).toUpperCase();
      var overlay = document.createElement('div');
      overlay.id = '_refCodePopup';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:99980;background:rgba(0,0,0,.78);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center';

      overlay.innerHTML = [
        '<div style="background:#111118;border-radius:24px 24px 0 0;padding:28px 20px 44px;width:100%;max-width:480px;animation:refSlideUp .35s cubic-bezier(.16,1,.3,1)">',
          '<div style="width:44px;height:4px;border-radius:2px;background:rgba(255,255,255,.12);margin:0 auto 22px"></div>',
          '<div style="text-align:center;margin-bottom:22px">',
            '<div style="font-size:52px;margin-bottom:10px">🎁</div>',
            '<div style="font-size:20px;font-weight:900;color:#fff;margin-bottom:8px">Kisi ka Referral Code hai?</div>',
            '<div style="font-size:13px;color:#888;line-height:1.6">Dost ka code daalo, bonus coins pao!<br><span style="color:#b964ff;font-weight:700">Sirf pehle login pe</span> — ek baar ka mauka</div>',
          '</div>',
          '<div style="display:flex;gap:10px;margin-bottom:14px">',
            '<input id="_refCodeInput" type="text" placeholder="REFERRAL CODE" autocomplete="off" ',
              'style="flex:1;padding:15px 16px;border-radius:14px;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.12);color:#fff;font-size:16px;font-weight:800;outline:none;text-transform:uppercase;letter-spacing:2px" ',
              'oninput="this.value=this.value.toUpperCase()">',
            '<button onclick="window.applyReferralCode(document.getElementById(\'_refCodeInput\').value)" ',
              'style="padding:15px 18px;border-radius:14px;background:linear-gradient(135deg,#b964ff,#7c3aed);border:none;color:#fff;font-weight:900;font-size:14px;cursor:pointer;white-space:nowrap;box-shadow:0 4px 16px rgba(124,58,237,.4)">Apply</button>',
          '</div>',
          '<div style="background:rgba(0,255,156,.05);border:1px solid rgba(0,255,156,.15);border-radius:14px;padding:13px 16px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between">',
            '<div>',
              '<div style="font-size:10px;color:#888;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">Tumhara Code — Dosto ko share karo!</div>',
              '<div style="font-size:20px;font-weight:900;color:#00ff9c;letter-spacing:3px">' + myCode + '</div>',
            '</div>',
            '<button onclick="window._copyRefCode&&window._copyRefCode()" style="padding:9px 14px;border-radius:10px;background:rgba(0,255,156,.15);border:1px solid rgba(0,255,156,.3);color:#00ff9c;font-weight:800;font-size:13px;cursor:pointer"><i class="fas fa-copy"></i></button>',
          '</div>',
          '<button onclick="document.getElementById(\'_refCodePopup\').remove()" ',
            'style="width:100%;padding:14px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#666;font-weight:700;font-size:14px;cursor:pointer">',
            'Skip — Code nahi hai',
          '</button>',
        '</div>',
        '<style>@keyframes refSlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}</style>'
      ].join('');

      overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
      setTimeout(function () { var inp = document.getElementById('_refCodeInput'); if (inp) inp.focus(); }, 400);
    }, 1800);
  };


  /* ══════════════════════════════════════════════════════════════
     SECTION 3: HOOK afterLogin — THE CORE FIX
     ══════════════════════════════════════════════════════════════ */
  function hookAfterLogin () {
    if (!window.afterLogin || window._refHookDone) return;
    window._refHookDone = true;

    var _origAfterLogin = window.afterLogin;

    window.afterLogin = function (user) {
      var db = window.db;
      var supa = window._supa;

      /* Bug Critical #2 + Medium #11 Fix: New user detection via Supabase.
         Firebase RTDB users/ is empty after migration — db.ref('users/'+uid)
         always returns !snap.exists() = TRUE, so popup showed on EVERY login.
         Now we check Supabase users table (source of truth) for user existence. */
      function _runWithNewUserFlag(isNewUser) {
        _origAfterLogin.call(this, user);
        if (!isNewUser) return;
        var tries = 0;
        var chk = setInterval(function () {
          tries++;
          if (window.UD && window.U) {
            clearInterval(chk);
            if (!window.UD.referredBy && !window.UD.referralPopupDone) {
              window.showFirstLoginReferralPopup();
            }
          }
          if (tries > 30) clearInterval(chk);
        }, 400);
      }

      if (supa) {
        // Supabase check — single row lookup is fast and accurate
        supa.from('users').select('id,referred_by,referral_popup_done')
          .eq('id', user.uid).single()
          .then(function(r) {
            // If Supabase has no row → brand new user
            var isNewUser = !r.data;
            // If row exists but referralPopupDone not set → also show popup
            if (r.data && !r.data.referral_popup_done && !r.data.referred_by) isNewUser = true;
            _runWithNewUserFlag(isNewUser);
          })
          .catch(function() {
            // Supabase unavailable — fall back to Firebase check
            if (!db) { _origAfterLogin.call(this, user); return; }
            db.ref('users/' + user.uid).once('value').then(function(snap) {
              _runWithNewUserFlag(!snap.exists());
            }).catch(function() { _origAfterLogin.call(this, user); });
          });
      } else if (db) {
        db.ref('users/' + user.uid).once('value').then(function (snap) {
          _runWithNewUserFlag(!snap.exists());
        }).catch(function () { _origAfterLogin.call(this, user); });
      } else {
        _origAfterLogin.call(this, user);
      }
    };
  }


  /* ══════════════════════════════════════════════════════════════
     SECTION 4: REFERRAL STATS MODAL
     ══════════════════════════════════════════════════════════════ */
  window.showReferralStats = function () {
    var UD = window.UD; var U = window.U;
    if (!UD || !U) return;
    var myCode = UD.referralCode || U.uid.substring(0, 8).toUpperCase();
    var count  = Number(UD.referralCount) || 0;
    var earned = Number(UD.referralCoinsEarned) || (count * 50);

    var h = '';
    h += '<div style="text-align:center;padding:8px 0 16px"><div style="font-size:48px;margin-bottom:10px">🎁</div>';
    h += '<div style="font-size:16px;font-weight:800;color:#fff;margin-bottom:4px">Refer & Earn</div>';
    h += '<div style="font-size:12px;color:#888;margin-bottom:16px">Dosto ko invite karo, coins kamao!</div></div>';
    h += '<div style="background:rgba(0,255,156,.06);border:1px solid rgba(0,255,156,.2);border-radius:14px;padding:16px;text-align:center;margin-bottom:14px">';
    h += '<div style="font-size:11px;color:#888;margin-bottom:6px">Your Referral Code</div>';
    h += '<div style="font-size:28px;font-weight:900;color:#00ff9c;letter-spacing:4px">' + myCode + '</div>';
    h += '<button onclick="window._copyRefCode&&window._copyRefCode()" style="margin-top:10px;padding:7px 18px;border-radius:8px;background:rgba(0,255,156,.15);border:1px solid rgba(0,255,156,.3);color:#00ff9c;font-weight:700;font-size:12px;cursor:pointer"><i class="fas fa-copy"></i> Copy Code</button></div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">';
    h += '<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:14px;text-align:center"><div style="font-size:26px;font-weight:900;color:#ffd700">' + count + '</div><div style="font-size:11px;color:#888">Friends Referred</div></div>';
    h += '<div style="background:rgba(255,255,255,.04);border-radius:12px;padding:14px;text-align:center"><div style="font-size:26px;font-weight:900;color:#ffd700">' + earned + '</div><div style="font-size:11px;color:#888">Coins Earned</div></div></div>';
    h += '<button onclick="window._pvShare&&window._pvShare()" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00d4ff);border:none;color:#000;font-weight:900;font-size:14px;cursor:pointer"><i class="fas fa-share-alt" style="margin-right:8px"></i>Share & Invite</button>';

    if (window.openModal) window.openModal('🎁 Refer & Earn', h);
  };

  window._copyRefCode = function () {
    var UD = window.UD; var U = window.U;
    if (!UD || !U) return;
    var code = UD.referralCode || U.uid.substring(0, 8).toUpperCase();
    if (window.copyTxt) {
      window.copyTxt(code);
    } else {
      try { navigator.clipboard.writeText(code); } catch (e) {
        var ta = document.createElement('textarea');
        ta.value = code; document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); document.body.removeChild(ta);
      }
    }
    if (window.toast) window.toast('✅ Code copied: ' + code, 'ok');
  };


  /* ══════════════════════════════════════════════════════════════
     SECTION 5: INIT — wait for afterLogin to exist, then hook
     ══════════════════════════════════════════════════════════════ */
  var _tries = 0;
  var _iv = setInterval(function () {
    _tries++;
    if (window.afterLogin) { clearInterval(_iv); hookAfterLogin(); }
    if (_tries > 60) clearInterval(_iv);
  }, 300);

  console.log('[Mini eSports] Referral System v5.0 — airtight new-user-only popup');
} // close unclosed block

})(); // end IIFE
