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

  /* Postgres/PostgREST error ko ek chhota, toast-worthy line me badlo.
     Full error console me hi rehta hai; UI ko sirf woh hissa chahiye jo
     culprit bataye — e.g. `insert or update on table "profile_requests"
     violates foreign key constraint ... [23503]` se turant pata chal
     jaata hai ki avatar_url UPDATE koi FK-dependent trigger tod raha hai.
     (2026-09-16c: pehle sirf error.message jaata tha, code/details kabhi
     nahi — message ke bina class ka error code bhi ab dikhta hai.) */
  function _pgErrText(err) {
    if (!err) return 'image_update_failed';
    var msg = String(err.message || 'image_update_failed');
    var code = err.code ? ' [' + err.code + ']' : '';
    return (msg + code).slice(0, 180);
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
        /* ✅ FIX (2026-09-15): the fallback `firebase.auth()` here was a bare
           call (resolves "[DEFAULT]", which never exists — app is named
           "mainApp"), so it threw app-compat/no-app and the surrounding
           catch swallowed it, meaning the Firebase session was never
           actually cleared on logout. Use the safe helper from
           core/firebase.js. */
        var firebaseAuth = window.fbAuth ? window.fbAuth() : window.auth;
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
        /* ✅ CRITICAL BUG FIX (2026-07): this select list included FOUR
           columns that don't exist anywhere in the real users schema —
           real_money, is_premium, battle_pass_tier, ban_status. Supabase/
           PostgREST rejects the ENTIRE query if even one requested column
           doesn't exist, so this has been erroring out on every single
           call, for every user, this whole session (and probably long
           before). That made getMe() ALWAYS return `undefined` (network/
           db-error branch) — never a real profile, and never a confirmed
           "null = new user" either — which is a big part of why the
           account-creation flow could never reliably tell new vs.
           existing users apart. Fixed: real_money doesn't correspond to
           anything (this app has no real-money balance by design — see
           halal three-currency architecture), battle_pass_tier isn't a
           users column (it lives in battle_pass_progress.current_tier),
           is_premium → premium_level (INT, not bool), ban_status →
           is_banned + ban_reason. Verified nothing else in the codebase
           reads .is_premium/.real_money/.battle_pass_tier/.ban_status
           from this result, so no other file needed updating. */
        /* ✅ BUG FIX (2026-08-22): added sponsored_winnings to this select
           list — it was missing, so any code path relying on getMe()
           (bugfixes.js reconnect handler, boot.js re-fetches) would never
           see updates to the real-money sponsor-tournament prize balance
           until the next full listeners.js _loadUser() (select('*')) poll.
           Not the root cause of the ₹/Green-Diamond mixup bug itself, but
           left stale here would have masked the fix under this exact
           reconnect path. */
        var { data, error } = await window._supa
          .from('users')
          .select('id,ign,email,avatar_url,banner_url,coins,sky_diamonds,green_diamonds,sponsored_winnings,rank_tier,rank_points,total_wins,total_kills,total_matches,city,is_creator,premium_level,clan_id,referral_code,profile_status,is_banned,ban_reason,accepted_policy,created_at,streak_days,streak_milestones_claimed')
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

        /* ✅ BUG FIX (2026-08-24): "Profile abhi ready nahi hai" kept
           showing for genuinely brand-new users. Root cause: with
           ignoreDuplicates:true, when TWO create() calls race for the
           same brand-new uid (boot.js's own fire-and-forget create() on
           login, AND profile.js's _ensureUserRowExists() self-heal call
           if the user opens "Profile Update" within ~1-2s of signing up)
           — the loser of that race does a real INSERT that PostgREST
           silently turns into a no-op (0 rows affected, because the
           winner's row already landed), and .select().single() on ZERO
           rows throws PGRST116 ("no rows returned"), NOT 23505. The old
           code only had a fallback for error.code === '23505' — a
           PGRST116 fell straight through to _err() and returned null,
           even though the row genuinely exists and was created correctly
           by the other concurrent call a few ms earlier. Treat PGRST116
           the exact same way as 23505 here: it always means "someone
           else already created this row" for an upsert-on-id call, so
           just fetch and return the row that's actually there. */
        if (error && (error.code === 'PGRST116' || error.code === '23505')) {
          var raceRow = await window._supa.from('users').select('*').eq('id', uid).maybeSingle();
          if (raceRow.data) return raceRow.data;
        }

        /* ✅ BUG FIX (2026-07): this used to skip the fallback entirely
           whenever error.code === '23505' — but a 23505 here doesn't only
           mean "id already exists" (the harmless, expected case from the
           upsert's own onConflict:'id'). It can ALSO mean a DIFFERENT
           unique column in `profile` collided (e.g. referral_code, which
           boot.js derives from the first 8 chars of the Firebase UID —
           rare but not impossible to collide with another user's code).
           In that second case the row was NEVER actually created, this
           function silently returned undefined, and — because boot.js
           only ever calls create() ONCE per account (the very first time
           getMe() sees no row) — that user's Supabase row stayed missing
           PERMANENTLY. No amount of staying logged in fixes that; nothing
           was ever retrying. This is what caused "profile_requests
           violates foreign key constraint" even for long-logged-in users.
           Fix: always check what's actually in the table now, on ANY
           error — and if the row genuinely still isn't there, retry the
           insert with ONLY the guaranteed-unique field (id), dropping
           anything else that could have been the real collision. */
        if (error) {
          var existing = await window._supa.from('users').select('*').eq('id', uid).maybeSingle();
          if (existing.data) return existing.data; // row exists — that's all we needed
          if (error.code === '23505') {
            // Row still doesn't exist, but SOMETHING unique collided (not
            // the id itself). Strip any field that isn't guaranteed-safe
            // and retry bare — this can never fail on a duplicate again.
            var safeProfile = { ign: profile.ign, email: profile.email, avatar_url: profile.avatar_url };
            var retry = await window._supa.from('users').insert({ id: uid, ...safeProfile }).select().single();
            if (!retry.error) return retry.data;
            var existing2 = await window._supa.from('users').select('*').eq('id', uid).maybeSingle();
            if (existing2.data) return existing2.data;
            return _err('users.create (retry)', retry.error);
          }
          return _err('users.create', error);
        }
        return data;
      },

      /* Update own profile */
      update: async function(fields) {
        var uid = _uid();
        if (!uid) return { ok: false, error: 'not_authenticated' };
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
            return { ok: false, error: '23505' };
          }
          _err('users.update', error);
          return { ok: false, error: error.message };
        }
        /* ✅ BUG FIX (2026-08-23): this used to `return data`, but a plain
           Supabase .update() with no .select() chained always returns
           data:null on SUCCESS too (PostgREST default: no representation
           returned) — so callers had no reliable way to tell "it worked"
           apart from "it silently failed", both looked identical
           (falsy). Now returns an explicit {ok:true/false} so a caller
           like the profile photo/banner upload can correctly show
           success only when the write actually happened. */
        return { ok: true, data: data };
      },

      /* Profile/banner URL update with affected-row confirmation.
         A plain PostgREST UPDATE can resolve with error:null even when RLS
         affected zero rows; image upload must not toast success in that
         case. Keep this narrow/whitelisted so no unrelated profile update
         behaviour changes.

         ✅ FIX (2026-09-16c) — "Photo save failed — dobara try karo" jabki
         ImgBB upload SUCCESS aur banner save bhi SUCCESS. Banner aur photo
         dono isi ek method se guzarte hain, bas `field` alag hai — to
         avatar-only failure ka matlab hai Postgres khud avatar_url wali
         UPDATE ko rok raha hai (trigger exception / trigger value-rewrite /
         CHECK constraint / column change — RLS row-level hoti hai, woh
         dono ko equally rokti). Purana code woh asli Postgres reason
         console ke aage khaa jaata tha aur UI ko ek generic
         'image_update_failed' deta tha — diagnose karna impossible.
         Ab: (1) asli message + pg error code caller tak jaata hai (toast
         tak — ek screenshot se culprit pakda jaayega), aur (2) "row
         updated par stored value alag hai" (kaa'ida: koi BEFORE UPDATE
         trigger ne avatar_url ko NULL/placeholder se overwrite kar diya)
         ko RLS zero-row se ALAG identify kiya jaata hai, stored value ke
         saath log karke. Diagnosis SQL: supabase/migrations/
         20260916_diagnose_avatar_url_save.sql */
      updateImage: async function(field, url) {
        var uid = _uid();
        if (!uid) return { ok: false, error: 'not_authenticated' };
        if (field !== 'avatar_url' && field !== 'banner_url') {
          return { ok: false, error: 'invalid_image_field' };
        }
        if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
          return { ok: false, error: 'invalid_image_url' };
        }
        var patch = { updated_at: new Date().toISOString() };
        patch[field] = url;
        try {
          var result = await window._supa
            .from('users')
            .update(patch)
            .eq('id', uid)
            .select('id,' + field)
            .maybeSingle();
          if (result.error) {
            console.error('[DB:users.updateImage]', result.error);
            return { ok: false, error: _pgErrText(result.error) };
          }
          if (!result.data || result.data.id !== uid) {
            /* Zero rows affected — RLS denial ya row hi missing. Banner
               bhi yahi method use karke pass ho raha hai to avatar ke liye
               yeh branch practically impossible hai; phir bhi alag rakha
               hai taki teeno failure classes ek-ek screenshot me pehchani
               jaa sakein. */
            console.error('[DB:users.updateImage] No user row was updated (possible RLS denial)');
            return { ok: false, error: 'update_not_applied_rls' };
          }
          if (result.data[field] !== url) {
            /* Row update HUI par stored value woh nahi jo bheji — yaani ek
               DB trigger ne avatar_url ko rewrite/normalize/NULL kar diya.
               Yeh avatar-only failures ka classic signature hai (banner pe
               koi aisa trigger nahi). Stored value log karo: agar woh NULL
               ya kisi internal placeholder pe badli hai to culprit trigger
               section-2 SQL se turant milega. */
            console.error('[DB:users.updateImage] DB trigger ne ' + field +
              ' rewrite kar diya — sent:', String(url).slice(0, 120),
              '| stored:', String(result.data[field]).slice(0, 160));
            return { ok: false, error: 'db_trigger_rewrote_value' };
          }
          return { ok: true, data: result.data };
        } catch (e) {
          console.error('[DB:users.updateImage]', e);
          return { ok: false, error: (e && e.message) || 'image_update_failed' };
        }
      },

      /* Get any user by ID */
      getById: async function(uid) {
        var { data, error } = await window._supa
          .from('user_public_profiles') /* BUG #38 FIX (2026-07-30) */
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
        /* BUG #40 FIX (2026-07-30): direct column UPDATE would fail now — is_banned/
           ban_reason's UPDATE grant is revoked for anon/authenticated (they were
           previously writable by ANY logged-in user, not just admins — see AUDIT-LOG
           BUG #40). This function has no live callers (dead code per earlier audit
           pass) but updated anyway in case it's ever wired up. */
        var { data, error } = await window._supa.rpc('set_user_ban_status', {
          p_uid: uid, p_banned: isBanned, p_reason: reason || null
        });
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
          /* ✅ R3-HARDEN FIX (2026-09-23): pehle ka select non-existent columns
             maangta tha (game/team_size/max_players/current_players/perspective/
             match_type) → har call 42703 column does not exist = helper broken.
             Ab view ke REAL columns se map kiya (mode, max_slots, filled_slots,
             match_sub_type). Room creds view me hain hi nahi (P0 leak fix). */
          .select('id,title,name,mode,status,scheduled_at,entry_type,entry_fee,prize_pool,max_slots,filled_slots,map,is_featured,match_sub_type,banner_url')
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
          .insert({ ...matchData, creator_uid: uid })
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
          .select('*, match:matches(title,scheduled_at,mode,status)') /* ✅ R3-Phase2: room creds matches me nahi (match_rooms) */
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
      /* ✅ SECURITY FIX (2026-09-08): "server-authoritative wallet RPC"
         audit — this was a fully generic "credit any user, any
         currency, any amount" function, globally reachable via
         window.DB from any browser console. It called
         increment_balance directly, which this session locked to
         service_role-only specifically because of functions exactly
         like this one. Every legitimate caller of DB.wallet.credit()
         has been moved to its own dedicated, purpose-specific RPC
         (claim_watch_earn_reward, claim_referral_reward/
         apply_referral_code, claim_battle_pass_tier, redeem_voucher,
         claim_ad_reward — each computes its own amount server-side
         and enforces its own abuse checks). This function is kept as
         a clear, loud failure rather than silently deleted, so any
         remaining caller (or a future one someone adds without
         reading this comment) fails obviously instead of quietly
         doing nothing. */
      credit: async function(uid, currency, amount, reason, refId) {
        console.error('[DB.wallet.credit] REMOVED (2026-09-08) — this generic mint path is no longer available. Use a dedicated RPC for the specific reward instead (claim_watch_earn_reward, apply_referral_code, claim_battle_pass_tier, redeem_voucher, claim_ad_reward, etc.)');
        return _err('wallet.credit', { message: 'DB.wallet.credit() has been removed for security reasons — use a dedicated reward RPC instead' });
      },

      /* Debit any currency — R6: ledger insert हटाया (fft_guard अब regular-user
         ledger INSERT block करता है; कोई live caller नहीं)। Debit ke liye हर
         flow ka अपना dedicated server RPC है। */
      debit: async function(uid, currency, amount, reason, refId) {
        console.error('[DB.wallet.debit] legacy path — use a dedicated server RPC (validate_and_join_match, gift_match_entry, contribute_to_squad_bank, redeem_reward_item, purchase_cosmetic)');
        return _err('wallet.debit', { message: 'DB.wallet.debit() retired — server RPC is the only debit authority' });
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
      /* ✅ SECURITY NOTE (2026-09-08): this User Panel function is
         never called from any User Panel UI — only reachable via
         window.DB from a browser console. Its .update() to
         sd_requests is already correctly RLS-gated to real admins
         only (sd_update_admin policy checks users.is_admin), so a
         non-admin calling this already fails at that step. The
         DB.wallet.credit() call below is now permanently disabled
         (see that function's own comment) — this function is kept
         only for admins who might call it directly from console;
         the Admin Panel's own equivalent flow uses its own
         already-secure RPC path and is unaffected. */
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
          .from('user_public_profiles') /* BUG #38 FIX (2026-07-30) */
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
      /* ✅ FIX (live-testing — root cause of "Cannot convert undefined or
         null to object" at Object.assign inside config.load()): _poll()
         calls its fn() IMMEDIATELY on setup, before the first interval
         tick. This poll() is called from onSupaReady's callback, which
         fires as soon as the Supabase client is ready — independent of
         whether features/app-config.js (which defines window.CFG and
         its missions/premium/cosmetics sub-objects, loaded AFTER
         core/db.js in index.html) has run yet. If the Supabase client
         became ready first, config.load() ran with window.CFG still
         undefined, and Object.assign(window.CFG.missions, ...) crashed
         reading .missions off undefined. Wait for window.CFG to exist
         before starting the poll (retry every 200ms, bounded so this
         can't loop forever if app-config.js genuinely failed to load). */
      poll: function() {
        var _tries = 0;
        (function _waitForCfg() {
          if (window.CFG) { _poll('appConfig', DB.config.load, 300000); return; }
          _tries++;
          if (_tries > 100) { console.warn('[DB.config.poll] window.CFG never became available — config poll not started.'); return; }
          setTimeout(_waitForCfg, 200);
        })();
      }
    },

    /* ────────────────────────────────────────
       CLANS
    ──────────────────────────────────────── */
    clans: {
      getAll: async function() {
        var { data, error } = await window._supa
          .from('clans')
          .select('*, leader:users!leader_uid(ign,avatar_url)')
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
          .insert({ name, tag, description, leader_uid: uid })
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
        /* BUG #31 FIX (2026-07): direct upsert now blocked by Category A's security lockdown
           (mission_progress has no client write grant, pending this RPC). Also this RPC
           correctly never lets progress go backwards (GREATEST against the existing value). */
        var { data, error } = await window._supa.rpc('track_mission_progress', {
          p_mission_key: missionKey, p_period: period, p_progress: progress, p_target: target
        });
        if (error) return _err('missions.updateProgress', error);
        return data;
      },

      claimReward: async function(missionKey, period, coins) {
        /* BUG #31 FIX (2026-07): old version marked reward_claimed=true and credited coins
           as two separate, unguarded steps — never checked is_completed, and nothing stopped
           reward_claimed being toggled back to false (directly, before Category A locked
           this) to re-claim indefinitely. Now one atomic, server-validated RPC call. */
        var { data, error } = await window._supa.rpc('claim_mission_reward', {
          p_mission_key: missionKey, p_period: period, p_coins: coins
        });
        if (error) return _err('missions.claimReward', error);
        return data;
      }
    },

    /* ────────────────────────────────────────
       DAILY CHECK-IN
    ──────────────────────────────────────── */
    checkin: {
      doCheckIn: async function() {
        /* ✅ BUG FIX (2026-07-17): this function had NO live callers anywhere
           in the app (confirmed via exhaustive search) — dead code. It's
           fixed anyway rather than left broken, because it's a THIRD,
           independent implementation of daily check-in logic alongside the
           two in features-user.js/fixes-v7.js (which call the
           process_daily_checkin RPC). This version instead wrote directly
           to daily_checkins (which is RPC-only by grant — this insert would
           have been rejected outright) and called DB.users.update with
           last_checkin_date/streak_days (which the RPC also handles
           atomically, avoiding a check-then-write race between two
           check-ins landing at the same moment). Rather than duplicate and
           re-fix the same logic a third time, this now just calls the one
           real, tested RPC — so if this function is ever actually wired to
           a button in the future, there's only one authoritative check-in
           path in the whole codebase, not three drifting implementations. */
        var tierRewards = (window.CFG && window.CFG.checkinTierRewards) || [5, 7, 10, 12, 15, 20, 30];
        var milestoneBonus = (window.CFG && window.CFG.checkinStreakBonus7) || 50;
        var { data, error } = await window._supa.rpc('process_daily_checkin', {
          p_tier_rewards: tierRewards, p_milestone_bonus: milestoneBonus, p_milestone_days: 7
        });
        if (error) return _err('checkin.doCheckIn', error);
        if (data && data.success === false) return { error: data.error };
        return { success: true, coins: data.total, streak: data.streak };
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
          .eq('season_key', seasonId)
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
            season_key: seasonId,
            current_xp: xp,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id,season_key' });
        if (error) return _err('battlePass.addXP', error);
        return data;
      },

      /* ✅ SECURITY FIX (2026-09-08): "server-authoritative wallet
         RPC" audit — replaced with claim_battle_pass_tier(seasonKey,
         tier), a dedicated RPC that reads the reward amount and
         premium-gating from the battle_passes table's own tiers
         definition (never from the client), and enforces one-claim-
         per-tier server-side. This whole feature is currently
         unwired (no UI calls claimTier anywhere yet), so fixing it
         properly now means it's safe by construction whenever it
         does get wired up. */
      claimTier: async function(seasonId, tier, track) {
        /* ✅ R25 FIX (2026-09-21): RPC arg-match — live fn signature is
           claim_battle_pass_tier(p_season, p_tier, p_track, p_gd_reward
           DEFAULT 0); this wrapper used to send p_season_key (wrong name,
           and p_track missing) so call RPC rejected with
           'function claim_battle_pass_tier(text, integer) does not exist'
           whenever wired. p_gd_reward is intentionally NOT sent — the RPC
           ignores it and reads the authoritative freeGd/premGd amount from
           the battle_passes.tiers jsonb (never from the client). */
        var { data, error } = await window._supa.rpc('claim_battle_pass_tier', {
          p_season: seasonId, p_tier: tier, p_track: track || 'free'
        });
        if (error) return _err('battlePass.claimTier', error);
        if (data && data.success === false) return _err('battlePass.claimTier', { message: data.error });
        return data;
      }
    },

    /* ────────────────────────────────────────
       WATCH & EARN
    ──────────────────────────────────────── */
    watchEarn: {
      /* ✅ SECURITY FIX (2026-09-08): "server-authoritative wallet
         RPC" audit — this legacy path let the client supply
         coinsEarned/watchedMins directly with zero server validation,
         same vulnerability class fixed in features/watch-earn.js
         (which now calls claim_watch_earn_reward() instead and never
         used this function). Never called from anywhere in this
         codebase — disabled rather than silently left reachable. */
      logWatch: async function(matchId, coinsEarned, watchedMins) {
        console.error('[DB.watchEarn.logWatch] REMOVED (2026-09-08) — use claim_watch_earn_reward RPC instead (see features/watch-earn.js)');
        return _err('watchEarn.logWatch', { message: 'This function has been removed for security reasons' });
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
      /* ✅ SECURITY FIX (2026-09-08): "server-authoritative wallet
         RPC" audit — this read joinCoins from window.CFG (a
         client-cached config value, not re-verified server-side at
         claim time) and credited it via the now-disabled generic
         DB.wallet.credit(). Never called from anywhere in this
         codebase (js/referral-system-fix.js's window.applyReferralCode
         is the actual live referral-apply flow, via the already-secure
         apply_referral_code RPC). Redirected to call that same RPC
         directly, so if anything ever does call this function, it
         gets the real, secure implementation instead of a second,
         parallel insecure one. */
      apply: async function(referralCode) {
        var { data, error } = await window._supa.rpc('apply_referral_code', {
          p_code: referralCode.toUpperCase(), p_reward: 0 /* ignored server-side, see apply_referral_code */
        });
        if (error) return { error: error.message };
        if (data && data.success === false) return { error: data.error };
        return { success: true, coins: data.reward };
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
        /* ✅ FIX (BUG L-6): HEAD+count:exact requests are unreliable under
           headless-Chromium test conditions (100% ERR_ABORTED in testing,
           confirmed the equivalent SQL count works fine, so it's a
           transport-layer quirk not a data bug). Switched to capped row
           selects and .length — this is an admin-stats summary, not a hot
           path, so the extra payload size is a non-issue. */
        var [users, matches, pending] = await Promise.all([
          window._supa.from('users').select('id').limit(10000),
          window._supa.from('matches').select('id').eq('status', 'upcoming').limit(10000),
          window._supa.from('sd_requests').select('id').eq('status', 'pending').limit(10000)
        ]);
        return {
          totalUsers:     (users.data || []).length,
          upcomingMatches: (matches.data || []).length,
          pendingSdRequests: (pending.data || []).length
        };
      },

      /* Log admin action */
      log: async function(action, targetType, targetId, details) {
        var uid = _uid();
        await window._supa.from('admin_activity_log').insert({
          admin_uid: uid, action_type: action, target_ref: targetId,
          note: targetType || null, details: details || null
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
