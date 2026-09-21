/* ================================================================
   MINI ESPORTS — SERVICE WORKER v34
   Cache-first for static (JS/CSS/fonts) → 2nd load nearly instant
   Network-first for Supabase API → data always fresh
================================================================ */
/* ✅ BUG FIX (2026-08-26): "WhatsApp abhi bhi nahi khulta, sirf APK
   me" — reported repeatedly across multiple sessions even after the
   actual JS bug (broken intent://send/... / whatsapp:// scheme in
   js/fixes-v7.js) was genuinely fixed in source each time. Root cause
   was never the WhatsApp code itself after the first real fix — it
   was this service worker. App files are served stale-while-
   revalidate (old cached copy served INSTANTLY on every load, while a
   background fetch silently updates the cache for next time) — but
   CACHE_VER here was never bumped across any of those sessions, so
   the APK's WebView kept serving its original, long-since-stale
   cached copy of js/fixes-v7.js (and every other app file) forever,
   completely ignoring every source fix that shipped after whenever
   that cache was first populated. Chrome likely wasn't affected the
   same way because it doesn't persist this service worker's
   CacheStorage as durably/long-lived as the wrapped APK's WebView
   does. Bumping CACHE_VER forces the activate handler below to delete
   the entire old cache and refetch every file fresh — this must be
   done on every future release that touches any file listed in
   LOCAL_FILES, not just this one, or the exact same "fix doesn't seem
   to apply" pattern will keep recurring for any JS change, not just
   WhatsApp. */
var CACHE_VER    = 'me-v58-9-22o';
var CACHE_STATIC = CACHE_VER + '-static';
var CACHE_CDN    = CACHE_VER + '-cdn';
/* BUG FIX (2026-07): BASE was hardcoded to '/ff-user-panel/', which is
   only correct on the GitHub Pages domain. On the Cloudflare Workers
   domain (root path) every precache URL built from it pointed at the
   wrong place and silently failed, so offline caching never actually
   worked there. Deriving BASE from the service worker's own script URL
   (self.location) makes it correct on ANY domain automatically — this
   file is always registered at the root of wherever the app lives. */
var BASE = self.location.href.replace(/sw\.js(\?.*)?$/, '');

/* ✅ BUG FIX (2026-09-14, CRITICAL): ASSET_VER here was a completely
   SEPARATE variable from CACHE_VER above and from index.html's own
   ?v= tags — it was last bumped 2026-08-28 and then NEVER touched
   again across every single session since, even though CACHE_VER and
   index.html's tags were bumped repeatedly (20260914a through f).
   This is why Junaid kept seeing old JS behavior (old error labels
   like "(dupcheck)" from a build several fixes ago) no matter how
   many times a real fix shipped: this file's own precache list
   (LOCAL_FILES below) was built with a stale ?v=20260828a suffix that
   never matched what index.html's <script> tags actually requested
   (?v=20260914f etc), so every precache entry was permanently
   pointing at URLs the page never asks for — install-time precaching
   was silently doing nothing useful for months. Must ALWAYS be kept
   equal to whatever ?v= suffix index.html's local <script>/<link>
   tags use, updated together on every release from now on. */
var ASSET_VER = '20260922o';

var LOCAL_FILES = [
  '','index.html','styles.css','style.css','manifest.json',
  'core/firebase.js','core/db.js','core/db-bridge.js','core/bugfixes.js',
  'core/imgbb.js','core/utils.js','core/router.js','core/modal.js',
  'core/header.js','core/auth.js','core/listeners.js','core/boot.js',
  'screens/home.js','screens/matches.js','screens/join.js','screens/room.js',
  'screens/wallet.js','screens/rank.js','screens/profile.js',
  'screens/support.js','screens/notifications.js',
  'features/app-config.js','features/ads.js','features/premium.js',
  'features/battle-pass.js','features/battle-pass-xp.js','features/free-trial.js',
  'features/bundle-offers.js','features/rewarded-bonus.js','features/clan.js',
  'features/spectator.js','features/growth.js','features/premium-creator.js',
  'features/creator-match-host.js',  /* R24: creator-video-feed हटा (feature अगस्त-2026 में removed; zero-refs सिद्ध) */
  'features/auto-squad.js','features/seasonal-league.js','features/checkin-system.js',
  'features/watch-earn.js','features/match-history.js','features/admin-badge.js',
  'features/skill-matchmaking.js','features/squad-finder.js','features/friends.js',
  'features/challenge.js','features/player-card.js','features/streak.js',
  'features/city-championship.js','features/clean-badge.js','features/bracket.js',
  'features/squad-bank.js','features/mentor.js','features/clan-war.js',
  'features/india-map.js',
  'features/f29-special-tournament.js', /* ✅ R25: F29 helper (vaapas joda) */
  'js/safe-loader.js','js/fixes-v7.js','js/fixes-v8.js','js/fixes-v9.js',
  'js/fix5-listener-manager.js','js/fix6-offline-queue.js','js/fix8-lazy-loading.js',
  'js/fix9-toast-queue.js','js/fix10-server-time-sync.js','js/fix12-push-notifications.js',
  'js/features-user.js','js/ui-fixes.js','js/security-patches.js','js/security.js',
  'js/anti-cheat.js','js/device-identity.js','js/legal-compliance.js',
  'js/diamond-system.js','js/rank-system.js','js/wallet-history.js',
  'js/match-timer.js','js/match-result-detail.js','js/room-reveal.js',
  'js/quick-deposit.js','js/offline-handler.js','js/referral-tracker.js',
  'js/referral-system-fix.js','js/profile-card.js','js/smart-automations.js',
  'js/preview-mode.js','js/fixes-v10-all-bugs.js','js/fixes-v29-all-bugs.js',
  'js/paytm-checkout.js','js/bugfixes-v29-final.js','js/bugfix-v30-final.js',
].map(function(f){ return BASE + f + (f ? '?v=' + ASSET_VER : ''); });

var CDN_FILES = [
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-analytics-compat.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css',
];

/* ── INSTALL: Pre-cache everything ── */
self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(Promise.all([
    caches.open(CACHE_STATIC).then(function(c){
      return Promise.all(LOCAL_FILES.map(function(u){
        return c.add(u).catch(function(){ /* 404 ok, skip */ });
      }));
    }),
    caches.open(CACHE_CDN).then(function(c){
      return Promise.all(CDN_FILES.map(function(u){
        return c.add(u).catch(function(){ });
      }));
    })
  ]));
});

/* ── ACTIVATE: Delete old caches ── */
self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){
        return k !== CACHE_STATIC && k !== CACHE_CDN;
      }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

/* ── FETCH: Smart routing ── */
self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  var u = e.request.url;

  /* Supabase/Firebase APIs → Network first (fresh data) */
  if(u.includes('supabase.co') || u.includes('firebaseio.com') ||
     u.includes('identitytoolkit') || u.includes('securetoken.google') ||
     u.includes('fcm.googleapis')){
    e.respondWith(networkFirst(e.request)); return;
  }
  /* CDN → Cache first (static SDKs never change) */
  if(u.includes('gstatic.com') || u.includes('cdn.jsdelivr') ||
     u.includes('cdnjs.cloudflare') || u.includes('fonts.g') ||
     u.includes('onesignal.com')){
    e.respondWith(cacheFirst(e.request, CACHE_CDN)); return;
  }
  /* ✅ BUG FIX (2026-09-14): our own app JS/CSS files used to be
     stale-while-revalidate — meaning ANY previously-cached response
     (even from a much older release, matched by exact URL) is served
     INSTANTLY while a background fetch silently updates the cache for
     the *next* load only. Combined with the ASSET_VER mismatch bug
     just fixed above (which meant install-time precaching effectively
     never populated the *current* versioned URLs), and real-world
     WebView/CDN edge caching sitting in front of GitHub Pages, this
     produced exactly the repeated "fix doesn't seem to apply" pattern
     seen across many sessions (WhatsApp intent, then this Sky Diamond
     Firebase bug) — the query-string version bump alone was not a
     reliable enough signal for every caching layer in the chain to
     actually invalidate on. Switched to network-first for our own app
     files: always try the network first (so a genuine code change is
     visible on the very next load, not "eventually"), and only fall
     back to whatever's cached if the network request fails outright
     (true offline). This trades a few hundred ms per load for
     guaranteed freshness — the right trade for an app that ships
     frequent bug fixes like this one. */
  if(u.includes('deepsilence10161-source.github.io') ||
     u.startsWith(self.location.origin)){
    e.respondWith(networkFirst(e.request));
  }
});

function cacheFirst(req, name){
  return caches.open(name||CACHE_STATIC).then(function(c){
    return c.match(req).then(function(hit){
      if(hit) return hit;
      return fetch(req).then(function(r){
        if(r&&r.status===200) c.put(req,r.clone()); return r;
      });
    });
  });
}
function networkFirst(req){
  return fetch(req).then(function(r){
    if(r&&r.status===200) caches.open(CACHE_STATIC).then(function(c){ c.put(req,r.clone()); });
    return r;
  }).catch(function(){ return caches.match(req); });
}
function staleWhileRevalidate(req){
  return caches.open(CACHE_STATIC).then(function(c){
    return c.match(req).then(function(hit){
      var net = fetch(req).then(function(r){
        if(r&&r.status===200) c.put(req,r.clone()); return r;
      }).catch(function(){ return hit; });
      return hit||net;
    });
  });
}
