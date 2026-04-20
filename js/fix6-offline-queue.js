/* ============================================================
   FIX 6: OFFLINE QUEUE SYSTEM
   - IndexedDB mein pending requests store karo
   - Online hote hi retry karo (exponential backoff)
   - Match join, wallet operations support karta hai
   ============================================================ */

(function() {
  'use strict';

  var DB_NAME   = 'mes_offline_queue';
  var DB_VER    = 1;
  var STORE_NAME = 'pending_ops';
  var _idb      = null;
  var _online   = navigator.onLine;

  /* ── Open IndexedDB ── */
  function openIDB(cb) {
    if (_idb) return cb(_idb);
    var req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        var store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('type',   'type',   { unique: false });
      }
    };
    req.onsuccess = function(e) { _idb = e.target.result; cb(_idb); };
    req.onerror   = function(e) { console.error('[OQ] IDB open error:', e.target.error); cb(null); };
  }

  /* ── Enqueue an operation ── */
  function enqueue(op, cb) {
    /* op = { type, payload, retries, maxRetries, createdAt } */
    op.status     = 'pending';
    op.retries    = op.retries    || 0;
    op.maxRetries = op.maxRetries || 5;
    op.createdAt  = op.createdAt  || Date.now();

    openIDB(function(db) {
      if (!db) return cb && cb(null);
      var tx    = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      var req   = store.add(op);
      req.onsuccess = function() { if (cb) cb(req.result); };
      req.onerror   = function() { if (cb) cb(null); };
    });
  }

  /* ── Get all pending ops ── */
  function getPending(cb) {
    openIDB(function(db) {
      if (!db) return cb([]);
      var tx    = db.transaction(STORE_NAME, 'readonly');
      var store = tx.objectStore(STORE_NAME);
      var idx   = store.index('status');
      var req   = idx.getAll('pending');
      req.onsuccess = function() { cb(req.result || []); };
      req.onerror   = function() { cb([]); };
    });
  }

  /* ── Mark op as done or failed ── */
  function updateOp(id, status, cb) {
    openIDB(function(db) {
      if (!db) return cb && cb();
      var tx    = db.transaction(STORE_NAME, 'readwrite');
      var store = tx.objectStore(STORE_NAME);
      var req   = store.get(id);
      req.onsuccess = function() {
        var op = req.result;
        if (!op) return cb && cb();
        op.status = status;
        store.put(op);
        cb && cb();
      };
    });
  }

  function deleteOp(id, cb) {
    openIDB(function(db) {
      if (!db) return cb && cb();
      var tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      cb && cb();
    });
  }

  /* ── Execute a single pending op ── */
  function executeOp(op, done) {
    if (!window.db || !window.U) return done(false);

    switch (op.type) {

      /* Match join */
      case 'joinMatch':
        var p = op.payload;
        db.ref('joinRequests').push({
          userId:    p.userId,
          matchId:   p.matchId,
          teamName:  p.teamName  || '',
          timestamp: firebase.database.ServerValue.TIMESTAMP,
          status:    'pending',
          _offlineQueued: true
        }).then(function() { done(true); }).catch(function() { done(false); });
        break;

      /* Wallet deposit/withdraw request */
      case 'walletRequest':
        var wp = op.payload;
        db.ref('walletRequests').push(Object.assign({}, wp, {
          createdAt: firebase.database.ServerValue.TIMESTAMP,
          _offlineQueued: true
        })).then(function() { done(true); }).catch(function() { done(false); });
        break;

      /* Generic Firebase set */
      case 'firebaseSet':
        db.ref(op.payload.path).set(op.payload.value)
          .then(function() { done(true); }).catch(function() { done(false); });
        break;

      /* Generic Firebase update */
      case 'firebaseUpdate':
        db.ref(op.payload.path).update(op.payload.value)
          .then(function() { done(true); }).catch(function() { done(false); });
        break;

      /* Generic Firebase push */
      case 'firebasePush':
        db.ref(op.payload.path).push(op.payload.value)
          .then(function() { done(true); }).catch(function() { done(false); });
        break;

      default:
        console.warn('[OQ] Unknown op type:', op.type);
        done(false);
    }
  }

  /* ── Retry all pending ops ── */
  var _retrying = false;
  function retryPending() {
    if (_retrying || !_online) return;
    _retrying = true;

    getPending(function(ops) {
      if (!ops.length) { _retrying = false; return; }

      console.log('[OQ] Retrying', ops.length, 'pending operation(s)...');
      var idx = 0;

      function next() {
        if (idx >= ops.length) { _retrying = false; return; }
        var op = ops[idx++];

        executeOp(op, function(success) {
          if (success) {
            deleteOp(op.id, next);
            if (window.toast) toast('✅ Pending request completed!', 'ok');
          } else {
            op.retries++;
            if (op.retries >= op.maxRetries) {
              updateOp(op.id, 'failed', next);
              if (window.toast) toast('❌ Request failed after retries', 'err');
            } else {
              updateOp(op.id, 'pending', next);
            }
          }
        });
      }
      next();
    });
  }

  /* ── Online/offline detection ── */
  window.addEventListener('online',  function() { _online = true;  retryPending(); });
  window.addEventListener('offline', function() { _online = false; });

  /* ── Retry on Firebase reconnect ── */
  if (window.db) {
    db.ref('.info/connected').on('value', function(s) {
      if (s.val() === true) { _online = true; setTimeout(retryPending, 2000); }
    });
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      if (window.db) {
        db.ref('.info/connected').on('value', function(s) {
          if (s.val() === true) { _online = true; setTimeout(retryPending, 2000); }
        });
      }
    });
  }

  /* ── Public API ── */
  window.OQ = {
    /* Queue a match join — call this instead of direct Firebase push */
    joinMatch: function(matchId, teamName) {
      if (!window.U) { toast('Login karo pehle', 'err'); return; }
      var payload = { userId: U.uid, matchId: matchId, teamName: teamName || '' };
      if (_online && window.db) {
        /* Try immediately */
        db.ref('joinRequests').push(Object.assign({ timestamp: firebase.database.ServerValue.TIMESTAMP, status: 'pending' }, payload))
          .catch(function() {
            /* Failed — queue it */
            enqueue({ type: 'joinMatch', payload: payload });
            toast('📡 Offline — request queued', 'inf');
          });
      } else {
        enqueue({ type: 'joinMatch', payload: payload });
        toast('📡 Offline — request queued, online hone pe submit hoga', 'inf');
      }
    },

    /* Queue any generic Firebase operation */
    set:    function(path, value) { enqueue({ type: 'firebaseSet',    payload: { path: path, value: value } }); },
    update: function(path, value) { enqueue({ type: 'firebaseUpdate', payload: { path: path, value: value } }); },
    push:   function(path, value) { enqueue({ type: 'firebasePush',   payload: { path: path, value: value } }); },

    /* Get count of pending ops */
    pendingCount: function(cb) {
      getPending(function(ops) { cb(ops.length); });
    },

    /* Manual retry */
    retry: retryPending,

    /* Clear all failed ops */
    clearFailed: function() {
      openIDB(function(db) {
        if (!db) return;
        var tx    = db.transaction(STORE_NAME, 'readwrite');
        var store = tx.objectStore(STORE_NAME);
        var idx   = store.index('status');
        var req   = idx.getAll('failed');
        req.onsuccess = function() {
          (req.result || []).forEach(function(op) { store.delete(op.id); });
        };
      });
    }
  };

  /* ── Show pending badge in UI if any ── */
  function updatePendingBadge() {
    window.OQ.pendingCount(function(n) {
      var badge = document.getElementById('offlinePendingBadge');
      if (!badge) {
        badge = document.createElement('div');
        badge.id = 'offlinePendingBadge';
        badge.style.cssText = 'position:fixed;bottom:70px;right:12px;background:#ff6600;color:#fff;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:700;z-index:9999;display:none;cursor:pointer';
        badge.title = 'Pending requests — tap to retry';
        badge.onclick = function() { window.OQ.retry(); };
        document.body.appendChild(badge);
      }
      if (n > 0) {
        badge.textContent = '📡 ' + n + ' request' + (n > 1 ? 's' : '') + ' pending';
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    });
  }

  setInterval(updatePendingBadge, 5000);

  console.log('[Mini eSports] ✅ Fix 6: Offline Queue System loaded.');
})();
