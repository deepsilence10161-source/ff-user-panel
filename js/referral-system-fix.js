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
    if (!UD || !U || !db) return;

    code = (code || '').trim().toUpperCase();
    if (!code) { if (window.toast) window.toast('Referral code daalo pehle', 'err'); return; }
    if (UD.referredBy) { if (window.toast) window.toast('Aapne already ek code use kar liya hai', 'err'); return; }
    if (code === (UD.referralCode || '').toUpperCase()) {
      if (window.toast) window.toast('Apna khud ka code use nahi kar sakte', 'err'); return;
    }

    db.ref('users').orderByChild('referralCode').equalTo(code).once('value', function (s) {
      if (!s.exists()) { if (window.toast) window.toast('Invalid referral code', 'err'); return; }
      var referrerUid = null;
      s.forEach(function (c) { referrerUid = c.key; });
      if (!referrerUid || referrerUid === U.uid) {
        if (window.toast) window.toast('Invalid referral code', 'err'); return;
      }

      db.ref('users/' + U.uid).update({
        referredBy: referrerUid,
        referredByCode: code,
        referralAppliedAt: Date.now()
      });
      UD.referredBy = referrerUid;

      db.ref('appSettings/referralReward').once('value', function (rs) {
        var reward = Number(rs.val()) || 50;
        db.ref('users/' + referrerUid + '/coins').transaction(function (v) { return (v || 0) + reward; });
        db.ref('users/' + referrerUid + '/referralCount').transaction(function (v) { return (v || 0) + 1; });
        db.ref('users/' + referrerUid + '/referralCoinsEarned').transaction(function (v) { return (v || 0) + reward; });
        db.ref('users/' + referrerUid + '/notifications').push({
          title: '🎁 Referral Reward!',
          message: (UD.ign || UD.displayName || 'Someone') + ' ne aapka code use kiya! +' + reward + ' coins mile!',
          type: 'referral', timestamp: Date.now(), read: false
        });
        db.ref('referrals').push({
          referrerId: referrerUid, referredId: U.uid,
          referredName: UD.ign || UD.displayName || '',
          code: code, reward: reward, timestamp: Date.now()
        });
      });

      /* Permanently mark done */
      db.ref('users/' + U.uid + '/referralPopupDone').set(true);
      try { localStorage.setItem('_refDone_' + U.uid, '1'); } catch (e) {}

      if (window.toast) window.toast('🎁 Code apply ho gaya! Account linked!', 'ok');
      var pop = document.getElementById('_refCodePopup');
      if (pop) pop.remove();
    });
  };


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
      if (!db) { _origAfterLogin.call(this, user); return; }

      /*
       * READ snap BEFORE calling original.
       * exists() = false  →  brand new account  →  show popup
       * exists() = true   →  existing user       →  never show popup
       *
       * Original afterLogin also reads this same ref — Firebase
       * deduplicates the request so no extra cost.
       */
      db.ref('users/' + user.uid).once('value').then(function (snap) {
        var isNewUser = !snap.exists();

        /* Always call original — it creates the user record & boots app */
        _origAfterLogin.call(this, user);

        if (!isNewUser) return; /* Existing user — popup NEVER shown */

        /* New user — wait for UD to be populated after boot() */
        var tries = 0;
        var chk = setInterval(function () {
          tries++;
          if (window.UD && window.U) {
            clearInterval(chk);
            /* Re-check in case another device already applied code */
            if (!window.UD.referredBy && !window.UD.referralPopupDone) {
              window.showFirstLoginReferralPopup();
            }
          }
          if (tries > 30) clearInterval(chk);
        }, 400);

      }).catch(function () {
        /* DB error fallback — just run original */
        _origAfterLogin.call(this, user);
      });
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
})();
