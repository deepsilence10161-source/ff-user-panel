/* ================================================================
   DEVICE CLEANUP GATE — features/device-cleanup.js | MiniESports
   SAFE-CLEANER v5 (2026-10-09, owner-incident ke baad poora redesign)
   ================================================================

   MAKSAD: new APK install/update ke baad app ki PURANI code-files
   (old update-APKs, WebView code cache) saf ho jayein — sirf app bache
   device par. Teen lohe ke niyam:

   R1. FAISLA SIRF SERVER SIDE (Supabase app_settings.key='apk_cleanup'):
       policy ke bina / offline / galat JSON = koi safai nahi (fail-safe).
   R2. OWNER PROTECTION: exemptUids / exemptDeviceFps /
       exemptRegisteredBefore me jo user/device hai — us par EK file bhi
       delete nahi hoti (native ko bhi yehi decision bheja jata hai aur
       native use dobara validate karta hai).
   R3. ZERO PERMISSION PROMPT: user se file-access ki koi maang nahi —
       na picker, na dialog. Cleanup sirf app-private storage chhuta hai.

   FAIL-SAFE MATRIX (har "pata nahi" = skip, kabhi cleanup nahi):
     policy nahi/galat          → skip (retry next launch)
     enabled !== true           → skip (done)
     uid/fp exempt              → skip (done)
     cutoff set + createdAt ?   → skip (retry next launch)
     cutoff set + created<cutoff→ skip (done)
     uid & fp dono unknown      → skip (retry)
     tabhi CLEANUP jab sab PROVEN allowed

   Decision logic PURE functions me hai (window._deviceCleanupIsExempt /
   window._deviceCleanupDecide) — smoke tests inhe seedha test karte hain.
   Native execution: window.Android.runPostUpdateCleanup(...) (SafeCleaner).
   ================================================================ */
(function () {
  'use strict';

  var POLICY_TABLE = 'app_settings';
  var POLICY_KEY = 'apk_cleanup';
  var DONE_FLAG = '_deviceCleanupDoneFor';

  /* ── PURE: final faisla — {action:'skip'|'cleanup', reason, definitive} ──
     definitive=false ka matlab: faisla abhi poora nahi hua (fail-safe
     skip), DONE_FLAG NAHI lagega — agle launch par dobara koshish. */
  function _decide(pol, uid, deviceFp, userCreatedAt) {
    try {
      if (!pol || typeof pol !== 'object') {
        return { action: 'skip', reason: 'no-policy', definitive: false };
      }
      if (pol.enabled !== true) {
        return { action: 'skip', reason: 'disabled', definitive: true };
      }
      if (pol.exemptAll === true) {
        return { action: 'skip', reason: 'exempt-all', definitive: true };
      }

      var uids = pol.exemptUids || [];
      if (uid && uids.indexOf(uid) !== -1) {
        return { action: 'skip', reason: 'exempt-uid', definitive: true };
      }

      var fps = pol.exemptDeviceFps || [];
      if (deviceFp && fps.indexOf(deviceFp) !== -1) {
        return { action: 'skip', reason: 'exempt-device', definitive: true };
      }

      var cut = pol.exemptRegisteredBefore;
      if (cut) {
        if (!userCreatedAt) {
          /* created_at hi nahi mila — prove nahi kar sakte ki user naya hai
             → fail-safe skip, retry agle launch par. */
          return { action: 'skip', reason: 'created-at-unknown', definitive: false };
        }
        var created = String(userCreatedAt).substring(0, 10);
        var cutoff = String(cut).substring(0, 10);
        if (created && cutoff && created < cutoff) {
          return { action: 'skip', reason: 'exempt-legacy-user', definitive: true };
        }
      }

      if (!uid && !deviceFp) {
        return { action: 'skip', reason: 'identity-unknown', definitive: false };
      }

      return { action: 'cleanup', reason: 'server-policy-allowed', definitive: true };
    } catch (e) {
      return { action: 'skip', reason: 'error', definitive: false };
    }
  }

  /* ── PURE: kya yeh user/device exempt hai? (fail-safe = haan) ── */
  function _isExempt(pol, uid, deviceFp, userCreatedAt) {
    return _decide(pol, uid, deviceFp, userCreatedAt).action !== 'cleanup';
  }

  window._deviceCleanupDecide = _decide;
  window._deviceCleanupIsExempt = _isExempt;

  /* ── Native bridge par faisle ko bhejo (native dobara validate karta hai) ── */
  function _applyDecision(pol, uid, deviceFp, userCreatedAt) {
    if (!(window.Android && typeof window.Android.runPostUpdateCleanup === 'function')) {
      return 0; // browser/dev preview — kuch nahi karna
    }
    try {
      var json = JSON.stringify(pol || {});
      return window.Android.runPostUpdateCleanup(json, uid || '', deviceFp || '', userCreatedAt || '') || 0;
    } catch (e) {
      return 0;
    }
  }

  /* ── Users-table se created_at (exemptRegisteredBefore proof ke liye) ── */
  function _fetchCreatedAt(uid) {
    try {
      if (!window._supa || !uid) return Promise.resolve('');
      return Promise.resolve(
        window._supa.from('users').select('created_at').eq('id', uid).maybeSingle()
      ).then(function (r) {
        return (r && r.data && r.data.created_at) ? String(r.data.created_at) : '';
      }).catch(function () { return ''; });
    } catch (e) {
      return Promise.resolve('');
    }
  }

  /* ── MAIN GATE — ek baar per (version + user), tabhi jab faisla definitive ── */
  function _runGate() {
    try {
      if (!(window.Android && window.Android.isAndroidApp && window.Android.isAndroidApp())) return;
      if (!window._supa) return;
      var uid = (window.U && window.U.uid) ? String(window.U.uid) : '';
      if (!uid) return; // login hone do

      var installed = '';
      try { installed = window.Android.getAppVersion() || ''; } catch (e) {}
      var doneKey = installed + ':' + uid;
      try {
        if (localStorage.getItem(DONE_FLAG) === doneKey) return;
      } catch (e) {}

      /* device_fp: wohi fingerprint jo app users table me rakhta hai */
      var deviceFp = '';
      try {
        if (window.UD && window.UD.deviceFp) deviceFp = String(window.UD.deviceFp);
        else if (window._getDeviceFp && typeof window._getDeviceFp === 'function') {
          deviceFp = String(window._getDeviceFp() || '');
        }
      } catch (e) {}

      Promise.all([
        Promise.resolve(window._supa.from('app_settings').select('value').eq('key', POLICY_KEY).maybeSingle())
          .then(function (r) { return (r && r.data && r.data.value) ? r.data.value : null; })
          .catch(function () { return null; }),
        _fetchCreatedAt(uid)
      ]).then(function (res) {
        var pol = res[0];
        var createdAt = res[1] || '';
        if (!pol) return; // fail-safe: policy nahi mila — retry agle launch par

        var verdict = _decide(pol, uid, deviceFp, createdAt);
        if (verdict.definitive) {
          try { localStorage.setItem(DONE_FLAG, doneKey); } catch (e) {}
        }
        /* Native ko hamesha bhejo — native policy ko DOBARA validate karke
           khud faisla leta hai (exempt par wahan bhi 0 deletion). */
        _applyDecision(pol, uid, deviceFp, createdAt);
      }).catch(function () {
        /* Fail-safe: kuch bhi fail = koi cleanup nahi. Retry agle launch par. */
      });
    } catch (e) {
      /* fail-safe: kuch nahi */
    }
  }

  window._runDeviceCleanupGate = _runGate;

  /* ── Auto-start: login + config ready hone par chalao ── */
  var _tries = 0;
  function _poll() {
    _tries++;
    if (window.U && window._supa) { _runGate(); return; }
    if (_tries < 40) setTimeout(_poll, 4000); // max ~2.5 min wait
  }
  if (typeof setTimeout === 'function') setTimeout(_poll, 3000);
})();
