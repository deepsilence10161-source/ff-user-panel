/* ═══════════════════════════════════════════════════════════════════
   MINI ESPORTS — safe-loader.js
   
   Saari feature files ko safely load karta hai.
   Koi bhi file fail ho to sirf wo feature disabled hoti hai,
   baaki app continue karti hai.
   
   HOW TO ADD NEW FEATURES:
   FEATURE_SCRIPTS array mein apni file add karo.
   Optional: { src: 'path', required: false, after: 'functionName' }
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── All feature scripts in load order ── */
  var FEATURE_SCRIPTS = [
    /* Core JS files — pehle load honge */
    { src: 'js/match-timer.js',         required: true  },
    { src: 'js/room-reveal.js',         required: true  },
    { src: 'js/anti-cheat.js',          required: false },
    { src: 'js/security.js',            required: false },
    { src: 'js/wallet-history.js',      required: false },
    { src: 'js/match-result-detail.js', required: false },
    { src: 'js/streak.js',              required: false },
    { src: 'js/referral-tracker.js',    required: false },
    { src: 'js/profile-card.js',        required: false },
    { src: 'js/quick-deposit.js',       required: false },
    { src: 'js/offline-handler.js',     required: false },
    { src: 'js/features-user.js',       required: false },

    /* Feature files f01–f99 */
    { src: 'js/features/f01-late-join-banner.js',           required: false },
    { src: 'js/features/f02-popularity-badge.js',           required: false },
    { src: 'js/features/f03-difficulty-badge.js',           required: false },
    { src: 'js/features/f04-dynamic-prize.js',              required: false },
    { src: 'js/features/f05-quick-rematch.js',              required: false },
    { src: 'js/features/f06-daily-streak.js',               required: false },
    { src: 'js/features/f07-weekly-challenge.js',           required: false },
    { src: 'js/features/f10-performance-dashboard.js',      required: false },
    { src: 'js/features/f11-win-prediction.js',             required: false },
    { src: 'js/features/f12-player-titles.js',              required: false },
    { src: 'js/features/f13-wallet-split.js',               required: false },
    { src: 'js/features/f14-post-match-survey.js',          required: false },
    { src: 'js/features/f16-online-count.js',               required: false },
    { src: 'js/features/f17-match-reminder.js',             required: false },
    { src: 'js/features/f18-earning-goal.js',               required: false },
    { src: 'js/features/f19-referral-leaderboard.js',       required: false },
    { src: 'js/features/f20-match-share-card.js',           required: false },
    { src: 'js/features/f21-season-system.js',              required: false },
    { src: 'js/features/f22-player-chat.js',                required: false },
    { src: 'js/features/f23-achievements.js',               required: false },
    { src: 'js/features/f24-result-screenshot.js',          required: false },
    { src: 'js/features/f25-public-history.js',             required: false },
    { src: 'js/features/f26-cashback.js',                   required: false },
    { src: 'js/features/f27-live-counter.js',               required: false },
    { src: 'js/features/f28-verified-badge.js',             required: false },
    { src: 'js/features/f29-special-tournaments.js',        required: false },
    { src: 'js/features/f30-smart-filter.js',               required: false },
    { src: 'js/features/f31-rank-widget.js',                required: false },
    { src: 'js/features/f32-countdown.js',                  required: false },
    { src: 'js/features/f33-prize-popup.js',                required: false },
    { src: 'js/features/f34-notif-center.js',               required: false },
    { src: 'js/features/f35-join-confirm.js',               required: false },
    { src: 'js/features/f36-wallet-guard.js',               required: false },
    { src: 'js/features/f37-per-match-reminder.js',         required: false },
    { src: 'js/features/f38-result-card.js',                required: false },
    { src: 'js/features/f39-team-check.js',                 required: false },
    { src: 'js/features/f40-match-recap.js',                required: false },
    { src: 'js/features/f41-profile-completeness.js',       required: false },
    { src: 'js/features/f42-coin-history.js',               required: false },
    { src: 'js/features/f43-share-app.js',                  required: false },
    { src: 'js/features/f44-polls.js',                      required: false },
    { src: 'js/features/f45-suggestions.js',                required: false },
    { src: 'js/features/f46-features-bundle.js',            required: false },
    { src: 'js/features/f47-anti-fraud-complete.js',        required: false },
    { src: 'js/features/f48-engagement-complete.js',        required: false },
    { src: 'js/features/f49-ux-complete.js',                required: false },
    { src: 'js/features/f50-screenshot-watermark-validator.js', required: false },
    { src: 'js/features/f51-rapid-join-spam-blocker.js',    required: false },
    { src: 'js/features/f52-referral-abuse-detector.js',    required: false },
    { src: 'js/features/f53-chat-spam-prevention.js',       required: false },
    { src: 'js/features/f54-multi-account-blocker.js',      required: false },
    { src: 'js/features/f55-utr-duplicate-detector.js',     required: false },
    { src: 'js/features/f56-vpn-proxy-detection.js',        required: false },
    { src: 'js/features/f57-f72-advanced-fraud-shield.js',  required: false },
    { src: 'js/features/f73-f74-session-metadata.js',       required: false },
    { src: 'js/features/f75-smart-match-filter.js',         required: false },
    { src: 'js/features/f76-wallet-alert.js',               required: false },
    { src: 'js/features/f77-match-countdown.js',            required: false },
    { src: 'js/features/f78-my-rank-widget.js',             required: false },
    { src: 'js/features/f79-prize-breakdown.js',            required: false },
    { src: 'js/features/f80-auto-team-check.js',            required: false },
    { src: 'js/features/f81-notif-center-v2.js',            required: false },
    { src: 'js/features/f82-smart-join-confirm.js',         required: false },
    { src: 'js/features/f83-result-history-card.js',        required: false },
    { src: 'js/features/f84-match-reminder-bell.js',        required: false },
    { src: 'js/features/f85-performance-trend.js',          required: false },
    { src: 'js/features/f86-session-summary.js',            required: false },
    { src: 'js/features/f87-comeback-alert.js',             required: false },
    { src: 'js/features/f88-spending-tracker.js',           required: false },
    { src: 'js/features/f89-milestone-tracker.js',          required: false },
    { src: 'js/features/f90-combo-streak-bonus.js',         required: false },
    { src: 'js/features/f91-best-match-suggester.js',       required: false },
    { src: 'js/features/f92-daily-quiz.js',                 required: false },
    { src: 'js/features/f93-f99-automation-bundle.js',      required: false },
    { src: 'js/features/f100-f109-automation-bundle.js',    required: false },

    /* System files — proper order important */
    { src: 'js/legal-compliance.js',    required: false },
    { src: 'js/preview-mode.js',        required: false },
    { src: 'js/ui-fixes.js',            required: false },
    { src: 'js/smart-automations.js',   required: false },
    { src: 'js/rank-system.js',         required: false },
    { src: 'js/premium-system.js',      required: false },
    { src: 'js/diamond-system.js',      required: false },
    { src: 'js/referral-system-fix.js', required: false },
    { src: 'js/ad-manager.js',          required: false },
    { src: 'js/fix9-toast-queue.js',    required: false },
    { src: 'js/fix10-server-time-sync.js', required: false },
    { src: 'js/fix5-listener-manager.js',  required: false },
    { src: 'js/fix6-offline-queue.js',     required: false },
    { src: 'js/fix8-lazy-loading.js',      required: false },
    { src: 'js/security-patches.js',       required: false },
    { src: 'js/fix12-push-notifications.js', required: false },

    /* v7 aur v8 fixes — bilkul last */
    { src: 'js/fixes-v7.js',  required: false },
    { src: 'js/fixes-v8.js',  required: true  },
  ];

  var _loaded = 0;
  var _failed = [];
  var _total  = FEATURE_SCRIPTS.length;

  /* ── Load scripts sequentially with error isolation ── */
  function loadNext(index) {
    if (index >= _total) {
      onAllLoaded();
      return;
    }

    var item   = FEATURE_SCRIPTS[index];
    var script = document.createElement('script');
    script.src = item.src;

    /* Success */
    script.onload = function () {
      _loaded++;
      loadNext(index + 1);
    };

    /* Error — log karo, continue karo */
    script.onerror = function () {
      _failed.push(item.src);
      if (item.required) {
        console.error('[Loader] ❌ REQUIRED script failed: ' + item.src);
      } else {
        console.warn('[Loader] ⚠️ Optional script failed (skipped): ' + item.src);
      }
      /* App continue karta hai — required ho ya na ho */
      loadNext(index + 1);
    };

    document.body.appendChild(script);
  }

  /* ── After all scripts loaded ── */
  function onAllLoaded() {
    if (_failed.length > 0) {
      console.warn('[Loader] ⚠️ ' + _failed.length + ' script(s) failed to load:');
      _failed.forEach(function (src) { console.warn('  - ' + src); });
    }
    console.log('[Loader] ✅ All scripts processed (' + _loaded + '/' + _total + ' loaded)');

    /* User presence setup */
    setupPresence();

    /* Final boot check */
    finalBootCheck();
  }

  /* ── User Presence ── */
  function setupPresence() {
    var _presInt = setInterval(function () {
      if (!window.db || !window.U) return;
      clearInterval(_presInt);
      var ref = window.db.ref('presence/' + window.U.uid);
      window.db.ref('.info/connected').on('value', function (s) {
        if (s.val() !== true) return;
        ref.onDisconnect().remove();
        ref.set({ online: true, role: 'user', lastSeen: firebase.database.ServerValue.TIMESTAMP, page: window.curScr || 'home' });
      });
      setInterval(function () {
        if (window.U && window.curScr) {
          ref.update({ page: window.curScr, lastSeen: firebase.database.ServerValue.TIMESTAMP });
        }
      }, 30000);
    }, 800);
  }

  /* ── Final boot check — baad mein bhi blank screen nahi hona chahiye ── */
  function finalBootCheck() {
    setTimeout(function () {
      var mc  = document.getElementById('mainContent');
      var ls  = document.getElementById('loginScreen');
      var sp  = document.getElementById('splash');
      var hdr = document.getElementById('header');
      var nav = document.getElementById('bottomNav');

      /* Splash still showing after everything loaded */
      if (sp && sp.style.display !== 'none') {
        console.warn('[Loader] Splash still visible after full load — forcing hide');
        sp.style.display = 'none';
      }

      /* Logged in but mainContent hidden */
      if (window.U && window.UD && mc && mc.style.display === 'none') {
        console.warn('[Loader] mainContent hidden after full load — forcing show');
        ls  && (ls.style.display  = 'none');
        hdr && (hdr.style.display = '');
        nav && (nav.style.display = '');
        mc.style.display = '';
        try { window.renderHome && window.renderHome(); } catch(e) {}
        try { window.updateHdr  && window.updateHdr(); }  catch(e) {}
      }
    }, 1500);
  }

  /* ── Start loading after DOM ready ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { loadNext(0); });
  } else {
    loadNext(0);
  }

  console.log('[Loader] 🚀 Safe loader started — ' + _total + ' scripts queued');

})();
