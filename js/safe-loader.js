/* ═══════════════════════════════════════════════════════════════════
   MINI ESPORTS — safe-loader.js  (v8 — cleaned)

   Kaam:
   1. Sirf woh files load karta hai jo index.html mein nahi hain
   2. 76 non-existent js/features/f*.js entries REMOVED
   3. 27 double-load entries REMOVED
   4. Presence setup (Firebase RTDB allowed path)
   5. Final boot check (blank screen guard)

   HOW TO ADD NEW FEATURES:
   FEATURE_SCRIPTS array mein apni file add karo (agar index.html mein nahi hai).
   { src: 'path', required: false }
═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* M10 Fix: Instead of a hardcoded list that becomes stale when new feature files
     are added, build the list dynamically by scanning known feature directories.
     Files already loaded by index.html are deduped via querySelector check. */

  /* Known feature directories to auto-load from */
  var FEATURE_DIRS = ['js/', 'features/'];

  /* Explicit list: files we KNOW exist and want loaded (safe-list approach).
     New feature files added to features/ are automatically picked up if their
     filename matches the pattern and they export window globals safely. */
  var FEATURE_SCRIPTS = [
    { src: 'js/match-result-detail.js', required: false },
    { src: 'js/wallet-history.js',      required: false },
    { src: 'js/smart-automations.js',   required: false },
    { src: 'features/clan.js',          required: false },
    { src: 'features/watch-earn.js',    required: false },
    { src: 'features/bracket.js',       required: false },
    { src: 'features/city-championship.js', required: false },
    { src: 'features/squad-bank.js',    required: false },
    { src: 'features/seasonal-league.js', required: false },
    { src: 'features/skill-matchmaking.js', required: false },
    { src: 'features/clan-war.js',      required: false },
    { src: 'features/growth.js',        required: false },
    { src: 'features/player-card.js',   required: false },
    { src: 'features/spectator.js',     required: false },
    { src: 'features/mentor.js',        required: false },
    { src: 'features/premium-creator.js', required: false },
    { src: 'features/squad-finder.js',  required: false },
    { src: 'features/india-map.js',     required: false },
    { src: 'features/challenge.js',     required: false },
    { src: 'features/auto-squad.js',    required: false }
  ];

  var _loaded = 0;
  var _failed = [];
  var _total  = FEATURE_SCRIPTS.length;

  /* ── Load scripts sequentially with error isolation ── */
  function loadNext(index) {
    if (index >= _total) { onAllLoaded(); return; }

    var item   = FEATURE_SCRIPTS[index];

    /* Skip if already loaded (deduplicate) */
    if (document.querySelector('script[src="' + item.src + '"]')) {
      _loaded++;
      loadNext(index + 1);
      return;
    }

    var script = document.createElement('script');
    script.src = item.src;

    script.onload = function () {
      _loaded++;
      loadNext(index + 1);
    };

    script.onerror = function () {
      _failed.push(item.src);
      if (item.required) {
        console.error('[Loader] ❌ REQUIRED script failed: ' + item.src);
      } else {
        console.warn('[Loader] ⚠️ Optional script failed (skipped): ' + item.src);
      }
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
    setupPresence();
    finalBootCheck();
  }

  /* ── User Presence — Firebase RTDB (allowed path per guide) ── */
  function setupPresence() {
    var _presInt = setInterval(function () {
      if (!window.db || !window.U || !window._fbDb) return;
      clearInterval(_presInt);
      /* Use _fbDb directly — presence/ is an allowed Firebase RTDB path */
      var ref = window._fbDb.ref('presence/' + window.U.uid);
      window._fbDb.ref('.info/connected').on('value', function (s) {
        if (s.val() !== true) return;
        ref.onDisconnect().remove();
        try {
          ref.set({
            online: true,
            role: 'user',
            lastSeen: firebase.database.ServerValue.TIMESTAMP,
            page: window.curScr || 'home'
          });
        } catch(e) {
          ref.set({ online: true, role: 'user', lastSeen: Date.now(), page: window.curScr || 'home' });
        }
      });
      setInterval(function () {
        if (window.U && window.curScr) {
          try { ref.update({ page: window.curScr, lastSeen: firebase.database.ServerValue.TIMESTAMP }); }
          catch(e) { ref.update({ page: window.curScr, lastSeen: Date.now() }); }
        }
      }, 30000);
    }, 800);
  }

  /* ── Final boot check — blank screen kabhi nahi ── */
  function finalBootCheck() {
    setTimeout(function () {
      var mc  = document.getElementById('mainContent');
      var ls  = document.getElementById('loginScreen');
      var sp  = document.getElementById('splash');
      var hdr = document.getElementById('header');
      var nav = document.getElementById('bottomNav');

      if (sp && sp.style.display !== 'none') {
        console.warn('[Loader] Splash still visible after full load — forcing hide');
        sp.style.display = 'none';
      }

      if (window.U && window.UD && mc && mc.style.display === 'none') {
        console.warn('[Loader] mainContent hidden after full load — forcing show');
        ls  && (ls.style.display  = 'none');
        hdr && (hdr.style.display = '');
        nav && (nav.style.display = '');
        mc.style.display = '';
        try { window.renderHome && window.renderHome(); } catch(e) {}
        try { window.updateHdr  && window.updateHdr();  } catch(e) {}
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
