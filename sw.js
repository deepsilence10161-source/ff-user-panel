/* ================================================================
   MINI ESPORTS — SERVICE WORKER v32
   Cache-first for static (JS/CSS/fonts) → 2nd load nearly instant
   Network-first for Supabase API → data always fresh
================================================================ */
var CACHE_VER    = 'me-v32-3';
var CACHE_STATIC = CACHE_VER + '-static';
var CACHE_CDN    = CACHE_VER + '-cdn';
var BASE         = '/ff-user-panel/';

var LOCAL_FILES = [
  BASE,'index.html','styles.css','style.css','js/user-ui-v10.css','manifest.json',
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
  'features/creator-video-feed.js','features/creator-match-host.js',
  'features/auto-squad.js','features/seasonal-league.js','features/checkin-system.js',
  'features/watch-earn.js','features/match-history.js','features/admin-badge.js',
  'features/skill-matchmaking.js','features/squad-finder.js','features/friends.js',
  'features/challenge.js','features/player-card.js','features/streak.js',
  'features/city-championship.js','features/clean-badge.js','features/bracket.js',
  'features/squad-bank.js','features/mentor.js','features/clan-war.js',
  'features/india-map.js',
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
].map(function(f){ return f.startsWith('/') ? f : BASE+f; });

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
  /* Our app files → Stale-while-revalidate (instant + always fresh) */
  if(u.includes('deepsilence10161-source.github.io') ||
     u.startsWith(self.location.origin)){
    e.respondWith(staleWhileRevalidate(e.request));
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
