/* ================================================================
   SERVICE WORKER — sw.js
   MiniESports PWA | May 2026

   STRATEGY:
   — Static assets (CSS, JS, icons) → Cache First
   — API calls (Supabase, Firebase) → Network First (no cache)
   — HTML pages → Network First with offline fallback
   — Images → Cache First with network fallback
================================================================ */

var CACHE_NAME = 'miniesports-v1';
var OFFLINE_URL = '/offline.html';

/* Assets to pre-cache on install */
var PRE_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  /* Core JS — update version if files change */
  '/core/firebase.js',
  '/core/db.js',
  '/core/utils.js',
  '/core/router.js',
  '/core/modal.js',
  '/core/header.js',
  '/core/auth.js',
  '/core/boot.js',
  '/core/listeners.js',
  /* Icons */
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

/* ── INSTALL: pre-cache static assets ── */
self.addEventListener('install', function(event) {
  console.log('[SW] Installing v1...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRE_CACHE.map(function(url) {
        return new Request(url, { cache: 'reload' });
      })).catch(function(err) {
        /* Partial failure ok — don't block install */
        console.warn('[SW] Pre-cache partial fail:', err.message);
      });
    }).then(function() {
      return self.skipWaiting(); /* activate immediately */
    })
  );
});

/* ── ACTIVATE: clean old caches ── */
self.addEventListener('activate', function(event) {
  console.log('[SW] Activated');
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k)   { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim(); /* take control immediately */
    })
  );
});

/* ── FETCH: request strategy ── */
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  /* 1. Skip non-GET requests */
  if (event.request.method !== 'GET') return;

  /* 2. Skip Supabase API calls — always network */
  if (url.hostname.includes('supabase.co')) return;

  /* 3. Skip Firebase calls — always network */
  if (url.hostname.includes('firebase') || url.hostname.includes('firebaseio.com')) return;

  /* 4. Skip external CDNs (Firebase SDK, FontAwesome, etc.) */
  if (url.hostname !== self.location.hostname &&
      !url.hostname.includes('gstatic.com') &&
      !url.hostname.includes('imagekit.io')) return;

  /* 5. HTML pages — Network First, offline fallback */
  if (event.request.headers.get('accept') &&
      event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          /* Cache a fresh copy */
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
          return response;
        })
        .catch(function() {
          return caches.match(event.request)
            .then(function(cached) { return cached || caches.match(OFFLINE_URL); });
        })
    );
    return;
  }

  /* 6. Images — Cache First, network fallback */
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
          }
          return response;
        }).catch(function() {
          /* Return empty 1x1 transparent PNG */
          return new Response(
            atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
            { headers: { 'Content-Type': 'image/png' } }
          );
        });
      })
    );
    return;
  }

  /* 7. JS/CSS/Fonts — Cache First, network fallback */
  if (event.request.destination === 'script' ||
      event.request.destination === 'style'  ||
      event.request.destination === 'font') {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return fetch(event.request).then(function(response) {
          if (response.ok) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(event.request, clone); });
          }
          return response;
        });
      })
    );
    return;
  }

  /* 8. Everything else — Network First */
  event.respondWith(
    fetch(event.request).catch(function() {
      return caches.match(event.request);
    })
  );
});

/* ── PUSH NOTIFICATIONS (via OneSignal — this handles the heavy lifting) ── */
/* OneSignal ka SW automatically load hota hai — yeh sirf fallback hai */
self.addEventListener('push', function(event) {
  if (!event.data) return;
  try {
    var data = event.data.json();
    var options = {
      body:    data.body || '',
      icon:    '/icons/icon-192x192.png',
      badge:   '/icons/icon-72x72.png',
      vibrate: [200, 100, 200],
      data:    { url: data.url || '/' },
      actions: [
        { action: 'open',    title: '🎮 Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'MiniESports', options)
    );
  } catch(e) {
    console.warn('[SW] Push parse error:', e);
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  if (event.action === 'dismiss') return;
  var url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].url === url && 'focus' in list[i]) return list[i].focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

/* ── BACKGROUND SYNC (offline join request queue) ── */
self.addEventListener('sync', function(event) {
  if (event.tag === 'syncJoinRequests') {
    event.waitUntil(syncPendingJoins());
  }
});

function syncPendingJoins() {
  /* Main thread se pending joins uthao aur retry karo */
  return self.clients.matchAll().then(function(clients) {
    clients.forEach(function(client) {
      client.postMessage({ type: 'SYNC_JOIN_REQUESTS' });
    });
  });
}
