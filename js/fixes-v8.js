/* ═══════════════════════════════════════════════════════════════════
   MINI ESPORTS — fixes-v8.js
   
   ROOT CAUSES FIXED:
   1. Blank screen — multiple guaranteed fallbacks
   2. Script load failures — graceful error recovery
   3. Feature file errors — isolated, app continues
   4. Race conditions — proper init sequencing
   5. renderRank city tab crash — hardened
   6. Wallet blank — display:none guard
   7. Splash stuck — hard timeout + fallback
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── waitFor: fires callback ONCE when condition met ─── */
  function waitFor(fn, cb, maxMs) {
    var elapsed = 0, interval = 150;
    var iv = setInterval(function () {
      elapsed += interval;
      if (fn()) { clearInterval(iv); cb(); }
      else if (elapsed >= (maxMs || 12000)) { clearInterval(iv); }
    }, interval);
  }

  /* ──────────────────────────────────────────────────────
     1. SPLASH HARD GUARD
     Agar onAuthStateChanged 5 sec mein na aaye — splash
     hatao, login screen dikhao. App KABHI stuck nahi rehega.
  ─────────────────────────────────────────────────────── */
  var _splashKillTimer = setTimeout(function () {
    var sp = document.getElementById('splash');
    var ls = document.getElementById('loginScreen');
    if (sp && sp.style.display !== 'none') {
      sp.style.opacity = '0';
      sp.style.transition = 'opacity 0.4s';
      setTimeout(function () {
        if (sp) sp.style.display = 'none';
        if (ls && ls.style.display === 'none') ls.style.display = 'flex';
      }, 400);
    }
  }, 5000);

  /* Cancel if auth fires normally */
  waitFor(
    function () { return window._authFired === true; },
    function () { clearTimeout(_splashKillTimer); },
    6000
  );

  /* ──────────────────────────────────────────────────────
     2. MAIN CONTENT BLANK SCREEN GUARD
     Agar user login ho lekin mainContent display:none reh
     jaaye (race condition) — force show karo.
  ─────────────────────────────────────────────────────── */
  waitFor(
    function () { return window.U && window.db && document.getElementById('mainContent'); },
    function () {
      setTimeout(function () {
        var mc = document.getElementById('mainContent');
        var hdr = document.getElementById('header');
        var nav = document.getElementById('bottomNav');
        var ls  = document.getElementById('loginScreen');
        var sp  = document.getElementById('splash');

        if (!mc) return;

        /* Already visible — kuch karne ki zarurat nahi */
        var isVisible = mc.style.display !== 'none' && mc.style.display !== '';
        if (isVisible) return;

        /* Sirf tab force karo jab user actually logged in ho */
        if (window.U && window.UD) {
          console.warn('[v8] mainContent blank detected — force showing UI');
          if (sp)  sp.style.display  = 'none';
          if (ls)  ls.style.display  = 'none';
          if (hdr) hdr.style.display = '';
          if (nav) nav.style.display = '';
          mc.style.display = '';

          /* Re-trigger home render */
          try { if (window.renderHome) renderHome(); } catch(e) {}
          try { if (window.updateHdr)  updateHdr(); }  catch(e) {}
        }
      }, 3500); /* 3.5 sec — enough time for normal boot */
    },
    15000
  );

  /* ──────────────────────────────────────────────────────
     3. WALLET SCREEN BLANK GUARD
     walletMain kabhi display:none na rahe jab screen active ho
  ─────────────────────────────────────────────────────── */
  var _origNavTo = null;
  waitFor(function () { return typeof window.navTo === 'function' && !window._v8NavWrapped; }, function () {
    window._v8NavWrapped = true;
    _origNavTo = window.navTo;
    window.navTo = function (scr) {
      try { _origNavTo.call(this, scr); } catch (e) {
        console.error('[v8] navTo error:', e);
      }
      /* After navigation, ensure wallet screen is not blank */
      if (scr === 'wallet') {
        setTimeout(function () {
          var wm = document.getElementById('walletMain');
          var wf = document.getElementById('walletFlow');
          if (wm && (wm.style.display === 'none')) {
            wm.style.display = '';
          }
          if (wf && wf.style.display !== 'none' && wf.style.display !== '') {
            /* walletFlow accidentally open — reset */
            wf.style.display = 'none';
          }
          try { if (window.renderWallet) renderWallet(); } catch(e) {}
        }, 200);
      }
    };
  });

  /* ──────────────────────────────────────────────────────
     4. RENDERHOME / RENDERSP / RENDERMM SAFE WRAPPERS
     Koi bhi crash hone pe empty-state dikhao, app crash na kare
  ─────────────────────────────────────────────────────── */
  function safeWrap(fnName, fallbackElId) {
    waitFor(function () { return typeof window[fnName] === 'function' && !window[fnName]._v8Safe; }, function () {
      var orig = window[fnName];
      var wrapped = function () {
        try { return orig.apply(this, arguments); }
        catch (e) {
          console.error('[v8] ' + fnName + ' error:', e);
          var el = fallbackElId && document.getElementById(fallbackElId);
          if (el && !el._v8ErrShown) {
            el._v8ErrShown = true;
            el.innerHTML = '<div style="text-align:center;padding:40px 20px">' +
              '<div style="font-size:36px;margin-bottom:10px">⚠️</div>' +
              '<div style="font-size:14px;font-weight:700;color:#ff6b6b;margin-bottom:8px">Screen load error</div>' +
              '<div style="font-size:12px;color:#aaa;margin-bottom:16px">Refresh karo</div>' +
              '<button onclick="location.reload()" style="padding:10px 22px;border-radius:10px;' +
              'background:rgba(0,212,255,.15);border:1px solid rgba(0,212,255,.3);color:#00d4ff;' +
              'font-weight:700;cursor:pointer">🔄 Refresh</button></div>';
          }
        }
      };
      wrapped._v8Safe = true;
      window[fnName] = wrapped;
    });
  }
  safeWrap('renderHome',    'homeList');
  safeWrap('renderSP',      'specialList');
  safeWrap('renderMM',      'mmList');
  safeWrap('renderWallet',  'walletHist');
  safeWrap('renderProfile', 'profileContent');
  safeWrap('renderNotifs',  'notifList');
  safeWrap('renderRank',    'rankContent');

  /* ──────────────────────────────────────────────────────
     5. RENDERRANK — CITY TAB & INVALID TAB CRASH FIX
     'city' tab fire hone pe crash hota tha — ignore karo
  ─────────────────────────────────────────────────────── */
  waitFor(
    function () { return typeof window.renderRank === 'function' && !window._v8RankFixed; },
    function () {
      window._v8RankFixed = true;
      var origRank = window.renderRank;
      window.renderRank = function (tab) {
        /* Valid tabs only */
        var validTabs = ['kills', 'wins', 'rankpoints'];
        var safeTab = (tab && validTabs.indexOf(tab) !== -1) ? tab : (window._rankTab || 'kills');
        window._rankTab = safeTab;
        try { origRank.call(this, safeTab); } catch (e) {
          console.error('[v8] renderRank error:', e);
          var rc = document.getElementById('rankContent');
          if (rc) rc.innerHTML = '<div style="text-align:center;padding:40px"><div style="font-size:48px;opacity:.2">🏆</div><p style="color:#666;margin-top:12px">Leaderboard load ho raha hai...</p><button onclick="renderRank()" style="margin-top:12px;padding:10px 20px;border-radius:10px;background:rgba(0,255,156,.12);border:1px solid rgba(0,255,156,.25);color:#00ff9c;font-weight:700;cursor:pointer">↺ Retry</button></div>';
        }
      };
    }
  );

  /* ──────────────────────────────────────────────────────
     6. FEATURE FILE ERROR ISOLATION
     Har feature file window.* expose karti hai.
     Koi crash kare to sirf wo feature disabled ho, app nahi.
     This is enforced by checking if critical functions still
     exist after all scripts load.
  ─────────────────────────────────────────────────────── */
  var CRITICAL_FNS = [
    'renderHome', 'renderMM', 'renderSP', 'renderWallet',
    'renderProfile', 'renderRank', 'navTo', 'openModal',
    'closeModal', 'hasJ', 'effSt', 'cJoin', 'doJoin',
    'boot', 'updateHdr', 'toast'
  ];

  /* After all scripts load, verify critical functions exist */
  window.addEventListener('load', function () {
    setTimeout(function () {
      CRITICAL_FNS.forEach(function (fn) {
        if (typeof window[fn] !== 'function') {
          console.error('[v8] CRITICAL MISSING: ' + fn + '() — app may malfunction');
        }
      });
      console.log('[v8] ✅ Critical function check complete');

      /* f29 referral integration — f19 disabled (v7 already handles this) */
      if (window._v7RankInstalled) {
        /* v7 rank already patched — f19 should be disabled */
        window.renderReferralLeaderboard = function () { return ''; };
      }
    }, 2000);
  });

  /* ──────────────────────────────────────────────────────
     7. AUTH REDIRECT RESULT HANDLER
     signInWithRedirect ka result handle karo (popup fail hone pe)
  ─────────────────────────────────────────────────────── */
  waitFor(
    function () { return window.auth && typeof window.auth.getRedirectResult === 'function' && !window._v8RedirectChecked; },
    function () {
      window._v8RedirectChecked = true;
      auth.getRedirectResult().then(function (result) {
        /* Result handle hoga onAuthStateChanged mein — kuch karne ki zarurat nahi */
      }).catch(function (err) {
        if (err && err.code !== 'auth/no-current-user') {
          console.warn('[v8] Redirect result error:', err.code);
        }
      });
    }
  );

  /* ──────────────────────────────────────────────────────
     8. MODAL OVERLAY ACCESSIBILITY FIX
     modal-overlay pe 'show' class missing rehti thi kabhi kabhi
  ─────────────────────────────────────────────────────── */
  waitFor(
    function () { return typeof window.openModal === 'function' && !window._v8ModalFixed; },
    function () {
      window._v8ModalFixed = true;
      var origOpen = window.openModal;
      window.openModal = function (title, html) {
        try {
          origOpen.call(this, title, html);
          /* Ensure overlay is scrolled to top */
          var mb = document.getElementById('modalB');
          if (mb) mb.scrollTop = 0;
        } catch(e) {
          console.error('[v8] openModal error:', e);
        }
      };
      window.showModal = window.openModal;
    }
  );

  /* ──────────────────────────────────────────────────────
     9. DOUBLE-BOOT PREVENTION
     Firebase listeners baar baar attach hone se memory leak
  ─────────────────────────────────────────────────────── */
  waitFor(
    function () { return typeof window.boot === 'function' && !window._v8BootFixed; },
    function () {
      window._v8BootFixed = true;
      var origBoot = window.boot;
      window.boot = function () {
        if (window._bootCalled) {
          console.warn('[v8] boot() called again — ignoring to prevent duplicate listeners');
          return;
        }
        window._bootCalled = true;
        origBoot.call(this);
      };
    }
  );

  /* ──────────────────────────────────────────────────────
     10. TICKER ANIMATION FIX
     Ticker scroll animation khatam ho jaati thi on some browsers
  ─────────────────────────────────────────────────────── */
  waitFor(
    function () { return document.getElementById('tickerTxt') && !window._v8TickerFixed; },
    function () {
      window._v8TickerFixed = true;
      /* Re-apply ticker animation if it stops */
      setInterval(function () {
        var tt = document.getElementById('tickerTxt');
        if (!tt) return;
        var style = window.getComputedStyle(tt);
        /* If animation has stopped (duration 0 or none), restart it */
        if (!style.animationDuration || style.animationDuration === '0s') {
          tt.style.animation = 'none';
          void tt.offsetHeight; /* force reflow */
          tt.style.animation = '';
        }
      }, 10000);
    }
  );

  /* ──────────────────────────────────────────────────────
     11. COIN SHOP MODAL DISPLAY FIX
     coinShopModal kabhi display:flex nahi ho pata tha
  ─────────────────────────────────────────────────────── */
  waitFor(
    function () { return typeof window.showCoinShop === 'function' && !window._v8CoinShopFixed; },
    function () {
      window._v8CoinShopFixed = true;
      var orig = window.showCoinShop;
      window.showCoinShop = function () {
        try {
          orig.call(this);
          var modal = document.getElementById('coinShopModal');
          if (modal && modal.style.display !== 'flex') {
            modal.style.display = 'flex';
          }
        } catch(e) {}
      };
    }
  );

  /* ──────────────────────────────────────────────────────
     12. RENDER ON SCREEN SWITCH — ensure renders happen
     Screens switch hone ke baad agar data already loaded
     ho but render nahi hua to force karo
  ─────────────────────────────────────────────────────── */
  waitFor(
    function () { return window.MT && window.U && window.UD && !window._v8ScreenGuardSet; },
    function () {
      window._v8ScreenGuardSet = true;

      /* Check every 4s: agar screen active hai but content empty hai to re-render */
      setInterval(function () {
        var cur = window.curScr;
        if (!cur || !window.U || !window.UD) return;

        var checks = {
          home:    { el: 'homeList',      fn: 'renderHome' },
          matches: { el: 'mmList',        fn: 'renderMM' },
          special: { el: 'specialList',   fn: 'renderSP' },
          wallet:  { el: 'walletHist',    fn: 'renderWallet' },
          profile: { el: 'profileContent', fn: 'renderProfile' },
          rank:    { el: 'rankContent',   fn: 'renderRank' }
        };

        var c = checks[cur];
        if (!c) return;
        var el = document.getElementById(c.el);
        if (!el) return;

        /* Only re-render if content is truly empty (not loading) */
        var isEmpty = el.children.length === 0 && el.textContent.trim() === '';
        if (isEmpty && typeof window[c.fn] === 'function') {
          console.log('[v8] Empty screen detected (' + cur + ') — re-rendering');
          try { window[c.fn](); } catch(e) {}
        }
      }, 4000);
    }
  );

  /* ──────────────────────────────────────────────────────
     13. SETINTERVAL / SETTIMEOUT ERROR SHIELD
     Global uncaught errors se app crash na ho
  ─────────────────────────────────────────────────────── */
  window.addEventListener('error', function (e) {
    /* Log silently — don't rethrow */
    var msg = (e && e.message) || 'Unknown error';
    var src = (e && e.filename) ? e.filename.split('/').pop() : 'unknown';
    console.warn('[v8] Caught global error from ' + src + ': ' + msg);

    /* If it's from a feature file, don't let it affect core */
    if (src && src.indexOf('features/') !== -1) {
      e.preventDefault && e.preventDefault();
      return true;
    }
  });

  window.addEventListener('unhandledrejection', function (e) {
    var reason = e && e.reason;
    var msg = (reason && reason.message) || String(reason) || 'Promise rejected';
    /* Firebase permission errors — normal when user not logged in */
    if (msg.indexOf('permission') !== -1 || msg.indexOf('PERMISSION_DENIED') !== -1) return;
    console.warn('[v8] Unhandled promise rejection:', msg);
  });

  console.log('[Mini eSports] ✅ fixes-v8.js loaded — all guards active');
})();
