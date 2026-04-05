/* ============================================================
   FIX 5: LISTENER MANAGER
   - Page change pe listeners destroy karo
   - .once() prefer karo jahan real-time zaroorat nahi
   - Boot ke saath integrate hota hai
   ============================================================ */

(function() {
  'use strict';

  /* ─── Listener Registry ─── */
  var _listeners = [];   // { ref, event, fn, key }
  var _destroyed  = false;

  /**
   * Register a real-time listener (replaces bare .on())
   * Returns the listener ref so .off() can be called later
   */
  window.LM = {

    /* Real-time (persistent) listener — tracked for cleanup */
    on: function(refPath, event, fn, key) {
      var r = db.ref(refPath);
      r.on(event, fn);
      _listeners.push({ ref: r, event: event, fn: fn, key: key || refPath });
      return r;
    },

    /* One-time fetch — NOT tracked (cleans itself) */
    once: function(refPath, event, fn) {
      return db.ref(refPath).once(event || 'value', fn);
    },

    /* Remove ONE listener by key */
    off: function(key) {
      _listeners = _listeners.filter(function(l) {
        if (l.key === key) { l.ref.off(l.event, l.fn); return false; }
        return true;
      });
    },

    /* Remove ALL listeners (call on logout or session end) */
    destroyAll: function() {
      _listeners.forEach(function(l) { l.ref.off(l.event, l.fn); });
      _listeners = [];
      _destroyed = true;
      console.log('[LM] All Firebase listeners destroyed.');
    },

    /* Remove listeners whose key matches prefix (page-scoped cleanup) */
    destroyPrefix: function(prefix) {
      _listeners = _listeners.filter(function(l) {
        if (l.key && l.key.indexOf(prefix) === 0) {
          l.ref.off(l.event, l.fn);
          return false;
        }
        return true;
      });
    },

    count: function() { return _listeners.length; }
  };

  /* ─── Patch boot() to use LM ─── */
  /* We override the window.boot definition AFTER it's declared.
     Call patchBoot() right after boot() is defined in app.js,
     OR just call patchBoot() at DOMContentLoaded. */

  function patchBoot() {
    var _origBoot = window.boot;
    if (!_origBoot || window._bootPatched) return;
    window._bootPatched = true;

    window.boot = function() {
      if (!window.U) return;

      /* Destroy any previous listeners before re-booting */
      window.LM.destroyAll();
      _destroyed = false;

      /* ── L1: User Data — REAL-TIME needed (profile/coins change) ── */
      LM.on('users/' + U.uid, 'value', function(s) {
        if (!s.exists()) return;
        UD = s.val();
        var _rdFirebase = (UD.readNotifications) || {};
        Object.keys(_rdFirebase).forEach(function(k) { _READ_KEYS[k] = true; });
        updateHdr(); applyState(); renderHome(); renderProfile(); renderWallet();
        if (window.checkStreakBonus) checkStreakBonus();
        updateBell();
        if (window.mesInit) window.mesInit();
        if (window._markDataFresh) _markDataFresh();
      }, 'l1-user');

      /* ── L2: matches/ — REAL-TIME (match status changes frequently) ── */
      LM.on('matches', 'value', function(s) {
        for (var k in MT) { if (MT[k]._src === 'matches') delete MT[k]; }
        if (s.exists()) {
          s.forEach(function(c) {
            var v = c.val(); if (!v) return;
            var st = (v.status || '').toLowerCase();
            if (['cancelled','canceled','deleted','removed','hidden','disabled','closed'].indexOf(st) !== -1) return;
            v.id = c.key; v._src = 'matches'; MT[c.key] = v;
          });
        }
        detectChanges(); renderHome(); renderSP(); renderMM();
        if (window._markDataFresh) _markDataFresh();
      }, 'l2-matches');

      /* ── L3: tournaments/ — REAL-TIME ── */
      LM.on('tournaments', 'value', function(s) {
        for (var k in MT) { if (MT[k]._src === 'tournaments') delete MT[k]; }
        if (s.exists()) {
          s.forEach(function(c) {
            if (MT[c.key]) return;
            var v = c.val(); if (!v) return;
            var st = (v.status || '').toLowerCase();
            if (['cancelled','canceled','deleted','removed','hidden','disabled','closed'].indexOf(st) !== -1) return;
            v.id = c.key; v._src = 'tournaments'; MT[c.key] = v;
          });
        }
        renderHome(); renderSP(); renderMM();
      }, 'l3-tournaments');

      /* ── L4: joinRequests — REAL-TIME (user needs instant join confirmation) ── */
      LM.on(
        db.ref('joinRequests').orderByChild('userId').equalTo(U.uid).toString().replace(db.ref().toString(), ''),
        'value',
        function(s) {
          JR = {};
          if (s.exists()) s.forEach(function(c) { var v = c.val(); v._key = c.key; JR[c.key] = v; });
          renderHome(); renderMM(); checkRefunds();
        },
        'l4-joinRequests'
      );
      /* Direct ref approach (more reliable): */
      (function() {
        var r = db.ref('joinRequests').orderByChild('userId').equalTo(U.uid);
        r.on('value', function(s) {
          JR = {};
          if (s.exists()) s.forEach(function(c) { var v = c.val(); v._key = c.key; JR[c.key] = v; });
          renderHome(); renderMM(); if (window.checkRefunds) checkRefunds();
        });
        _listeners.push({ ref: r, event: 'value', fn: arguments.callee, key: 'l4-jr' });
      })();

      /* ── L4b: Transactions — .once() is enough; re-fetch on wallet open ── */
      window._reloadTxns = function() {
        db.ref('users/' + U.uid + '/transactions')
          .orderByChild('timestamp').limitToLast(50)
          .once('value', function(s) {
            TXNS = [];
            if (s.exists()) s.forEach(function(c) { var v = c.val(); v._key = c.key; if (!v.timestamp) v.timestamp = Date.now(); TXNS.push(v); });
            TXNS.sort(function(a,b) { return b.timestamp - a.timestamp; });
            if (curScr === 'wallet') renderWallet();
          });
      };
      window._reloadTxns(); // Initial load
      /* REAL-TIME listener for new transactions (so wallet badge updates) */
      LM.on('users/' + U.uid + '/transactions', 'child_added', function() {
        window._reloadTxns();
      }, 'l4b-txns');

      /* ── L5: Notifications (global) — REAL-TIME ── */
      LM.on(
        'notifications',
        'value',
        function(s) {
          var oldKeys = {};
          NOTIFS.forEach(function(n) { if (n._key) oldKeys[n._key] = true; });
          NOTIFS = [];
          if (s.exists()) {
            s.forEach(function(c) {
              var v = c.val();
              if (!v) return;
              v._key = c.key;
              // target check
              if (v.targetUid && v.targetUid !== U.uid) return;
              NOTIFS.push(v);
            });
          }
          NOTIFS.sort(function(a,b) { return (b.timestamp||0)-(a.timestamp||0); });
          updateBell();
        },
        'l5-notifs'
      );

      /* ── L6–L8: App settings — .once() sufficient; changes are rare ── */
      LM.once('appSettings/payment', 'value', function(s) { if (s.exists()) PAY = s.val(); });
      LM.once('appSettings/ticker',  'value', function(s) {
        if (s.exists()) { var tt = $('tickerTxt'); if (tt) tt.textContent = s.val(); }
      });
      LM.once('appSettings/banner',  'value', function(s) {
        var el = $('dynamicBanner'); if (!el) return;
        if (s.exists() && s.val()) {
          var val = s.val(); el.style.display = 'block';
          el.textContent = typeof val === 'string' ? val : (val.text || '');
          el.style.background = (typeof val === 'object' && val.color) ? val.color : 'rgba(0,255,156,.1)';
          el.style.color = (typeof val === 'object' && val.textColor) ? val.textColor : 'var(--green)';
        } else { el.style.display = 'none'; }
      });

      /* ── L9: Wallet requests — REAL-TIME (status changes) ── */
      var prevWHStatus = {};
      (function() {
        var r = db.ref('walletRequests').orderByChild('uid').equalTo(U.uid);
        var fn = function(s) {
          WH = [];
          if (s.exists()) {
            s.forEach(function(c) {
              var v = c.val(); v._key = c.key; WH.push(v);
              var st = (v.status||'').toLowerCase(), prevSt = prevWHStatus[c.key];
              if (prevSt && prevSt !== st) {
                if ((v.type === 'deposit'||v.type === 'add') && (st==='approved'||st==='done'))
                  toast('✅ Deposit 💎'+(v.amount||0)+' added!','ok');
                else if ((v.type === 'deposit'||v.type === 'add') && (st==='rejected'||st==='failed'))
                  toast('❌ Deposit rejected','err');
                else if (v.type==='withdraw' && (st==='approved'||st==='done'))
                  toast('✅ Withdrawal ₹'+(v.amount||0)+' processed!','ok');
                else if (v.type==='withdraw' && (st==='rejected'||st==='failed')) {
                  toast('❌ Withdrawal rejected. Amount refunded.','err');
                  db.ref('users/'+U.uid+'/realMoney/winnings').transaction(function(w){return(w||0)+(Number(v.amount)||0);});
                }
              }
              prevWHStatus[c.key] = st;
            });
          }
          WH.sort(function(a,b){return(b.createdAt||0)-(a.createdAt||0);});
          renderWallet();
        };
        r.on('value', fn);
        _listeners.push({ ref: r, event: 'value', fn: fn, key: 'l9-wallet' });
      })();

      /* ── L10: Referrals — .once() sufficient ── */
      LM.once('referrals', 'value', function() {
        /* placeholder — actual referrals query with orderBy needs separate handling */
      });
      (function() {
        var r = db.ref('referrals').orderByChild('referrerId').equalTo(U.uid);
        r.once('value', function(s) {
          REFS = [];
          if (s.exists()) s.forEach(function(c) { REFS.push(c.val()); });
          if (curScr === 'profile') renderProfile();
        });
      })();

      /* ── L11: Profile request — .once() sufficient; changes are infrequent ── */
      LM.once('profileRequests/' + U.uid, 'value', function(s) {
        if (!s.exists()) return;
        var r = s.val();
        if (r.status === 'approved') {
          var ign = r.requestedIgn||r.ign||'', ffUid = r.requestedUid||r.ffUid||'';
          db.ref('users/'+U.uid).update({ ign:ign, ffUid:ffUid, profileStatus:'approved', profileRequired:null, pendingIgn:null, pendingUid:null });
          var _k = '_mes_approved_'+U.uid;
          if (!localStorage.getItem(_k)) { localStorage.setItem(_k,'1'); toast('🎉 Profile approved! Full access unlocked!','ok'); }
        }
      });

      /* ── User notifications (personal) — REAL-TIME ── */
      LM.on('users/'+U.uid+'/notifications', 'value', function(s) {
        // handled inside existing renderBell logic
        updateBell();
      }, 'l12-user-notifs');

      /* Notify on new personal notification */
      LM.on('users/'+U.uid+'/notifications', 'child_added', function(s) {
        var v = s.val();
        if (v && v.timestamp && Date.now() - v.timestamp < 30000) {
          if (window.toast) toast('🔔 ' + (v.text||v.title||'New notification'), 'inf');
        }
        updateBell();
      }, 'l13-user-notif-new');

      /* Read receipts */
      LM.on('users/'+U.uid+'/readNotifications', 'value', function(s) {
        if (s.exists()) Object.assign(_READ_KEYS, s.val());
        updateBell();
      }, 'l14-read-receipts');

      console.log('[LM] Boot complete — ' + LM.count() + ' active listeners.');
    };
  }

  /* ─── Logout cleanup ─── */
  if (window.auth) {
    auth.onAuthStateChanged(function(user) {
      if (!user) {
        window.LM.destroyAll();
        console.log('[LM] Logged out — all listeners destroyed.');
      }
    });
  }

  /* ─── Page visibility: pause-on-hide, resume-on-show ─── */
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
      /* Re-fetch stale data when tab becomes active again */
      if (window.renderHome) renderHome();
      if (window._markDataFresh) _markDataFresh();
    }
  });

  /* ─── Apply patch after DOM ready ─── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(patchBoot, 100); });
  } else {
    setTimeout(patchBoot, 100);
  }

  console.log('[Mini eSports] ✅ Fix 5: Listener Manager loaded.');
})();
