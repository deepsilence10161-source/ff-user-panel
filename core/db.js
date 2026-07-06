/* ================================================================
   BACKEND ABSTRACTION LAYER — core/db.js
   MiniESports v1.0 | May 2026

   YEH FILE KYU HAI:
   — Supabase ka code sirf is ek file mein hai
   — Kal Supabase se kisi aur backend pe jaana ho to
     sirf is ek file ko rewrite karo
   — Baaki KOI file nahi badle

   ARCHITECTURE:
   — window.DB = abstraction layer (sab screens yahi use karein)
   — window._supa = raw Supabase client (emergency mein)
   — Firebase RTDB = sirf realtime listeners (window.db)
   — Firebase Analytics + Crashlytics = alag file

   USAGE EXAMPLE (kisi bhi screen mein):
     var matches = await DB.matches.getUpcoming();
     var user    = await DB.users.getMe();
     await DB.wallet.credit(uid, 'coins', 50, 'mission_reward');
================================================================ */

(function() {
  'use strict';

  /* ── 1. SUPABASE CLIENT ── */
  /* Replace these with your actual Supabase project values */
  var SUPA_URL = window._SUPA_URL || 'https://hddhkculuyrfoevxmlwy.supabase.co';
  var SUPA_KEY = window._SUPA_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhkZGhrY3VsdXlyZm9ldnhtbHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg0NTQ1MTgsImV4cCI6MjA5NDAzMDUxOH0.2hhDGez1fVFjS5ljSU3tSOEJuusLmQpERjcrh45T7po';

  /* Wait for Supabase SDK to load */
  function _initClient() {
    if (window.supabase && window.supabase.createClient) {
      window._supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
      console.log('[DB] Supabase client ready');
      window._supaReady = true;
      if (window._supaReadyCbs) {
        window._supaReadyCbs.forEach(function(fn) { try { fn(); } catch(e) {} });
        window._supaReadyCbs = [];
      }
    } else {
      setTimeout(_initClient, 200);
    }
  }
  _initClient();

  function onSupaReady(fn) {
    if (window._supaReady) { fn(); return; }
    window._supaReadyCbs = window._supaReadyCbs || [];
    window._supaReadyCbs.push(fn);
  }

  /* ── 2. HELPER: current user id ── */
  function _uid() {
    /* Supabase Auth user */
    if (window._supa) {
      var session = window._supa.auth.session ? window._supa.auth.session() : null;
      if (session && session.user) return session.user.id;
    }
    /* Fallback: window.U (set by auth.js) */
    return window.U ? window.U.uid : null;
  }

  /* ── 3. POLLING HELPER (replaces Firebase realtime for non-critical data) ── */
  var _polls = {};
  function _poll(key, fn, intervalMs) {
    if (_polls[key]) clearInterval(_polls[key]);
    fn(); /* run immediately */
    _polls[key] = setInterval(fn, intervalMs || 30000);
  }
  function _stopPoll(key) {
    if (_polls[key]) { clearInterval(_polls[key]); delete _polls[key]; }
  }

  /* ── 4. ERROR HANDLER ── */
  function _err(context, error) {
    console.error('[DB:' + context + ']', error);
    if (window.toast) toast('Network error — refresh karo', 'err');
    return null;
  }

  /* ================================================================
     DB NAMESPACE — sab public methods yahan
  ================================================================ */
  window.DB = {

    /* ────────────────────────────────────────
       AUTH
    ──────────────────────────────────────── */
    auth: {

      /* ─────────────────────────────────────────────────────────────
         syncFirebaseToken — MAIN AUTH METHOD (called by auth.js)
         
         Firebase Third-Party Auth setup in Supabase:
           Dashboard → Authentication → Third-Party Auth → Firebase ✅
           Project ID: fft-app-1e283
         
         HOW IT WORKS:
           1. Get fresh Firebase ID token (JWT signed by Firebase)
           2. Recreate Supabase client with token as Authorization header
           3. Supabase validates JWT via Firebase JWKS endpoint
           4. auth.uid() in PostgreSQL = Firebase UID → RLS works ✅
         
         WHY NOT signInWithIdToken({ provider:'firebase' }) ?
           That API is for OIDC OAuth flows (Google native sign-in).
           For Third-Party Auth the correct method is Bearer header.
      ───────────────────────────────────────────────────────────── */
      syncFirebaseToken: async function(firebaseUser) {
        try {
          var token = await firebaseUser.getIdToken(/* forceRefresh */ true);

          /* Bug C-3 Fix: Cleanup old Realtime channels BEFORE recreating _supa client.
             Old channels are bound to the old _supa object. If we just replace _supa,
             those channels become orphaned — they stop receiving updates after ~1 hour.
             Fix: explicitly remove all channels first, then re-subscribe after new client. */
          try {
            if (window._cleanupChannels) {
              window._cleanupChannels();
              console.log('[DB] Cleaned up old Realtime channels before token refresh');
            }
          } catch(chErr) {
            console.warn('[DB] Channel cleanup warning (non-fatal):', chErr.message);
          }

          /* Recreate Supabase client with Firebase token as Bearer */
          window._supa = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
            auth: {
              persistSession:     false,
              autoRefreshToken:   false,
              detectSessionInUrl: false
            },
            global: {
              headers: { Authorization: 'Bearer ' + token }
            }
          });
          window._supaReady = true;
          /* Store token expiry for proactive refresh (Firebase tokens = 1hr) */
          window._supaTokenUid = firebaseUser.uid;
          console.log('[DB] Supabase ← Firebase JWT synced ✅ uid:', firebaseUser.uid.substring(0,8) + '...');

          /* Bug C-3 Fix: Re-subscribe Realtime channels on new _supa client.
             Also re-register the token refresh guard on the new client. */
          setTimeout(function() {
            try {
              /* Re-register token refresh guard on new _supa */
              /* Reset the handler so _setupTokenRefreshGuard re-registers on new _supa client */
              window._tokenRefreshHandler = null;
              if (window._setupTokenRefreshGuard) window._setupTokenRefreshGuard();
              /* Re-run channel setup */
              if (window._bootChannelSetup) {
                window._bootChannelSetup();
                console.log('[DB] Realtime channels re-subscribed on new Supabase client ✅');
              }
            } catch(reSubErr) {
              console.warn('[DB] Channel re-subscribe warning:', reSubErr.message);
            }
          }, 800);

          return true;
        } catch(e) {
          console.warn('[DB] Firebase token sync failed (non-fatal):', e.message);
          /* App continues with anon Supabase client — limited functionality */
          return false;
        }
      },

      /* Logout — Firebase se sign out karo */
      logout: async function() {
        var firebaseAuth = window.auth || (window.firebase && window.firebase.auth());
        try { if (firebaseAuth) await firebaseAuth.signOut(); } catch(e) {}
        /* Reset Supabase client to anon */
        try {
          window._supa = window.supabase.createClient(SUPA_URL, SUPA_KEY);
          window._supaTokenUid = null;
        } catch(e) {}
        window.U = null; window.UD = null;
      },

      /* Get current session */
      getSession: async function() {
        var { data } = await window._supa.auth.getSession();
        return data ? data.session : null;
      },

      /* Listen to auth changes */
      onAuthChange: function(callback) {
        window._supa.auth.onAuthStateChange(function(event, session) {
          callback(event, session);
        });
      }
    },

    /* ────────────────────────────────────────
       USERS
    ──────────────────────────────────────── */
    users: {
      /* Get my own profile */
      getMe: async function() {
        var uid = _uid();
        if (!uid) return null;
        /* BUG FIX (2026-07): .single() THROWS when zero rows come back —
           which is exactly what happens for a genuinely new user. That
           error was being swallowed by _err() into the same `null` you'd
           get from a plain NETWORK failure. So any transient network
           hiccup on an EXISTING user's profile fetch looked identical to
           "this is a brand new user" to the caller (_doSupaLoad in
           boot.js) — which would then re-run DB.users.create() and
           unconditionally re-show the withdrawal-policy / welcome popups
           for a returning user. .maybeSingle() instead returns
           {data:null, error:null} for a genuine "no such row", so we can
           tell the two cases apart: null = genuinely new user (safe to
           create), undefined = couldn't check right now (do NOT treat as
           new). accepted_policy added to the select so the T&C/welcome
           flow (js/legal-compliance.js) can read real acceptance state
           instead of a Firebase-only field Supabase never populated. */
        var { data, error } = await window._supa
          .from('users')
          .select('id,ign,email,avatar_url,coins,sky_diamonds,green_diamonds,real_money,rank_tier,rank_points,total_wins,total_kills,total_matches,city,is_creator,is_premium,clan_id,referral_code,battle_pass_tier,profile_status,ban_status,accepted_policy,created_at')
          .eq('id', uid)
          .maybeSingle();
        if (error) { _err('users.getMe', error); return undefined; }
        return data; /* null here = genuinely no profile row yet (new user) */
      },

      /* Create profile after signup */
      create: async function(uid, profile) {
        /* Bug C-2 Fix: Use upsert to prevent duplicate user race condition */
        /* Two tabs logging in simultaneously both call create — upsert handles gracefully */
        var { data, error } = await window._supa
          .from('users')
          .upsert({ id: uid, ...profile }, { onConflict: 'id', ignoreDuplicates: true })
          .select()
          .single();
        if (error && error.code !== '23505') {
          /* Not a unique violation — try fetch existing */
          var existing = await window._supa.from('users').select('*').eq('id', uid).maybeSingle();
          if (existing.data) return existing.data;
          return _err('users.create', error);
        }
        return data;
      },

      /* Update own profile */
      update: async function(fields) {
        var uid = _uid();
        if (!uid) return null;
        var { data, error } = await window._supa
          .from('users')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', uid);
        if (error) {
          /* Bug #35/#63 Fix: Handle unique constraint violations gracefully */
          if (error.code === '23505') {
            if (error.message && error.message.indexOf('ign') >= 0) {
              if (window.toast) window.toast('⚠️ Yeh IGN already kisi aur ne liya hai! Dusra try karo.', 'err');
            } else if (error.message && error.message.indexOf('phone') >= 0) {
              if (window.toast) window.toast('⚠️ Yeh phone number already registered hai!', 'err');
            } else {
              if (window.toast) window.toast('⚠️ Duplicate entry — koi field already exist karta hai.', 'err');
            }
            return null;
          }
          return _err('users.update', error);
        }
        return data;
      },

      /* Get any user by ID */
      getById: async function(uid) {
        var { data, error } = await window._supa
          .from('users')
          .select('id,ign,avatar_url,rank_tier,rank_points,total_wins,total_kills,total_matches,city,is_creator,clan_id')
          .eq('id', uid)
          .single();
        if (error) return _err('users.getById', error);
        return data;
      },

      /* Admin: search users */
      search: async function(query) {
        var { data, error } = await window._supa
          .from('users')
          .select('*')
          .or('ign.ilike.%' + query + '%,email.ilike.%' + query + '%')
          .limit(20);
        if (error) return _err('users.search', error);
        return data || [];
      },

      /* Admin: ban/unban */
      setBan: async function(uid, isBanned, reason) {
        var { data, error } = await window._supa
          .from('users')
          .update({ is_banned: isBanned, ban_reason: reason || null })
          .eq('id', uid);
        if (error) return _err('users.setBan', error);
        return data;
      },

      /* Poll my profile every 30s (replaces Firebase listener) */
      pollMe: function(callback) {
        _poll('myProfile', async function() {
          var d = await DB.users.getMe();
          if (d) callback(d);
        }, 30000);
      },
      stopPollMe: function() { _stopPoll('myProfile'); }
    },

    /* ────────────────────────────────────────
       MATCHES
    ──────────────────────────────────────── */
    matches: {
      /* Get all upcoming + live matches */
      getUpcoming: async function() {
        var { data, error } = await window._supa
          .from('active_matches')   /* uses the view */
          .select('id,title,mode,status,game,scheduled_at,entry_fee,prize_pool,team_size,max_players,current_players,map,perspective,is_featured,match_type,banner_url')
          .order('scheduled_at', { ascending: true })
          .limit(50);              /* max 50 — home screen mein itne kaafi hain */
        if (error) return _err('matches.getUpcoming', error);
        return data || [];
      },

      /* Get single match */
      getById: async function(matchId) {
        var { data, error } = await window._supa
          .from('matches')
          .select('*')
          .eq('id', matchId)
          .single();
        if (error) return _err('matches.getById', error);
        return data;
      },

      /* Admin: create match */
      create: async function(matchData) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('matches')
          .insert({ ...matchData, created_by: uid })
          .select()
          .single();
        if (error) return _err('matches.create', error);
        return data;
      },

      /* Admin: update match */
      update: async function(matchId, fields) {
        var { data, error } = await window._supa
          .from('matches')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', matchId);
        if (error) return _err('matches.update', error);
        return data;
      },

      /* Admin: release room ID */
      releaseRoom: async function(matchId, roomId, roomPassword) {
        return DB.matches.update(matchId, {
          room_id: roomId,
          room_password: roomPassword,
          room_released_at: new Date().toISOString()
        });
      },

      /* Poll matches every 30s */
      poll: function(callback) {
        _poll('matches', async function() {
          var d = await DB.matches.getUpcoming();
          callback(d);
        }, 30000);
      },
      stopPoll: function() { _stopPoll('matches'); }
    },

    /* ────────────────────────────────────────
       JOIN REQUESTS
    ──────────────────────────────────────── */
    joinRequests: {
      /* Get my join requests */
      getMine: async function() {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('join_requests')
          .select('*, match:matches(title,scheduled_at,mode,status,room_id,room_password)')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });
        if (error) return _err('joinRequests.getMine', error);
        return data || [];
      },

      /* Check if user joined a specific match */
      check: async function(matchId) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('join_requests')
          .select('*')
          .eq('match_id', matchId)
          .eq('user_id', uid)
          .maybeSingle();
        if (error) return _err('joinRequests.check', error);
        return data;
      },

      /* Submit join request */
      create: async function(matchId, entryType, entryFee, extraData) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('join_requests')
          .insert({
            match_id: matchId,
            user_id: uid,
            entry_type: entryType,
            entry_fee_paid: entryFee,
            ign_at_join: window.UD ? window.UD.ign : '',
            ...extraData
          })
          .select()
          .single();
        if (error) return _err('joinRequests.create', error);
        return data;
      },

      /* Check in to match */
      checkIn: async function(joinRequestId) {
        var { data, error } = await window._supa
          .from('join_requests')
          .update({ checked_in: true, checkin_at: new Date().toISOString() })
          .eq('id', joinRequestId)
          .eq('user_id', _uid());
        if (error) return _err('joinRequests.checkIn', error);
        return data;
      },

      /* Confirm in room */
      confirmInRoom: async function(joinRequestId) {
        var { data, error } = await window._supa
          .from('join_requests')
          .update({ in_room: true })
          .eq('id', joinRequestId)
          .eq('user_id', _uid());
        if (error) return _err('joinRequests.confirmInRoom', error);
        return data;
      },

      /* Admin: get all for a match */
      getForMatch: async function(matchId) {
        var { data, error } = await window._supa
          .from('join_requests')
          .select('*, user:users(ign,avatar_url,rank_tier,coins,sky_diamonds)')
          .eq('match_id', matchId)
          .order('created_at', { ascending: true });
        if (error) return _err('joinRequests.getForMatch', error);
        return data || [];
      },

      /* Admin: approve/reject */
      setStatus: async function(id, status, note) {
        var { data, error } = await window._supa
          .from('join_requests')
          .update({ status: status, rejection_note: note || null })
          .eq('id', id);
        if (error) return _err('joinRequests.setStatus', error);
        return data;
      },

      /* Admin: set kills + placement (result) */
      setResult: async function(id, kills, placement, prizeEarned) {
        var { data, error } = await window._supa
          .from('join_requests')
          .update({ kills: kills, placement: placement, prize_earned: prizeEarned || 0 })
          .eq('id', id);
        if (error) return _err('joinRequests.setResult', error);
        return data;
      }
    },

    /* ────────────────────────────────────────
       WALLET
    ──────────────────────────────────────── */
    wallet: {
      /* Credit any currency */
      credit: async function(uid, currency, amount, reason, refId) {
        /* 1. Log transaction */
        await window._supa.from('wallet_transactions').insert({
          user_id: uid, currency: currency,
          txn_type: 'credit', amount: amount,
          reason: reason, ref_id: refId || null
        });
        /* 2. Increment in users table */
        var col = _currencyCol(currency);
        var { data, error } = await window._supa.rpc('increment_balance', {
          p_uid: uid, p_col: col, p_amount: amount
        });
        if (error) return _err('wallet.credit', error);
        return data;
      },

      /* Debit any currency */
      debit: async function(uid, currency, amount, reason, refId) {
        await window._supa.from('wallet_transactions').insert({
          user_id: uid, currency: currency,
          txn_type: 'debit', amount: amount,
          reason: reason, ref_id: refId || null
        });
        var col = _currencyCol(currency);
        var { data, error } = await window._supa.rpc('decrement_balance', {
          p_uid: uid, p_col: col, p_amount: amount
        });
        if (error) return _err('wallet.debit', error);
        return data;
      },

      /* Get my transactions */
      getHistory: async function(limit) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(limit || 50);
        if (error) return _err('wallet.getHistory', error);
        return data || [];
      },

      /* Submit SD purchase request */
      submitSdRequest: async function(amountInr, sdAmount, upiRef, screenshotUrl) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('sd_requests')
          .insert({
            user_id: uid,
            amount_inr: amountInr,
            sd_amount: sdAmount,
            upi_ref: upiRef,
            screenshot_url: screenshotUrl
          })
          .select()
          .single();
        if (error) return _err('wallet.submitSdRequest', error);
        return data;
      },

      /* Admin: get pending SD requests */
      getPendingSdRequests: async function() {
        var { data, error } = await window._supa
          .from('sd_requests')
          .select('*, user:users(ign,email,sky_diamonds)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });
        if (error) return _err('wallet.getPendingSdRequests', error);
        return data || [];
      },

      /* Admin: approve SD request */
      approveSdRequest: async function(requestId, userId, sdAmount) {
        /* 1. Update request status */
        await window._supa
          .from('sd_requests')
          .update({ status: 'approved', reviewed_by: _uid() })
          .eq('id', requestId);
        /* 2. Credit sky diamonds to user */
        return DB.wallet.credit(userId, 'sky_diamonds', sdAmount, 'sd_purchase', requestId);
      },

      /* Admin: reject SD request */
      rejectSdRequest: async function(requestId, note) {
        var { data, error } = await window._supa
          .from('sd_requests')
          .update({ status: 'rejected', reviewed_by: _uid(), review_note: note })
          .eq('id', requestId);
        if (error) return _err('wallet.rejectSdRequest', error);
        return data;
      }
    },

    /* ────────────────────────────────────────
       NOTIFICATIONS
    ──────────────────────────────────────── */
    notifications: {
      getMine: async function() {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('notifications')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) return _err('notifications.getMine', error);
        return data || [];
      },

      markRead: async function(notifId) {
        var { error } = await window._supa
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notifId)
          .eq('user_id', _uid());
        if (error) _err('notifications.markRead', error);
      },

      markAllRead: async function() {
        var { error } = await window._supa
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', _uid())
          .eq('is_read', false);
        if (error) _err('notifications.markAllRead', error);
      },

      /* Admin: send to user */
      send: async function(userId, type, title, body, refId) {
        var { data, error } = await window._supa
          .from('notifications')
          .insert({
            user_id: userId, type: type,
            title: title, body: body, ref_id: refId || null
          });
        if (error) return _err('notifications.send', error);
        return data;
      },

      /* Poll every 30s */
      poll: function(callback) {
        _poll('notifs', async function() {
          var d = await DB.notifications.getMine();
          callback(d);
        }, 30000);
      },
      stopPoll: function() { _stopPoll('notifs'); }
    },

    /* ────────────────────────────────────────
       SUPPORT
    ──────────────────────────────────────── */
    support: {
      getMyTickets: async function() {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('support_tickets')
          .select('*, messages:support_messages(*)')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });
        if (error) return _err('support.getMyTickets', error);
        return data || [];
      },

      createTicket: async function(subject) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('support_tickets')
          .insert({ user_id: uid, subject: subject })
          .select()
          .single();
        if (error) return _err('support.createTicket', error);
        return data;
      },

      sendMessage: async function(ticketId, message) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('support_messages')
          .insert({ ticket_id: ticketId, sender_id: uid, message: message });
        if (error) return _err('support.sendMessage', error);
        return data;
      },

      /* Admin: reply */
      adminReply: async function(ticketId, message) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('support_messages')
          .insert({ ticket_id: ticketId, sender_id: uid, message: message, is_admin: true });
        if (error) return _err('support.adminReply', error);
        /* Update ticket status */
        await window._supa.from('support_tickets').update({ status: 'replied' }).eq('id', ticketId);
        return data;
      }
    },

    /* ────────────────────────────────────────
       LEADERBOARD
    ──────────────────────────────────────── */
    leaderboard: {
      /* Global leaderboard — UNLIMITED reads! */
      getGlobal: async function(limit) {
        var { data, error } = await window._supa
          .from('leaderboard')
          .select('*')
          .limit(limit || 100);
        if (error) return _err('leaderboard.getGlobal', error);
        return data || [];
      },

      /* City leaderboard */
      getByCity: async function(city, limit) {
        var { data, error } = await window._supa
          .from('users')
          .select('id,ign,avatar_url,rank_tier,rank_points,total_wins,city')
          .eq('city', city)
          .eq('is_banned', false)
          .order('rank_points', { ascending: false })
          .limit(limit || 50);
        if (error) return _err('leaderboard.getByCity', error);
        return data || [];
      }
    },

    /* ────────────────────────────────────────
       APP CONFIG (replaces Firebase appSettings)
    ──────────────────────────────────────── */
    config: {
      /* Load live config from Supabase */
      load: async function() {
        var { data, error } = await window._supa
          .from('app_settings')
          .select('value')
          .eq('key', 'live_config')
          .single();
        if (error) { _err('config.load', error); return; }
        if (data && data.value) {
          /* Deep merge into window.CFG */
          Object.assign(window.CFG, data.value);
          if (data.value.missions)        Object.assign(window.CFG.missions, data.value.missions);
          if (data.value.premium)         Object.assign(window.CFG.premium, data.value.premium);
          if (data.value.cosmetics)       Object.assign(window.CFG.cosmetics, data.value.cosmetics);
          if (data.value.streakMilestones) Object.assign(window.CFG.streakMilestones, data.value.streakMilestones);
          window._cfgLoaded = true;
          console.log('[DB] AppConfig loaded from Supabase');
        }
      },

      /* Admin: save config */
      save: async function(configObj) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('app_settings')
          .update({ value: configObj, updated_by: uid, updated_at: new Date().toISOString() })
          .eq('key', 'live_config');
        if (error) return _err('config.save', error);
        return data;
      },

      /* Poll config every 5 min */
      poll: function() {
        _poll('appConfig', DB.config.load, 300000);
      }
    },

    /* ────────────────────────────────────────
       CLANS
    ──────────────────────────────────────── */
    clans: {
      getAll: async function() {
        var { data, error } = await window._supa
          .from('clans')
          .select('*, leader:users!leader_id(ign,avatar_url)')
          .order('total_wins', { ascending: false })
          .limit(50);
        if (error) return _err('clans.getAll', error);
        return data || [];
      },

      getMyClan: async function() {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('clan_members')
          .select('clan:clans(*)')
          .eq('user_id', uid)
          .maybeSingle();
        if (error) return _err('clans.getMyClan', error);
        return data ? data.clan : null;
      },

      create: async function(name, tag, description) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('clans')
          .insert({ name, tag, description, leader_id: uid })
          .select()
          .single();
        if (error) return _err('clans.create', error);
        /* Add creator as leader member */
        await window._supa.from('clan_members').insert({
          clan_id: data.id, user_id: uid, role: 'leader'
        });
        await DB.users.update({ clan_id: data.id });
        return data;
      },

      join: async function(clanId) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('clan_members')
          .insert({ clan_id: clanId, user_id: uid, role: 'member' });
        if (error) return _err('clans.join', error);
        await DB.users.update({ clan_id: clanId });
        return data;
      },

      leave: async function(clanId) {
        var uid = _uid();
        var { error } = await window._supa
          .from('clan_members')
          .delete()
          .eq('clan_id', clanId)
          .eq('user_id', uid);
        if (error) return _err('clans.leave', error);
        await DB.users.update({ clan_id: null });
      },

      getMessages: async function(clanId, limit) {
        var { data, error } = await window._supa
          .from('clan_messages')
          .select('*, sender:users(ign,avatar_url)')
          .eq('clan_id', clanId)
          .order('created_at', { ascending: false })
          .limit(limit || 50);
        if (error) return _err('clans.getMessages', error);
        return (data || []).reverse();
      },

      sendMessage: async function(clanId, message) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('clan_messages')
          .insert({ clan_id: clanId, sender_id: uid, message });
        if (error) return _err('clans.sendMessage', error);
        return data;
      }
    },

    /* ────────────────────────────────────────
       RANK & SEASON
    ──────────────────────────────────────── */
    rank: {
      getActiveSeason: async function() {
        var { data, error } = await window._supa
          .from('rank_seasons')
          .select('*')
          .eq('is_active', true)
          .maybeSingle();
        if (error) return _err('rank.getActiveSeason', error);
        return data;
      },

      getMyHistory: async function() {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('rank_history')
          .select('*, season:rank_seasons(name,season_num)')
          .eq('user_id', uid)
          .order('created_at', { ascending: false });
        if (error) return _err('rank.getMyHistory', error);
        return data || [];
      },

      addPoints: async function(uid, points) {
        return window._supa.rpc('increment_rank_points', {
          p_uid: uid, p_points: points
        });
      }
    },

    /* ────────────────────────────────────────
       MISSIONS
    ──────────────────────────────────────── */
    missions: {
      getToday: async function() {
        var uid = _uid();
        var today = new Date().toISOString().split('T')[0];
        var { data, error } = await window._supa
          .from('mission_progress')
          .select('*')
          .eq('user_id', uid)
          .gte('period', today);
        if (error) return _err('missions.getToday', error);
        return data || [];
      },

      updateProgress: async function(missionKey, period, progress, target) {
        var uid = _uid();
        var isCompleted = progress >= target;
        var { data, error } = await window._supa
          .from('mission_progress')
          .upsert({
            user_id: uid,
            mission_key: missionKey,
            period: period,
            progress: progress,
            target: target,
            is_completed: isCompleted,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,mission_key,period' });
        if (error) return _err('missions.updateProgress', error);
        return data;
      },

      claimReward: async function(missionKey, period, coins) {
        var uid = _uid();
        /* Mark claimed */
        await window._supa
          .from('mission_progress')
          .update({ reward_claimed: true })
          .eq('user_id', uid)
          .eq('mission_key', missionKey)
          .eq('period', period);
        /* Credit coins */
        return DB.wallet.credit(uid, 'coins', coins, 'mission_reward', missionKey);
      }
    },

    /* ────────────────────────────────────────
       DAILY CHECK-IN
    ──────────────────────────────────────── */
    checkin: {
      doCheckIn: async function() {
        var uid = _uid();
        var today = new Date().toISOString().split('T')[0];
        var user = await DB.users.getMe();
        if (!user) return { error: 'User not found' };
        /* Check already done */
        if (user.last_checkin_date === today) return { error: 'Already checked in today' };
        var newStreak = (user.last_checkin_date === _yesterday()) ? (user.streak_days || 0) + 1 : 1;
        var coins = window.CFG ? window.CFG.checkinCoins || 5 : 5;
        /* Streak bonus */
        if (newStreak % 7 === 0 && window.CFG) coins += window.CFG.checkinStreakBonus7 || 50;
        /* Log */
        await window._supa.from('daily_checkins').upsert({
          user_id: uid, checkin_date: today,
          coins_earned: coins, streak_day: newStreak
        }, { onConflict: 'user_id,checkin_date' });
        /* Update user */
        await DB.users.update({ last_checkin_date: today, streak_days: newStreak });
        /* Credit */
        await DB.wallet.credit(uid, 'coins', coins, 'checkin_bonus', today);
        return { success: true, coins: coins, streak: newStreak };
      }
    },

    /* ────────────────────────────────────────
       ACHIEVEMENTS
    ──────────────────────────────────────── */
    achievements: {
      getMine: async function() {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('user_achievements')
          .select('*')
          .eq('user_id', uid);
        if (error) return _err('achievements.getMine', error);
        return data || [];
      },

      unlock: async function(uid, key) {
        var { data, error } = await window._supa
          .from('user_achievements')
          .upsert({ user_id: uid, achievement_key: key }, { onConflict: 'user_id,achievement_key' });
        if (error) return _err('achievements.unlock', error);
        return data;
      }
    },

    /* ────────────────────────────────────────
       BATTLE PASS
    ──────────────────────────────────────── */
    battlePass: {
      getActive: async function() {
        var { data, error } = await window._supa
          .from('battle_passes')
          .select('*')
          .eq('is_active', true)
          .maybeSingle();
        if (error) return _err('battlePass.getActive', error);
        return data;
      },

      getMyProgress: async function(seasonId) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('battle_pass_progress')
          .select('*')
          .eq('user_id', uid)
          .eq('season_id', seasonId)
          .maybeSingle();
        if (error) return _err('battlePass.getMyProgress', error);
        return data;
      },

      addXP: async function(seasonId, xp) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('battle_pass_progress')
          .upsert({
            user_id: uid,
            season_id: seasonId,
            current_xp: xp,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,season_id' });
        if (error) return _err('battlePass.addXP', error);
        return data;
      },

      claimTier: async function(seasonId, tier, rewardCoins) {
        var uid = _uid();
        /* Get current progress */
        var prog = await DB.battlePass.getMyProgress(seasonId);
        var claimed = prog ? (prog.claimed_tiers || []) : [];
        if (claimed.indexOf(tier) !== -1) return { error: 'Already claimed' };
        claimed.push(tier);
        await window._supa
          .from('battle_pass_progress')
          .upsert({
            user_id: uid, season_id: seasonId,
            claimed_tiers: claimed, current_tier: tier,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,season_id' });
        if (rewardCoins > 0) {
          await DB.wallet.credit(uid, 'coins', rewardCoins, 'battle_pass_reward', 'tier_' + tier);
        }
        return { success: true, tier: tier };
      }
    },

    /* ────────────────────────────────────────
       WATCH & EARN
    ──────────────────────────────────────── */
    watchEarn: {
      logWatch: async function(matchId, coinsEarned, watchedMins) {
        var uid = _uid();
        var today = new Date().toISOString().split('T')[0];
        var { data, error } = await window._supa
          .from('watch_earn_log')
          .insert({
            user_id: uid, match_id: matchId || null,
            coins_earned: coinsEarned, watched_mins: watchedMins,
            log_date: today
          });
        if (error) return _err('watchEarn.logWatch', error);
        /* Credit coins */
        await DB.wallet.credit(uid, 'coins', coinsEarned, 'watch_earn', matchId);
        return data;
      },

      getTodayTotal: async function() {
        var uid = _uid();
        var today = new Date().toISOString().split('T')[0];
        var { data, error } = await window._supa
          .from('watch_earn_log')
          .select('coins_earned, watched_mins')
          .eq('user_id', uid)
          .eq('log_date', today);
        if (error) return _err('watchEarn.getTodayTotal', error);
        var rows = data || [];
        return {
          totalCoins: rows.reduce(function(s, r) { return s + r.coins_earned; }, 0),
          totalMins:  rows.reduce(function(s, r) { return s + r.watched_mins; }, 0)
        };
      }
    },

    /* ────────────────────────────────────────
       AUTO SQUAD QUEUE
    ──────────────────────────────────────── */
    autoSquad: {
      joinQueue: async function(matchId, mode) {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('auto_squad_queue')
          .upsert({
            match_id: matchId, user_id: uid, mode: mode, status: 'waiting'
          }, { onConflict: 'match_id,user_id' })
          .select()
          .single();
        if (error) return _err('autoSquad.joinQueue', error);
        return data;
      },

      leaveQueue: async function(matchId) {
        var uid = _uid();
        var { error } = await window._supa
          .from('auto_squad_queue')
          .delete()
          .eq('match_id', matchId)
          .eq('user_id', uid);
        if (error) return _err('autoSquad.leaveQueue', error);
      },

      getWaiting: async function(matchId) {
        var { data, error } = await window._supa
          .from('auto_squad_queue')
          .select('*, user:users(ign, avatar_url, rank_tier)')
          .eq('match_id', matchId)
          .eq('status', 'waiting')
          .order('joined_at', { ascending: true });
        if (error) return _err('autoSquad.getWaiting', error);
        return data || [];
      },

      /* Poll waiting queue every 15s */
      poll: function(matchId, callback) {
        _poll('autoSquad_' + matchId, async function() {
          var d = await DB.autoSquad.getWaiting(matchId);
          callback(d);
        }, 15000);
      },
      stopPoll: function(matchId) { _stopPoll('autoSquad_' + matchId); }
    },

    /* ────────────────────────────────────────
       COSMETICS
    ──────────────────────────────────────── */
    cosmetics: {
      getMine: async function() {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('user_cosmetics')
          .select('*')
          .eq('user_id', uid);
        if (error) return _err('cosmetics.getMine', error);
        return data || [];
      },

      purchase: async function(cosmeticKey, priceSd) {
        var uid = _uid();
        /* Check already owned */
        var { data: existing } = await window._supa
          .from('user_cosmetics')
          .select('cosmetic_key')
          .eq('user_id', uid)
          .eq('cosmetic_key', cosmeticKey)
          .maybeSingle();
        if (existing) return { error: 'Already owned' };
        /* Debit sky diamonds */
        await DB.wallet.debit(uid, 'sky_diamonds', priceSd, 'cosmetic_purchase', cosmeticKey);
        /* Insert cosmetic */
        var { data, error } = await window._supa
          .from('user_cosmetics')
          .insert({ user_id: uid, cosmetic_key: cosmeticKey });
        if (error) return _err('cosmetics.purchase', error);
        return { success: true };
      },

      equip: async function(cosmeticKey) {
        var uid = _uid();
        /* Unequip all same type first */
        var prefix = cosmeticKey.split('_')[0]; /* 'frame', 'tag', etc. */
        await window._supa
          .from('user_cosmetics')
          .update({ is_equipped: false })
          .eq('user_id', uid)
          .like('cosmetic_key', prefix + '%');
        /* Equip selected */
        var { data, error } = await window._supa
          .from('user_cosmetics')
          .update({ is_equipped: true })
          .eq('user_id', uid)
          .eq('cosmetic_key', cosmeticKey);
        if (error) return _err('cosmetics.equip', error);
        return data;
      }
    },

    /* ────────────────────────────────────────
       SPONSORED PRIZES
    ──────────────────────────────────────── */
    sponsored: {
      getForMatch: async function(matchId) {
        var { data, error } = await window._supa
          .from('sponsored_prizes')
          .select('*, claims:sponsored_prize_claims(*, user:users(ign))')
          .eq('match_id', matchId)
          .maybeSingle();
        if (error) return _err('sponsored.getForMatch', error);
        return data;
      },

      /* Admin: create sponsored prize */
      create: async function(matchId, sponsorName, totalPrize, distribution) {
        var { data, error } = await window._supa
          .from('sponsored_prizes')
          .insert({
            match_id: matchId,
            sponsor_name: sponsorName,
            total_prize: totalPrize,
            distribution: distribution
          })
          .select()
          .single();
        if (error) return _err('sponsored.create', error);
        return data;
      },

      /* Admin: distribute prizes */
      distribute: async function(sponsoredId, winners) {
        /* winners = [{user_id, placement, prize_detail}, ...] */
        var uid = _uid();
        var inserts = winners.map(function(w) {
          return { sponsored_id: sponsoredId, user_id: w.user_id, placement: w.placement, prize_detail: w.prize_detail };
        });
        await window._supa.from('sponsored_prize_claims').insert(inserts);
        var { data, error } = await window._supa
          .from('sponsored_prizes')
          .update({ is_distributed: true, distributed_at: new Date().toISOString(), distributed_by: uid })
          .eq('id', sponsoredId);
        if (error) return _err('sponsored.distribute', error);
        return data;
      }
    },

    /* ────────────────────────────────────────
       REFERRALS
    ──────────────────────────────────────── */
    referrals: {
      /* Apply referral code on signup */
      apply: async function(referralCode) {
        var uid = _uid();
        /* Find referrer */
        var { data: referrer, error: re } = await window._supa
          .from('users')
          .select('id')
          .eq('referral_code', referralCode.toUpperCase())
          .maybeSingle();
        if (re || !referrer) return { error: 'Invalid referral code' };
        if (referrer.id === uid) return { error: 'Apna code use nahi kar sakte' };
        /* Create referral record */
        var { error } = await window._supa
          .from('referrals')
          .upsert({ referrer_id: referrer.id, referred_id: uid }, { onConflict: 'referred_id' });
        if (error) return { error: 'Already used a referral code' };
        /* Give join bonus to referred user */
        var joinCoins = window.CFG ? window.CFG.referralJoinCoins || 50 : 50;
        await DB.wallet.credit(uid, 'coins', joinCoins, 'referral_bonus', referrer.id);
        /* Mark join bonus paid */
        await window._supa
          .from('referrals')
          .update({ join_bonus_paid: true })
          .eq('referred_id', uid);
        return { success: true, coins: joinCoins };
      },

      getMyReferrals: async function() {
        var uid = _uid();
        var { data, error } = await window._supa
          .from('referrals')
          .select('*, referred:users!referred_id(ign,avatar_url,total_matches,created_at)')
          .eq('referrer_id', uid)
          .order('created_at', { ascending: false });
        if (error) return _err('referrals.getMyReferrals', error);
        return data || [];
      }
    },

    /* ────────────────────────────────────────
       ADMIN HELPERS
    ──────────────────────────────────────── */
    admin: {
      /* Get dashboard stats */
      getStats: async function() {
        /* Bug #36 Fix: Admin role check before returning sensitive data */
        if (window.U && window._supa) {
          try {
            var _ac = await window._supa.from('users').select('is_admin').eq('id', window.U.uid).maybeSingle();
            if (!_ac.data || !_ac.data.is_admin) { console.warn('[Admin] getStats: denied'); return null; }
          } catch(e) {}
        }
        var [users, matches, pending] = await Promise.all([
          window._supa.from('users').select('id', { count: 'exact', head: true }),
          window._supa.from('matches').select('id', { count: 'exact', head: true }).eq('status', 'upcoming'),
          window._supa.from('sd_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
        ]);
        return {
          totalUsers:     users.count || 0,
          upcomingMatches: matches.count || 0,
          pendingSdRequests: pending.count || 0
        };
      },

      /* Log admin action */
      log: async function(action, targetType, targetId, details) {
        var uid = _uid();
        await window._supa.from('admin_activity_log').insert({
          admin_id: uid, action, target_type: targetType,
          target_id: targetId, details: details || null
        });
      },

      /* Get all pending join requests */
      getPendingJoinRequests: async function() {
        var { data, error } = await window._supa
          .from('join_requests')
          .select('*, user:users(ign,avatar_url,rank_tier), match:matches(title,scheduled_at,mode,entry_type,entry_fee)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });
        if (error) return _err('admin.getPendingJoinRequests', error);
        return data || [];
      },

      /* Creator program */
      getCreatorApplications: async function() {
        var { data, error } = await window._supa
          .from('creator_applications')
          .select('*, user:users(ign,avatar_url,total_matches)')
          .order('created_at', { ascending: false });
        if (error) return _err('admin.getCreatorApplications', error);
        return data || [];
      },

      setCreatorStatus: async function(appId, status, note) {
        var { data, error } = await window._supa
          .from('creator_applications')
          .update({ status: status, review_note: note, reviewed_by: _uid() })
          .eq('id', appId);
        if (error) return _err('admin.setCreatorStatus', error);
        return data;
      }
    }
  };

  /* ── PRIVATE HELPERS ── */
  function _currencyCol(currency) {
    var map = {
      'coins': 'coins',
      'sky_diamonds': 'sky_diamonds',
      'green_diamonds': 'green_diamonds',
      'blue_diamonds': 'blue_diamonds'
    };
    return map[currency] || 'coins';
  }

  function _yesterday() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }

  /* ── AUTO INIT: load config when ready ── */
  onSupaReady(function() {
    if (window.CFG) DB.config.load();
    DB.config.poll();
  });

  console.log('[DB] Abstraction layer loaded. Use window.DB for all queries.');

})();

/* ================================================================
   SQL FUNCTIONS NEEDED IN SUPABASE:
   Run these in Supabase SQL Editor:

   -- Increment balance (safe, no negative)
   create or replace function increment_balance(p_uid uuid, p_col text, p_amount int)
   returns void language plpgsql security definer as $$
   begin
     execute format('update public.users set %I = %I + $1 where id = $2', p_col, p_col)
     using p_amount, p_uid;
   end;
   $$;

   -- Decrement balance (safe, min 0)
   create or replace function decrement_balance(p_uid uuid, p_col text, p_amount int)
   returns void language plpgsql security definer as $$
   begin
     execute format('update public.users set %I = greatest(%I - $1, 0) where id = $2', p_col, p_col)
     using p_amount, p_uid;
   end;
   $$;

   -- Increment rank points
   create or replace function increment_rank_points(p_uid uuid, p_points int)
   returns void language plpgsql security definer as $$
   begin
     update public.users set rank_points = rank_points + p_points where id = p_uid;
   end;
   $$;
================================================================ */
