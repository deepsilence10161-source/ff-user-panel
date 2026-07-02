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
    /* Defense-in-depth: ref() now handles the undefined/null root-path case
       before calling this, but guard here too in case of any other caller. */
    if (!path) return false;
    /* Migration v3.0: These stay on Firebase RTDB */
    var root = path.split('/')[0];
    var rtRoots = [
      '.info',             /* Firebase RTDB special path (serverTimeOffset etc) — Bug C-1 Fix */
      'support',           /* Support chat messages */
      'supportTyping',     /* Support typing indicators */
      'supportRequests',   /* Support ticket submissions */
      'appSettings',       /* Admin live config + adminResponseStats */
      'admins',            /* Admin user list */
      'presence',          /* Online presence */
      /* liveStreams MOVED TO SUPABASE — Bug #4 Fix */
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
      /* Issue #6 Fix: users/{uid}/premium — sync subscription tier to Supabase */
      if (field === 'premium' && typeof value === 'object' && value !== null) {
        return window._supa.from('users').update({
          premium_level:   value.tier    || 0,
          premium_expires: value.expiresAt ? new Date(value.expiresAt).toISOString() : null
        }).eq('id', targetUid);
      }
      if (field === 'premium_level' || field === 'premiumLevel') {
        return window._supa.from('users').update({ premium_level: Number(value) || 0 }).eq('id', targetUid);
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
      /* Bug #8 Fix: User preferences that were being lost */
      if (field === 'avatarBgColor') {
        return window._supa.from('users').update({ avatar_bg_color: value || null }).eq('id', targetUid).catch(function(){});
      }
      if (field === 'bio') {
        return window._supa.from('users').update({ bio: value || null }).eq('id', targetUid).catch(function(){});
      }
      if (field === 'isLive') {
        return window._supa.from('users').update({ is_live: Boolean(value) }).eq('id', targetUid).catch(function(){});
      }
      if (field === 'streamLink') {
        return window._supa.from('users').update({ stream_link: value || null }).eq('id', targetUid).catch(function(){});
      }
      if (field === 'rival') {
        return window._supa.from('users').update({ rival_uid: value || null }).eq('id', targetUid).catch(function(){});
      }
      if (field === 'selfExcluded' || field === 'selfExcludedTill') {
        /* selfExcluded INTENTIONALLY stays on Firebase (security-patches.js reads from there) */
        if (window._fbDb) window._fbDb.ref(path).set(value);
        return Promise.resolve();
      }
      /* Bug #5 Fix: watchEarnings write → watch_earn_log */
      if (field === 'watchEarnings' && parts[3] && typeof value === 'object') {
        return window._supa.from('watch_earn_log').upsert({
          user_id: targetUid,
          log_date: new Date().toISOString().split('T')[0],
          coins_earned: value.totalCoins || 0,
          watched_mins: value.totalMins || 0
        }, { onConflict: 'user_id,log_date' }).catch(function(){});
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
          slot_number: value.slotNumber || null,
          captain_uid: value.captainUid || null,
          fee_type: value.feeType || 'solo',
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
      /* Bug C-4 supplement: also save sender_ign for display */
      return window._supa.from('clan_messages').insert({
        clan_id: parts[1],
        sender_id: _uid() || value.senderId,
        sender_ign: value.ign || value.senderIgn || (window.UD && window.UD.ign) || '',
        message: value.text || value.message || ''
      }).catch(function(e){ console.warn('[Bridge] clan_messages insert error:', e.message); });
    }

    /* creatorStats/{uid}/... */
    /* Bug M-4 Fix: Write actual stats, not just creator_code */
    if (root === 'creatorStats' && parts[1]) {
      var creatorUid = parts[1];
      var statKey = parts[2]; /* e.g. 'totalEarnings', 'referralCount' */
      var updateObj = { user_id: creatorUid };

      if (!statKey && typeof value === 'object' && value !== null) {
        /* Full stats object */
        if (value.totalEarnings  !== undefined) updateObj.total_earnings   = Number(value.totalEarnings)  || 0;
        if (value.referralCount  !== undefined) updateObj.referral_count   = Number(value.referralCount)  || 0;
        if (value.activeReferrals!== undefined) updateObj.active_referrals = Number(value.activeReferrals)|| 0;
        if (value.creatorCode)   updateObj.creator_code   = value.creatorCode;
        if (value.status)        updateObj.status         = value.status;
        if (value.commission)    updateObj.commission_rate= Number(value.commission) || 0;
      } else if (statKey === 'totalEarnings'  || statKey === 'total_earnings')  {
        updateObj.total_earnings   = Number(value) || 0;
      } else if (statKey === 'referralCount'  || statKey === 'referral_count')  {
        updateObj.referral_count   = Number(value) || 0;
      } else if (statKey === 'activeReferrals'|| statKey === 'active_referrals'){
        updateObj.active_referrals = Number(value) || 0;
      } else if (statKey === 'creatorCode'    || statKey === 'creator_code')    {
        updateObj.creator_code     = value || '';
      } else if (statKey === 'status') {
        updateObj.status           = value || 'pending';
      } else {
        /* Unknown subkey — still save as generic upsert */
        updateObj.creator_code = creatorUid; /* fallback */
      }

      return window._supa.from('creator_applications')
        .upsert(updateObj, { onConflict: 'user_id' })
        .catch(function(){});
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
    /* matchResults/{matchId}/{uid} → Supabase match_results */
    if (root === 'matchResults' && parts[1] && typeof value === 'object' && value !== null) {
      return window._supa.from('match_results').upsert({
        match_id: parts[1],
        user_id: parts[2] || value.userId || _uid(),
        placement: value.placement || value.rank || null,
        kills: value.kills || 0,
        prize: value.prize || value.prizeAmount || 0,
        created_at: new Date().toISOString()
      }, { onConflict: 'match_id,user_id' });
    }
    /* matchFeedback, matchInterest, profileViews, killProofs → soft analytics, silently succeed */
    if (root === 'matchFeedback' || root === 'matchInterest' ||
        root === 'profileViews' || root === 'killProofs' ||
        root === 'partnerRatings') {
      return Promise.resolve();
    }

    /* Bug #2 Fix: premiumRequests → premium_requests table */
    if (root === 'premiumRequests' && parts[1] && typeof value === 'object') {
      return window._supa.from('premium_requests').upsert({
        id: parts[1],
        user_id: value.uid || _uid(),
        user_name: value.userName || '',
        tier: value.tier || 1,
        price: value.price || 49,
        screenshot_url: value.screenshotBase64 || value.screenshotUrl || null,
        status: value.status || 'pending',
        created_at: new Date().toISOString()
      }, { onConflict: 'id' }).catch(function(e) {
        /* Fallback: table may not exist yet — store in notifications table as admin alert */
        console.warn('[Bridge] premium_requests table missing, using fallback:', e.message);
        return window._supa.from('notifications').insert({
          user_id: value.uid || _uid(), type: 'premium_request',
          title: '💳 Premium Request #' + parts[1],
          body: 'Tier ' + (value.tier||1) + ' (₹' + (value.price||49) + ') — Screenshot: ' + (value.screenshotBase64?'Attached':'None'),
          is_read: false
        }).catch(function(){});
      });
    }

    /* Bug #3 Fix: creatorCodes/{code} → creator_applications */
    if (root === 'creatorCodes' && parts[1] && typeof value === 'object') {
      return window._supa.from('creator_applications')
        .update({ creator_code: parts[1] })
        .eq('user_id', value.uid || _uid())
        .catch(function(){});
    }

    /* Bug #4 Fix: liveStreams → Supabase live_streams table */
    if (root === 'liveStreams' && parts[1]) {
      if (value === null) {
        return window._supa.from('live_streams').delete().eq('id', parts[1]).catch(function(){});
      }
      if (typeof value === 'object') {
        return window._supa.from('live_streams').upsert({
          id: parts[1],
          match_id: value.matchId || null,
          user_id: value.uid || _uid(),
          stream_link: value.streamLink || value.youtubeLink || '',
          title: value.title || '',
          is_live: value.isLive !== false,
          viewer_count: value.viewerCount || 0,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' }).catch(function(e) {
          /* Fallback: store in app_settings as JSONB if live_streams table missing */
          console.warn('[Bridge] live_streams table missing:', e.message);
        });
      }
    }

    /* Bug #6 Fix: adminAlerts → admin_activity_log */
    if (root === 'adminAlerts' && typeof value === 'object') {
      return window._supa.from('admin_activity_log').insert({
        action_type: value.type || 'anti_cheat_alert',
        note: value.message || value.reason || JSON.stringify(value).substring(0, 500),
        target_user_id: value.uid || null,
        created_at: new Date().toISOString()
      }).catch(function(){});
    }

    /* Bug #20 Fix: polls → in-session only, write to Supabase polls table if it exists */
    if (root === 'polls') {
      /* Bug #20 Fix: Write poll votes to Supabase poll_votes table */
      if (parts[1] && parts[2] === 'votes' && parts[3]) {
        var pPollId = parts[1];
        var pVoterUid = parts[3];
        var pOptIdx = (value && value.optionIdx !== undefined) ? Number(value.optionIdx) : Number(value||0);
        return window._supa.from('poll_votes').upsert({
          poll_id: pPollId, user_id: pVoterUid||_uid(), option_idx: pOptIdx
        }, { onConflict: 'poll_id,user_id' }).catch(function(){});
      }
      return Promise.resolve();
    }

    /* Default: fire-and-forget, return resolved */
    return Promise.resolve();
  }

  /* ── SUPABASE READ ROUTER ── */
  /* Bug 21 Fix: Added opts parameter to support limitToFirst/Last from bridge ref queries */
  function _supaRead(path, callback, opts) {
    opts = opts || {};
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
    /* Bug 21 Fix: limitToFirst/Last now honored via opts.limit */
    if (root === 'users' && !parts[1]) {
      var _lim = opts.limit || 100; /* default 100 not 200 for leaderboard performance */
      window._supa.from('users').select('id,ign,avatar_url,rank_points,rank_tier,total_wins,total_kills,total_matches,city,ffUid')
        .order('rank_points', { ascending: false })
        .limit(_lim)
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
    /* matchResults/{matchId} → Supabase match_results */
    if (root === 'matchResults' && parts[1]) {
      window._supa.from('match_results').select('*').eq('match_id', parts[1])
        .then(function(r) {
          var obj = {};
          (r.data || []).forEach(function(row) { obj[row.user_id] = row; });
          callback(_fakeSnap(Object.keys(obj).length ? obj : null));
        })
        .catch(function() { callback(_fakeSnap(null)); });
      return;
    }

    /* results (recent results list) → Supabase match_results */
    if (root === 'results') {
      window._supa.from('match_results').select('*,matches(name,matchTime)').order('created_at', { ascending: false }).limit(10)
        .then(function(r) { callback(_fakeSnapList(r.data || [])); })
        .catch(function() { callback(_fakeSnapList([])); });
      return;
    }

    /* Bug #28 Fix: users/{uid}/coinHistory → wallet_transactions */
    if (root === 'users' && parts[2] === 'coinHistory') {
      window._supa.from('wallet_transactions').select('amount,txn_type,reason,created_at')
        .eq('user_id', parts[1]).eq('currency', 'coins')
        .order('created_at', { ascending: false }).limit(20)
        .then(function(r) {
          var obj = {};
          (r.data || []).forEach(function(t, i) {
            obj['txn_' + i] = {
              amount: t.txn_type === 'credit' ? (t.amount||0) : -(t.amount||0),
              reason: t.reason || '', timestamp: new Date(t.created_at).getTime()
            };
          });
          callback(_fakeSnap(Object.keys(obj).length ? obj : null));
        }).catch(function() { callback(_fakeSnap(null)); });
      return;
    }

    /* Bug #4 Fix: liveStreams → Supabase live_streams */
    if (root === 'liveStreams') {
      if (parts[1]) {
        window._supa.from('live_streams').select('*').eq('id', parts[1]).maybeSingle()
          .then(function(r) { callback(_fakeSnap(r.data, parts[1])); })
          .catch(function() { callback(_fakeSnap(null)); });
      } else {
        window._supa.from('live_streams').select('*').eq('is_live', true).limit(20)
          .then(function(r) { callback(_fakeSnapList(r.data || [])); })
          .catch(function() { callback(_fakeSnapList([])); });
      }
      return;
    }

    /* matchFeedback — soft analytics, can silently no-op on read */
    if (root === 'matchFeedback') { callback(_fakeSnap(null)); return; }

    /* matchInterest — soft feature, can silently no-op on read */
    if (root === 'matchInterest') { callback(_fakeSnapList([])); return; }

    /* profileViews — soft analytics */
    if (root === 'profileViews') { callback(_fakeSnap(null)); return; }

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
        /* RPC/write failed — show toast + attempt Firebase RTDB fallback */
        _handleRpcError(path, newVal, err);
        if (cb) cb(err, false, snap);
      });
    });
  }

  /* ── RPC ERROR HANDLER — silent failure ko visible banana ── */
  function _handleRpcError(path, value, err) {
    var msg = (err && err.message) || 'Unknown error';
    var isRpcMissing = msg.indexOf('Could not find the function') !== -1 ||
                       msg.indexOf('function') !== -1 ||
                       msg.indexOf('404') !== -1;

    if (isRpcMissing) {
      /* RPC function missing in Supabase — show admin warning */
      console.error('[Bridge] ❌ Supabase RPC missing! Run SUPABASE_SQL_SETUP.sql in Supabase Dashboard. Path:', path);
      /* Show toast only once per session */
      if (!window._rpcWarnShown) {
        window._rpcWarnShown = true;
        if (window.toast) window.toast('⚠️ Balance update mein error — Admin se contact karo', 'err');
      }
    } else {
      console.error('[Bridge] Supabase write error for path:', path, '—', msg);
    }

    /* Firebase RTDB fallback for financial paths — only if _fbDb available */
    /* (Allowed paths: users/{uid}/coins, users/{uid}/realMoney etc go through RTDB as last resort) */
    if (window._fbDb && path && value !== undefined) {
      var root = path.split('/')[0];
      /* Only fallback for financial/user paths that Firebase can handle */
      var fbFallbackPaths = ['users', 'joinRequests', 'walletRequests'];
      if (fbFallbackPaths.indexOf(root) !== -1) {
        console.warn('[Bridge] Attempting Firebase RTDB fallback for:', path);
        try {
          window._fbDb.ref(path).set(value);
        } catch(fbErr) {
          console.error('[Bridge] Firebase fallback also failed:', fbErr.message);
        }
      }
    }
  }

  /* ── INSTALL BRIDGE ── */
  function _installBridge() {
    var _originalDb = window.db;

    /* Override db.ref() */
    var _bridgeDb = {
      ref: function(path) {
        /* ✅ AUDIT FIX (critical): db.ref() with NO path argument is used in
           3 places (clan.js, spectator.js, fixes-v7.js) for Firebase-style
           atomic multi-path updates: db.ref().update({'clans/x/y': a,
           'users/uid/clanId': b, ...}). Two problems existed here:
           1. _isFirebasePath(path) crashed immediately on undefined path
              ("Cannot read properties of undefined (reading 'split')").
           2. Even if that crash were avoided by routing root-level calls to
              real Firebase, every single key actually used in these 3
              callers (clans/*, users/*, liveStreams/*, polls/*) has
              already been migrated to Supabase — routing the whole object
              to Firebase would make joinClan/spectator-toggle/pollVote
              silently "succeed" (toast shows OK) while writing to a dead
              Firebase location nothing reads from anymore. That's worse
              than a visible crash.
           Fix: split the multi-path object key-by-key, route each key
           through the exact same per-path logic every other single-path
           call already uses (_isFirebasePath + _supaWrite), batch the
           Firebase-bound subset into one real multi-path Firebase update
           (preserving atomicity for whichever keys are genuinely
           Firebase-only), and fire the Supabase-bound ones individually. */
        if (path === undefined || path === null) {
          return {
            _path: undefined,
            update: function(value, cb) {
              var fbUpdates = {}, hasFb = false, ops = [];
              Object.keys(value || {}).forEach(function(key) {
                if (_isFirebasePath(key)) {
                  fbUpdates[key] = value[key];
                  hasFb = true;
                } else {
                  ops.push(_supaWrite(key, value[key], true));
                }
              });
              if (hasFb) ops.push(_originalDb.ref().update(fbUpdates));
              Promise.all(ops)
                .then(function() { if (cb) cb(null); })
                .catch(function(err) { if (cb) cb(err); });
            },
            set: function(value, cb) {
              if (cb) cb(new Error('Root .set() not supported — use .update() with full paths as keys'));
            }
          };
        }
        /* Route to Firebase RTDB for realtime paths */
        if (_isFirebasePath(path)) {
          return _originalDb.ref(path);
        }

        /* Return Supabase-backed ref object */
        return {
          _path: path,

          /* READ ONCE */
          /* Bug 21 Fix: Pass _limit from limitToFirst/limitToLast calls */
          once: function(event, successCb, errorCb) {
            var self = this;
            var opts = {};
            if (self._limit) opts.limit = self._limit;
            _supaRead(path, function(snap) {
              if (successCb) successCb(snap);
            }, opts);
            return { catch: function(fn) {} };
          },

          /* REALTIME (polling fallback) */
          on: function(event, successCb, errorCb) {
            /* Bug 21 Fix: Pass _limit from ref to initial read */
            var self = this;
            var opts = {};
            if (self._limit) opts.limit = self._limit;
            /* Initial load */
            _supaRead(path, function(snap) {
              if (successCb) successCb(snap);
            }, opts);
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

          /* STOP LISTENER — Bug M-11 Fix: properly clear interval AND delete key */
          off: function() {
            var pollKey = '_bridge_' + path.replace(/[^a-z0-9]/gi, '_');
            if (window._bridgePolls && window._bridgePolls[pollKey]) {
              clearInterval(window._bridgePolls[pollKey]);
              window._bridgePolls[pollKey] = null;
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

  /* Issue #35 Fix: Firebase uses epoch ms (Number), Supabase expects ISO 8601.
     Always pass timestamps through this before inserting into Supabase. */
  window._toSupaTimestamp = function(ts) {
    if (!ts) return new Date().toISOString();
    var num = Number(ts);
    if (!isNaN(num) && num > 1000000000000) {
      return new Date(num).toISOString(); // Firebase ms epoch → ISO
    }
    if (typeof ts === 'string' && ts.includes('T')) return ts; // already ISO
    return new Date().toISOString(); // fallback
  };

})();
