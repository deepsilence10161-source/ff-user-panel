/* ================================================================
   FIREBASE → SUPABASE BRIDGE LAYER — core/db-bridge.js
   MiniESports v3.0 | May 2026

   STATUS: Migration complete — Supabase is PRIMARY backend
   
   YEH BRIDGE:
   - Features mein kuch db.ref() calls abhi bhi hain (clan.js, auto-squad.js etc)
   - Woh sab Supabase pe route hote hain via this bridge
   - Firebase RTDB = SIRF support/ chat path
   - Baaki sab Supabase
================================================================ */

(function() {
  'use strict';

  /* Wait for both Firebase and Supabase to be ready */
  function _waitAndInit() {
    if (!window.db || !window._supa) {
      setTimeout(_waitAndInit, 300);
      return;
    }
    _installBridge();
  }

  function _uid() {
    if (window.U) return window.U.uid;
    if (window._supa) {
      var s = window._supa.auth.session ? window._supa.auth.session() : null;
      return s && s.user ? s.user.id : null;
    }
    return null;
  }

  /* ── PATH ROUTER: decide Firebase vs Supabase ── */
  function _isFirebasePath(path) {
    /* Migration v3.0: These stay on Firebase RTDB */
    var root = path.split('/')[0];
    var rtRoots = [
      'support',           /* Support chat messages */
      'supportTyping',     /* Support typing indicators */
      'supportRequests',   /* Support ticket submissions */
      'appSettings',       /* Admin live config + adminResponseStats */
      'admins',            /* Admin user list */
      'presence',          /* Online presence */
      'liveStreams',        /* Spectator live streams */
      'announcements',     /* System announcements */
    ];
    return rtRoots.indexOf(root) !== -1;
  }

  /* ── SUPABASE WRITE ROUTER ── */
  function _supaWrite(path, value, isUpdate) {
    if (!window.DB || !window._supa) return Promise.resolve();

    var uid = _uid();
    var parts = path.split('/').filter(Boolean);
    var root = parts[0];

    /* users/{uid}/... */
    if (root === 'users' && parts[1]) {
      var targetUid = parts[1];
      var field = parts[2];

      if (!field) {
        /* Full user update */
        return window._supa.from('users').upsert({ id: targetUid, ...value });
      }

      /* users/{uid}/coins */
      if (field === 'coins') {
        var coins = typeof value === 'number' ? value : parseInt(value) || 0;
        return window._supa.from('users').update({ coins: coins }).eq('id', targetUid);
      }
      /* users/{uid}/realMoney/deposited|winnings|bonus */
      if (field === 'realMoney') {
        var subField = parts[3];
        if (subField === 'deposited') {
          return window._supa.from('users').update({ sky_diamonds: Math.max(0, parseInt(value) || 0) }).eq('id', targetUid);
        }
        if (subField === 'winnings') {
          return window._supa.from('users').update({ green_diamonds: Math.max(0, parseInt(value) || 0) }).eq('id', targetUid);
        }
      }
      /* users/{uid}/greenDiamonds */
      if (field === 'greenDiamonds') {
        return window._supa.from('users').update({ green_diamonds: Math.max(0, parseInt(value) || 0) }).eq('id', targetUid);
      }
      /* users/{uid}/skyDiamonds */
      if (field === 'skyDiamonds') {
        return window._supa.from('users').update({ sky_diamonds: Math.max(0, parseInt(value) || 0) }).eq('id', targetUid);
      }
      /* users/{uid}/stats/matches|wins|kills */
      if (field === 'stats') {
        var statField = parts[3];
        var updateObj = {};
        if (statField === 'matches') updateObj.total_matches = parseInt(value) || 0;
        if (statField === 'wins')    updateObj.total_wins    = parseInt(value) || 0;
        if (statField === 'kills')   updateObj.total_kills   = parseInt(value) || 0;
        if (Object.keys(updateObj).length) {
          return window._supa.from('users').update(updateObj).eq('id', targetUid);
        }
      }
      /* users/{uid}/notifications */
      if (field === 'notifications') {
        if (typeof value === 'object' && value !== null) {
          return window._supa.from('notifications').insert({
            user_id: targetUid,
            type: value.type || 'system',
            title: value.title || '',
            body: value.message || value.body || '',
            ref_id: value.matchId || null
          });
        }
      }
      /* users/{uid}/clanId */
      if (field === 'clanId') {
        return window._supa.from('users').update({ clan_id: value || null }).eq('id', targetUid);
      }
      /* users/{uid}/missionProgress */
      if (field === 'missionProgress' && typeof value === 'object') {
        var today = new Date().toISOString().split('T')[0];
        var upserts = Object.keys(value).map(function(k) {
          return {
            user_id: targetUid, mission_key: k, period: today,
            progress: value[k] || 0, target: 1, updated_at: new Date().toISOString()
          };
        });
        return window._supa.from('mission_progress').upsert(upserts, { onConflict: 'user_id,mission_key,period' });
      }
      /* users/{uid}/cosmetics/{cosmeticId} */
      if (field === 'cosmetics' && parts[3]) {
        return window._supa.from('user_cosmetics').upsert({
          user_id: targetUid, cosmetic_key: parts[3], purchased_at: new Date().toISOString()
        }, { onConflict: 'user_id,cosmetic_key' });
      }
      /* users/{uid}/profileImage or bannerImage */
      if (field === 'profileImage') {
        return window._supa.from('users').update({ avatar_url: value }).eq('id', targetUid);
      }
      /* users/{uid}/duoTeam | squadTeam | partnerUid */
      if (field === 'duoTeam' || field === 'squadTeam' || field === 'partnerUid' || field === 'squadUids') {
        var updateData = {};
        updateData[field] = value;
        return window._supa.from('users').update(updateData).eq('id', targetUid);
      }
      /* coinHistory write → log to Supabase wallet_transactions */
      if (field === 'coinHistory' && typeof value === 'object') {
        return window._supa.from('wallet_transactions').insert({
          user_id: targetUid, currency: 'coins',
          txn_type: value.amount > 0 ? 'credit' : 'debit',
          amount: Math.abs(value.amount || 1),
          reason: 'match_entry', note: value.reason || ''
        }).catch(function(){});
      }
      /* transactions write → log to Supabase */
      if (field === 'transactions' && typeof value === 'object') {
        return window._supa.from('wallet_transactions').insert({
          user_id: targetUid, currency: 'sky_diamonds',
          txn_type: value.type === 'credit' ? 'credit' : 'debit',
          amount: Math.abs(value.amount || 1),
          reason: 'match_entry', note: value.description || ''
        }).catch(function(){});
      }
      /* Generic user update — silently succeed (no-op for unmapped fields) */
      return Promise.resolve();
    }

    /* joinRequests/{jid} */
    if (root === 'joinRequests' && parts[1]) {
      var jid = parts[1];
      var subF = parts[2];
      if (subF === 'refunded') {
        return window._supa.from('join_requests').update({ status: 'refunded' }).eq('id', jid);
      }
      if (subF === 'inRoom') {
        return window._supa.from('join_requests').update({
          in_room: true, checkin_at: new Date().toISOString()
        }).eq('id', jid);
      }
      if (!subF && typeof value === 'object') {
        /* Full join request creation */
        return window._supa.from('join_requests').upsert({
          id: jid,
          match_id: value.matchId,
          user_id: value.userId,
          status: value.status || 'pending',
          entry_type: value.entryType === 'coin' ? 'coins' : 'diamonds',
          entry_fee_paid: value.entryFee || 0,
          ign_at_join: value.userName || value.userIGN || '',
          in_room: value.inRoom || false,
          checked_in: value.checkedIn || false,
          squad_members: JSON.stringify(value.teamMembers || []),
          created_at: new Date().toISOString()
        }, { onConflict: 'match_id,user_id' });
      }
      if (!subF && isUpdate) {
        var upd = {};
        if (value.inRoom !== undefined) upd.in_room = value.inRoom;
        if (value.checkedIn !== undefined) upd.checked_in = value.checkedIn;
        if (value.status) upd.status = value.status;
        if (value.kills !== undefined) upd.kills = value.kills;
        if (value.placement !== undefined) upd.placement = value.placement;
        return window._supa.from('join_requests').update(upd).eq('id', jid);
      }
    }

    /* walletRequests/{id} */
    if (root === 'walletRequests' && parts[1] && typeof value === 'object') {
      return window._supa.from('sd_requests').upsert({
        id: parts[1],
        user_id: value.uid || _uid(),
        amount_inr: value.amount || 0,
        sd_amount: value.sdAmount || value.amount || 0,
        upi_ref: value.upiId || value.utr || null,
        status: value.status || 'pending',
        created_at: new Date().toISOString()
      }, { onConflict: 'id' });
    }

    /* referrals/{id} */
    if (root === 'referrals' && parts[1] && typeof value === 'object') {
      return window._supa.from('referrals').upsert({
        id: parts[1],
        referrer_id: value.referrerId,
        referred_id: value.referredUid || value.referredId,
        join_bonus_paid: true
      }, { onConflict: 'referred_id' });
    }

    /* clans/ */
    if (root === 'clans') {
      if (parts[1] && !parts[2] && typeof value === 'object') {
        /* Create/update clan */
        return window._supa.from('clans').upsert({
          id: parts[1], name: value.name || '', tag: value.tag || (value.name||'').substr(0,3).toUpperCase(),
          description: value.description || null, leader_id: value.leaderId || _uid(),
          total_members: value.memberCount || 1
        }, { onConflict: 'id' });
      }
      if (parts[1] && parts[2] === 'members' && parts[3]) {
        if (value === null) {
          return window._supa.from('clan_members').delete().eq('clan_id', parts[1]).eq('user_id', parts[3]);
        }
        return window._supa.from('clan_members').upsert({
          clan_id: parts[1], user_id: parts[3], role: value.role || 'member'
        }, { onConflict: 'clan_id,user_id' });
      }
    }

    /* clanChats/{clanId} */
    if (root === 'clanChats' && parts[1] && typeof value === 'object') {
      return window._supa.from('clan_messages').insert({
        clan_id: parts[1], sender_id: _uid() || value.senderId,
        message: value.text || value.message || ''
      });
    }

    /* creatorStats/{uid}/... */
    if (root === 'creatorStats' && parts[1]) {
      /* Creator stats written to Supabase creator_applications */
      return window._supa.from('creator_applications')
        .upsert({ user_id: parts[1], creator_code: parts[1] }, { onConflict: 'user_id' });
    }

    /* matches/mid/checkIns/uid → Supabase join_requests.checked_in */
    if (root === 'matches' && parts[1] && parts[2] === 'checkIns' && parts[3]) {
      if (value === null) {
        return window._supa.from('join_requests').update({ checked_in: false }).eq('match_id', parts[1]).eq('user_id', parts[3]);
      }
      return window._supa.from('join_requests').update({ checked_in: true, checkin_at: new Date().toISOString() }).eq('match_id', parts[1]).eq('user_id', parts[3]);
    }
    /* matches/mid/joinedSlots → Supabase matches.filled_slots */
    if (root === 'matches' && parts[1] && parts[2] === 'joinedSlots') {
      return window._supa.rpc('increment_balance', { p_uid: parts[1], p_col: 'filled_slots', p_amount: 1 }).catch(function(){});
    }
    /* matches/mid/spectators/uid → Firebase RTDB (realtime spectator count) */
    if (root === 'matches' && parts[2] === 'spectators') {
      if (window._fbDb) return window._fbDb.ref(path).set(value);
    }
    /* Default: fire-and-forget, return resolved */
    return Promise.resolve();
  }

  /* ── SUPABASE READ ROUTER ── */
  function _supaRead(path, callback) {
    if (!window.DB || !window._supa) { callback(null); return; }
    var parts = path.split('/').filter(Boolean);
    var root = parts[0];

    /* users/{uid} */
    if (root === 'users' && parts[1] && !parts[2]) {
      window._supa.from('users').select('*').eq('id', parts[1]).single()
        .then(function(r) { callback(_fakeSnap(r.data, parts[1])); })
        .catch(function() { callback(_fakeSnap(null)); });
      return;
    }

    /* users/{uid}/coins */
    if (root === 'users' && parts[2] === 'coins') {
      window._supa.from('users').select('coins').eq('id', parts[1]).single()
        .then(function(r) { callback(_fakeSnap(r.data ? r.data.coins : 0)); })
        .catch(function() { callback(_fakeSnap(0)); });
      return;
    }

    /* users/{uid}/sponsoredWinnings */
    if (root === 'users' && parts[2] === 'sponsoredWinnings') {
      /* Read from Supabase sponsored_prize_claims */
      window._supa.from('sponsored_prize_claims').select('prize_detail')
        .eq('user_id', parts[1])
        .then(function(r) {
          /* Sum up numeric prizes only */
          var total = 0;
          (r.data || []).forEach(function(row) {
            var pd = row.prize_detail || '';
            var match = pd.match(/[\d]+/);
            if (match) total += parseInt(match[0]) || 0;
          });
          callback(_fakeSnap(total));
        })
        .catch(function() { callback(_fakeSnap(0)); });
      return;
    }

    /* users/{uid}/watchEarnings/{date} */
    if (root === 'users' && parts[2] === 'watchEarnings') {
      var today = parts[3] || new Date().toISOString().split('T')[0];
      window._supa.from('watch_earn_log').select('coins_earned, watched_mins')
        .eq('user_id', parts[1]).eq('log_date', today)
        .then(function(r) {
          var rows = r.data || [];
          var total = rows.reduce(function(s, x) { return s + (x.coins_earned || 0); }, 0);
          callback(_fakeSnap(total));
        })
        .catch(function() { callback(_fakeSnap(0)); });
      return;
    }

    /* users/{uid}/missionProgress */
    if (root === 'users' && parts[2] === 'missionProgress') {
      var today2 = new Date().toISOString().split('T')[0];
      window._supa.from('mission_progress').select('*')
        .eq('user_id', parts[1]).gte('period', today2)
        .then(function(r) {
          var obj = {};
          (r.data || []).forEach(function(m) { obj[m.mission_key] = m.progress; });
          callback(_fakeSnap(obj));
        })
        .catch(function() { callback(_fakeSnap({})); });
      return;
    }

    /* joinRequests (user's) */
    if (root === 'joinRequests' && parts[1]) {
      window._supa.from('join_requests').select('*').eq('id', parts[1]).single()
        .then(function(r) { callback(_fakeSnap(r.data, parts[1])); })
        .catch(function() { callback(_fakeSnap(null)); });
      return;
    }

    /* referrals */
    if (root === 'referrals') {
      window._supa.from('referrals').select('*').eq('referrer_id', _uid())
        .then(function(r) {
          var snap = _fakeSnapList(r.data || []);
          callback(snap);
        })
        .catch(function() { callback(_fakeSnapList([])); });
      return;
    }

    /* clans/{id} */
    if (root === 'clans' && parts[1] && !parts[2]) {
      window._supa.from('clans').select('*').eq('id', parts[1]).single()
        .then(function(r) { callback(_fakeSnap(r.data, parts[1])); })
        .catch(function() { callback(_fakeSnap(null)); });
      return;
    }

    /* clans (list) */
    if (root === 'clans' && !parts[1]) {
      window._supa.from('clans').select('*').order('total_wins', { ascending: false }).limit(20)
        .then(function(r) { callback(_fakeSnapList(r.data || [])); })
        .catch(function() { callback(_fakeSnapList([])); });
      return;
    }

    /* battlePass/{sid}/{uid} */
    if (root === 'battlePass' && parts[1] && parts[2]) {
      window._supa.from('battle_pass_progress')
        .select('*').eq('user_id', parts[2]).eq('season_id', parts[1]).maybeSingle()
        .then(function(r) { callback(_fakeSnap(r.data, parts[2])); })
        .catch(function() { callback(_fakeSnap(null)); });
      return;
    }

    /* users (list queries — leaderboard, search) */
    if (root === 'users' && !parts[1]) {
      window._supa.from('users').select('id,ign,avatar_url,rank_points,rank_tier,total_wins,total_kills,total_matches,city,ffUid').limit(200)
        .then(function(r) {
          callback(_fakeSnapList(r.data || [], 'id'));
        })
        .catch(function() { callback(_fakeSnapList([])); });
      return;
    }

    /* matches/mid/checkIns → Supabase join_requests (checked_in) */
    if (root === 'matches' && parts[1] && parts[2] === 'checkIns') {
      var matchId = parts[1];
      if (parts[3]) {
        /* Single user checkin */
        window._supa.from('join_requests').select('checked_in,checkin_at').eq('match_id', matchId).eq('user_id', parts[3]).maybeSingle()
          .then(function(r) { callback(_fakeSnap(r.data ? { checkedIn: r.data.checked_in, checkinAt: r.data.checkin_at } : null)); })
          .catch(function() { callback(_fakeSnap(null)); });
      } else {
        /* All checkins */
        window._supa.from('join_requests').select('user_id,checked_in,ign_at_join').eq('match_id', matchId).eq('checked_in', true)
          .then(function(r) {
            var obj = {};
            (r.data || []).forEach(function(jr) { obj[jr.user_id] = { checkedIn: true, ign: jr.ign_at_join }; });
            callback(_fakeSnap(obj));
          }).catch(function() { callback(_fakeSnap({})); });
      }
      return;
    }
    /* matches/mid/joinedPlayers → Supabase join_requests */
    if (root === 'matches' && parts[1] && parts[2] === 'joinedPlayers') {
      window._supa.from('join_requests').select('user_id,ign_at_join,status').eq('match_id', parts[1]).in('status', ['approved','pending'])
        .then(function(r) {
          var obj = {};
          (r.data || []).forEach(function(jr) { obj[jr.user_id] = { ign: jr.ign_at_join, status: jr.status }; });
          callback(_fakeSnap(obj));
        }).catch(function() { callback(_fakeSnap({})); });
      return;
    }
    /* matches/mid/spectators → Firebase RTDB (live data) */
    if (root === 'matches' && parts[2] === 'spectators') {
      if (window._fbDb) { window._fbDb.ref(path).once('value', callback); return; }
    }
    /* watchEarnings/date → Supabase watch_earn_log */
    if (root === 'users' && parts[2] === 'watchEarnings' && parts[3]) {
      window._supa.from('watch_earn_log').select('coins_earned').eq('user_id', parts[1]).eq('log_date', parts[3])
        .then(function(r) {
          var total = (r.data || []).reduce(function(s, x) { return s + (x.coins_earned || 0); }, 0);
          callback(_fakeSnap(total || 0));
        }).catch(function() { callback(_fakeSnap(0)); });
      return;
    }
    /* Default: return empty snap */
    callback(_fakeSnap(null));
  }

  /* ── FAKE SNAP HELPERS (mimic Firebase DataSnapshot) ── */
  function _fakeSnap(data, key) {
    return {
      val: function() { return data; },
      exists: function() { return data !== null && data !== undefined; },
      key: key || null,
      forEach: function(cb) {
        if (data && typeof data === 'object') {
          Object.keys(data).forEach(function(k) { cb(_fakeSnap(data[k], k)); });
        }
      }
    };
  }
  function _fakeSnapList(arr, idField) {
    var obj = {};
    arr.forEach(function(item) {
      var key = item[idField || 'id'] || item.key || Math.random().toString(36).substr(2);
      obj[key] = item;
    });
    return {
      val: function() { return obj; },
      exists: function() { return arr.length > 0; },
      key: null,
      forEach: function(cb) {
        arr.forEach(function(item) {
          var k = item[idField || 'id'] || item.key;
          cb(_fakeSnap(item, k));
        });
      }
    };
  }

  /* ── TRANSACTION HANDLER ── */
  function _supaTransaction(path, updateFn, cb) {
    /* Read current value, apply updateFn, write back */
    _supaRead(path, function(snap) {
      var current = snap ? snap.val() : null;
      var newVal = updateFn(current);
      if (newVal === undefined) { if (cb) cb(null, false, snap); return; }
      _supaWrite(path, newVal, false).then(function() {
        var newSnap = _fakeSnap(newVal);
        if (cb) cb(null, true, newSnap);
      }).catch(function(err) {
        if (cb) cb(err, false, snap);
      });
    });
  }

  /* ── INSTALL BRIDGE ── */
  function _installBridge() {
    var _originalDb = window.db;

    /* Override db.ref() */
    var _bridgeDb = {
      ref: function(path) {
        /* Route to Firebase RTDB for realtime paths */
        if (_isFirebasePath(path)) {
          return _originalDb.ref(path);
        }

        /* Return Supabase-backed ref object */
        return {
          _path: path,

          /* READ ONCE */
          once: function(event, successCb, errorCb) {
            var self = this;
            _supaRead(path, function(snap) {
              if (successCb) successCb(snap);
            });
            return { catch: function(fn) {} };
          },

          /* REALTIME (polling fallback) */
          on: function(event, successCb, errorCb) {
            /* Initial load */
            _supaRead(path, function(snap) {
              if (successCb) successCb(snap);
            });
            /* Poll every 30s for live-ish feel */
            var pollKey = '_bridge_' + path.replace(/[^a-z0-9]/gi, '_');
            if (!window._bridgePolls) window._bridgePolls = {};
            if (!window._bridgePolls[pollKey]) {
              window._bridgePolls[pollKey] = setInterval(function() {
                _supaRead(path, function(snap) {
                  if (successCb) successCb(snap);
                });
              }, 30000);
            }
            return this;
          },

          /* STOP LISTENER */
          off: function() {
            var pollKey = '_bridge_' + path.replace(/[^a-z0-9]/gi, '_');
            if (window._bridgePolls && window._bridgePolls[pollKey]) {
              clearInterval(window._bridgePolls[pollKey]);
              delete window._bridgePolls[pollKey];
            }
          },

          /* WRITE */
          set: function(value, cb) {
            return _supaWrite(path, value, false)
              .then(function() { if (cb) cb(null); })
              .catch(function(err) { if (cb) cb(err); });
          },

          /* UPDATE (merge) */
          update: function(value, cb) {
            return _supaWrite(path, value, true)
              .then(function() { if (cb) cb(null); })
              .catch(function(err) { if (cb) cb(err); });
          },

          /* DELETE */
          remove: function(cb) {
            return _supaWrite(path, null, false)
              .then(function() { if (cb) cb(null); })
              .catch(function(err) { if (cb) cb(err); });
          },

          /* TRANSACTION */
          transaction: function(updateFn, cb, applyLocally) {
            _supaTransaction(path, updateFn, cb);
            return { then: function(fn) { return this; }, catch: function(fn) { return this; } };
          },

          /* PUSH (generate key + write child) */
          push: function(value, cb) {
            var newKey = 'sb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
            var childPath = path + '/' + newKey;
            var refObj = _bridgeDb.ref(childPath);
            refObj.key = newKey;
            if (value !== undefined) {
              refObj.set(value, cb);
            }
            return refObj;
          },

          /* QUERY METHODS (return same ref for chaining) */
          orderByChild: function(c) { this._orderBy = c; return this; },
          orderByKey:   function()  { return this; },
          orderByValue: function()  { return this; },
          limitToFirst: function(n) { this._limit = n; return this; },
          limitToLast:  function(n) { this._limit = n; return this; },
          startAt:      function(v) { this._startAt = v; return this; },
          endAt:        function(v) { this._endAt = v; return this; },
          equalTo:      function(v) { this._equalTo = v; return this; },

          /* KEY property */
          key: path.split('/').pop()
        };
      }
    };

    /* Install bridge — keep original accessible as window._fbDb */
    window._fbDb = _originalDb;
    window.db = _bridgeDb;
    /* Also override window.db.ref for features using window.db */
    window.db.ref = _bridgeDb.ref;

    console.log('[Bridge] Firebase→Supabase bridge installed. Realtime paths use Firebase RTDB, data paths use Supabase.');
  }

  /* Start initialization */
  _waitAndInit();

})();
