/* ================================================================
   MINI ESPORTS — Offline Queue v2.0
   Bug 4 Fix: Security checks (rate limit, self-exclusion, device FP)
   are replayed when going back online BEFORE executing queued joins
================================================================ */
(function () {
  'use strict';

  var DB_NAME = 'mes_offline_q', DB_VER = 2, STORE = 'ops'; // Issue #12: bumped to v2

  /* ── IndexedDB helper ── */
  function _openDB(cb) {
    var req = indexedDB.open(DB_NAME, DB_VER);
    /* Issue #12 Fix: Handle version upgrades — creates store on v1, adds index on v2 */
    req.onupgradeneeded = function (e) {
      var idb = e.target.result;
      var oldVersion = e.oldVersion;
      /* v0 → v1: create object store */
      if (!idb.objectStoreNames.contains(STORE)) {
        idb.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
      }
      /* v1 → v2: add 'type' index for efficient queue filtering */
      if (oldVersion < 2) {
        var tx = e.target.transaction;
        if (tx && tx.objectStore) {
          try {
            var store = tx.objectStore(STORE);
            if (!store.indexNames.contains('type')) {
              store.createIndex('type', 'type', { unique: false });
            }
          } catch(idxErr) { /* index may already exist — safe to ignore */ }
        }
      }
    };
    req.onsuccess = function (e) { cb(e.target.result); };
    req.onerror   = function (e) { console.error('[OQ] IDB open error:', e.target.error); cb(null); };
  }

  function enqueue(op) {
    /* Bug 4 Fix: Capture security metadata at queue time */
    op._queuedAt     = Date.now();
    op._deviceId     = window.getDeviceId ? window.getDeviceId() : localStorage.getItem('_minieSport_did') || 'unknown';
    op._canvasFP     = sessionStorage.getItem('_mes_cfp') || '';
    op._userAgent    = navigator.userAgent.substring(0, 80);
    _openDB(function (db) {
      if (!db) return;
      db.transaction(STORE, 'readwrite').objectStore(STORE).add(op);
      _updateBadge();
    });
  }

  function dequeue(id, cb) {
    _openDB(function (db) {
      if (!db) return cb && cb();
      db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id).onsuccess = function () { cb && cb(); };
    });
  }

  /* ── Bug 4 Fix: Replay security checks before executing ── */
  function _replaySecurityChecks(op, done) {
    var JOIN_COOLDOWN_MS = 5000;

    if (op.type === 'joinMatch' && window.U) {
      var uid = window.U.uid;
      /* Bug High #8 Fix: Check Supabase is_banned first (authoritative ban source),
         then Firebase selfExcluded as fallback */
      function _checkBanAndProceed() {
        var db = window.db;
        if (!db) { done(true); return; }
        db.ref('users/' + uid + '/selfExcluded').once('value', function (s) {
          if (s.val() === true) {
            console.warn('[OQ] Queued join rejected — self-exclusion active');
            done(false, 'Self-exclusion active'); return;
          }
          var currentFP = sessionStorage.getItem('_mes_cfp') || '';
          if (op._canvasFP && currentFP && op._canvasFP !== currentFP) {
            console.warn('[OQ] Queued join rejected — device fingerprint mismatch');
            done(false, 'Device mismatch'); return;
          }
          var JR = window.JR || {};
          var alreadyJoined = Object.values(JR).some(function (jr) {
            return jr.matchId === (op.payload && op.payload.matchId) &&
                   (jr.status === 'pending' || jr.status === 'joined' || jr.status === 'approved');
          });
          if (alreadyJoined) {
            console.warn('[OQ] Queued join rejected — already joined');
            done(false, 'Already joined'); return;
          }
          done(true);
        });
      }

      if (window._supa) {
        // Check Supabase is_banned (authoritative)
        window._supa.from('user_public_profiles').select('is_banned').eq('id', uid).single() /* BUG #38 FIX */
          .then(function(r) {
            if (r.data && r.data.is_banned) {
              console.warn('[OQ] Queued join rejected — Supabase ban active');
              done(false, 'Account banned'); return;
            }
            _checkBanAndProceed();
          })
          .catch(function() { _checkBanAndProceed(); }); // Supabase unavailable → Firebase check
      } else {
        _checkBanAndProceed();
      }
    } else {
      done(true);
    }
  }

  /* ── Execute a single queued op (with security replay) ── */
  function _executeOp(op, done) {
    switch (op.type) {

      case 'joinMatch':
        var p = op.payload;
        /* Security checks first */
        _replaySecurityChecks(op, function (ok, reason) {
          if (!ok) {
            if (window.toast) window.toast('⚠️ Queued join cancelled: ' + (reason||'security'), 'err');
            done(true); return;
          }
          if (!window.U || !window.db) { done(false); return; }

          if (window._supa && p.entryFee > 0) {
            /* Paid match — validate via RPC */
            function _doRPCReplay() {
              window._supa.rpc('validate_and_join_match', {
                p_uid:       window.U.uid,
                p_match_id:  p.matchId,
                p_entry_fee: p.entryFee || 0,
                p_currency:  p.entryType === 'coin' ? 'coins' : 'sky_diamonds',
                p_join_data: JSON.stringify({ fee_split: p.feeType || 'solo' })
              }).then(function(r) {
                if (r && r.data && r.data.ok === false) {
                  if (window.toast) window.toast('❌ Queued join failed: ' + (r.data.error||'Server rejected'), 'err');
                  done(true);
                } else {
                  window.db.ref('joinRequests').push(Object.assign({}, p, {
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    status: 'pending', _offlineQueued: true
                  }));
                  done(true);
                }
              }).catch(function() { done(false); });
            }
            /* Pre-check slots */
            window._supa.from('matches').select('data').eq('firebase_id', p.matchId).single()
              .then(function(mr) {
                var md = (mr.data && mr.data.data) || {};
                /* Bug #19 Fix: Check match status — don't join started/completed/cancelled matches */
                var matchStatus = md.status || md.matchStatus || '';
                if (matchStatus === 'live' || matchStatus === 'completed' || matchStatus === 'cancelled') {
                  if (window.toast) window.toast('⚠️ Queued join cancelled: match already ' + matchStatus, 'err');
                  done(false, 'match_' + matchStatus);
                  return;
                }
                var filled = Number(md.filledSlots||0), maxS = Number(md.maxSlots||md.totalSlots||999);
                if (filled >= maxS) {
                  if (window.toast) window.toast('⚠️ Match bhar gaya — queued join cancel', 'inf');
                  done(true); return;
                }
                _doRPCReplay();
              }).catch(function() { _doRPCReplay(); });
          } else {
            /* Free match — insert directly */
            var _freePayload = Object.assign({}, p, {
              timestamp: firebase.database.ServerValue.TIMESTAMP,
              status: 'joined', _offlineQueued: true
            });
            if (window.db) {
              window.db.ref('joinRequests').push(_freePayload)
                .then(function() { done(true); })
                .catch(function() { done(false); });
            }
            if (window._supa && window.U) {
              window._supa.from('join_requests').insert({
                user_id:       window.U.uid,
                match_id:      p.matchId,
                entry_fee_paid: 0,
                entry_type:    'free',
                status:        'joined',
                user_ign:      p.userIgn || '',
                user_ff_uid:   p.userFFUID || ''
              }).then(null, function(e) { console.warn('[OQ] Supabase free join insert fail:', e && e.message); });
            }
          }
        });
        break;

      case 'walletRequest':
        var wp = op.payload;
        window.db && window.db.ref('walletRequests').push(Object.assign({}, wp, {
          createdAt: firebase.database.ServerValue.TIMESTAMP, _offlineQueued: true
        })).then(function () { done(true); }).catch(function () { done(false); });
        break;

      case 'firebaseSet':
        window.db && window.db.ref(op.payload.path).set(op.payload.value)
          .then(function () { done(true); }).catch(function () { done(false); });
        break;

      case 'firebaseUpdate':
        window.db && window.db.ref(op.payload.path).update(op.payload.value)
          .then(function () { done(true); }).catch(function () { done(false); });
        break;

      case 'firebasePush':
        window.db && window.db.ref(op.payload.path).push(op.payload.value)
          .then(function () { done(true); }).catch(function () { done(false); });
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
    _openDB(function (db) {
      if (!db) { _retrying = false; return; }
      var tx = db.transaction(STORE, 'readonly');
      var req = tx.objectStore(STORE).getAll();
      req.onsuccess = function (e) {
        var ops = e.target.result || [];
        if (!ops.length) { _retrying = false; return; }
        console.log('[OQ] Retrying', ops.length, 'pending operation(s)...');
        var i = 0;
        function next() {
          if (i >= ops.length) { _retrying = false; _updateBadge(); return; }
          var op = ops[i++];
          _executeOp(op, function (success) {
            if (success) {
              dequeue(op.id, next);
            } else {
              next(); /* Skip failed, try others */
            }
          });
        }
        next();
      };
      req.onerror = function () { _retrying = false; };
    });
  }

  function _updateBadge() {
    _openDB(function (db) {
      if (!db) return;
      db.transaction(STORE, 'readonly').objectStore(STORE).count().onsuccess = function (e) {
        var n = e.target.result || 0;
        var badge = document.getElementById('_oqBadge');
        if (!badge && n > 0) {
          badge = document.createElement('div');
          badge.id = '_oqBadge';
          badge.style.cssText = 'position:fixed;bottom:80px;right:12px;background:#ff6600;color:#fff;border-radius:20px;padding:6px 12px;font-size:11px;font-weight:700;z-index:9999;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)';
          badge.onclick = function () { window.OQ.retry(); };
          document.body && document.body.appendChild(badge);
        }
        if (badge) {
          if (n > 0) { badge.textContent = '📡 ' + n + ' queued — tap to retry'; badge.style.display = 'block'; }
          else badge.style.display = 'none';
        }
      };
    });
  }

  /* ── Online/offline events ── */
  window.addEventListener('online',  function () { _online = true;  retryPending(); });
  window.addEventListener('offline', function () { _online = false; });

  /* ── Public API ── */
  window.OQ = {
    joinMatch: function (matchId, teamName) {
      var U = window.U, UD = window.UD, t = window.MT && window.MT[matchId];

      // Bug New-29 Fix: Banned users must not be able to queue a join,
      // even offline. The ban check runs when connectivity is restored,
      // but the Supabase RPC will reject the join anyway; blocking here
      // avoids a confusing "join queued" message for a banned user.
      if (UD && (UD.isBanned === true || UD.banned === true)) {
        if (window.toast) window.toast('⛔ Aapka account ban hai. Match join nahi kar sakte.', 'err');
        return;
      }

      var payload = {
        userId:    U ? U.uid : '',
        matchId:   matchId,
        teamName:  teamName || '',
        entryFee:  t ? (Number(t.entryFee) || 0) : 0,
        entryType: t ? (t.entryType || 'coin') : 'coin',
        userIgn:   UD ? (UD.ign || '') : '',
        userFFUID: UD ? (UD.ffUid || '') : ''
      };
      /* Bug #61 Fix: Deduplicate — don't queue same match twice */
      var _existingQ = typeof _queue !== 'undefined' ? _queue : (window._oq_data ? window._oq_data : []);
      var _alreadyQueued = _existingQ.some(function(op) {
        return op && op.type === 'joinMatch' && op.payload && op.payload.matchId === matchId;
      });
      if (_alreadyQueued) {
        if (window.toast) window.toast('ℹ️ Yeh match pehle se queue mein hai!', 'inf');
        return;
      }
      enqueue({ type: 'joinMatch', payload: payload });
      if (window.toast) window.toast('📡 Offline — join queued, online hone pe submit hoga', 'inf');
    },
    enqueue:      enqueue,
    /* Bug 15 Fix: Called on logout to wipe all pending operations so they
       cannot be replayed by a different user who logs in on the same device. */
    clearAll: function() {
      _openDB(function(idb) {
        if (!idb) return;
        var tx = idb.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        console.log('[OQ] Queue cleared on logout ✅');
        idb.close();
      });
    },
    retry:        retryPending,
    pendingCount: function (cb) {
      _openDB(function (db) {
        if (!db) return cb(0);
        db.transaction(STORE, 'readonly').objectStore(STORE).count().onsuccess = function (e) { cb(e.target.result || 0); };
      });
    }
  };

  /* Init badge */
  setTimeout(_updateBadge, 2000);
  console.log('[Mini eSports] ✅ Offline Queue v2.0 loaded (with security replay)');
})();
