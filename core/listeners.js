/* ================================================================
   LISTENERS.JS — Completely Supabase-based | MiniESports v3.0
   Firebase RTDB = SIRF support/ chat realtime
   Supabase Realtime = Everything else
================================================================ */

var _notifiedRooms = {}, _notifiedDone = {};
var _realtimeChannels = [], _pollTimers = {}, _notifClearedAt = 0;

function _cleanupChannels() {
  /* Bug C-3 Fix: Use ch.unsubscribe() directly on channel object.
     window._supa.removeChannel(ch) fails after token refresh because new
     _supa client doesn't know about channels created on the old client. */
  _realtimeChannels.forEach(function(ch) {
    try {
      if (ch && typeof ch.unsubscribe === 'function') {
        ch.unsubscribe();
      } else {
        window._supa.removeChannel(ch);
      }
    } catch(e) {}
  });
  _realtimeChannels = [];
  Object.keys(_pollTimers).forEach(function(k) { clearInterval(_pollTimers[k]); });
  _pollTimers = {};
}
function _poll(key, fn, ms) {
  if (_pollTimers[key]) clearInterval(_pollTimers[key]);
  fn();
  _pollTimers[key] = setInterval(fn, ms || 30000);
}
function _rtCh(name, table, filter, cb) {
  if (!window._supa) return;
  var ch = window._supa.channel(name)
    .on('postgres_changes', { event: '*', schema: 'public', table: table, filter: filter || undefined }, cb)
    .subscribe(function(st) { if (st === 'SUBSCRIBED') console.log('[RT] ' + name); });
  _realtimeChannels.push(ch);
  return ch;
}

/* ================================================================ BOOT */
/* Bug #17 Fix: TOKEN_REFRESHED → re-subscribe Supabase realtime channels
   Supabase JS v2 does not always recover subscriptions after token refresh.
   We track the _bootChannelSetup function and call it again on refresh. */
/* Bug C-3 Fix: Expose tokenRefreshHandler so db.js can reset it before re-subscribing */
window._tokenRefreshHandler = null;
function _setupTokenRefreshGuard() {
  if (window._tokenRefreshHandler || !window._supa) return;
  window._tokenRefreshHandler = window._supa.auth.onAuthStateChange(function(event) {
    if (event === 'TOKEN_REFRESHED') {
      console.log('[Listeners] TOKEN_REFRESHED — re-checking realtime channels');
      /* Check if any channels dropped (CLOSED state = needs re-sub) */
      var allHealthy = true;
      _realtimeChannels.forEach(function(ch) {
        try {
          var state = ch.state;
          if (state === 'closed' || state === 'errored') allHealthy = false;
        } catch(e) { allHealthy = false; }
      });
      if (!allHealthy) {
        console.log('[Listeners] Dropping stale channels + re-subscribing');
        _cleanupChannels();
        /* Re-run boot channel setup after short delay */
        setTimeout(function() {
          if (window._bootChannelSetup) window._bootChannelSetup();
        }, 1200);
      }
    }
    if (event === 'SIGNED_OUT') {
      _cleanupChannels();
    }
  });
}

/* Bug 69 Fix: Debounced render prevents full DOM rebuild on every MT change */
var _renderDebounceTimer = null;
function _debouncedRender() {
  clearTimeout(_renderDebounceTimer);
  _renderDebounceTimer = setTimeout(function() {
    if (window.renderHome) renderHome();
    if (window.renderSP) renderSP();
    if (window.renderMM) renderMM();
  }, 80); /* 80ms window coalesces burst updates */
}

/* Bug C-3 Fix: _bootChannelSetup is a real function that re-subscribes all
   Realtime channels without re-running the full boot() UI setup.
   Called after token refresh creates new _supa client. */
function _bootChannelSetup() {
  if (!window._supa || !window.U) return;
  /* Cleanup existing channels first (in case called multiple times) */
  _cleanupChannels();
  /* Re-subscribe all Realtime channels */
  _bootUser();
  _bootMatches();
  _bootJoinRequests();
  _bootNotifications();
  _bootWallet();
  _bootReferrals();
  _bootAppSettings();
  /* Re-setup token refresh guard on new _supa */
  window._tokenRefreshHandler = null;
  _setupTokenRefreshGuard();
  console.log('[Boot] Channel re-subscription complete ✅');
}
window._bootChannelSetup = _bootChannelSetup;

function boot() {
  if (!U) return;
  if (window._bootCalled) { console.warn('[Boot] Already called'); return; }
  window._bootCalled = true;
  _setupTokenRefreshGuard();

  /* Show UI — inline style + boot-ready class (CSS fallback) */
  var hd = $('header'),     bn = $('bottomNav'), mc = $('mainContent');
  if (hd) { hd.style.display = ''; hd.classList.add('boot-ready'); }
  if (bn) { bn.style.display = ''; bn.classList.add('boot-ready'); }
  if (mc) { mc.style.display = ''; mc.classList.add('boot-ready'); }

  /* Fix: header ko immediately update karo UD se, blank nahi rehna chahiye */
  try { if (window.updateHdr) updateHdr(); } catch(e) {}

  /* Fix: home screen explicitly activate karo — curScr guard bypass karke
     kyunki curScr = "home" already set hai toh navTo('home') early return karta tha */
  try {
    var scrEl = document.getElementById('scrHome');
    if (scrEl && !scrEl.classList.contains('active')) {
      document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
      scrEl.classList.add('active');
    }
    document.querySelectorAll('.nav-item').forEach(function(n) {
      n.classList.toggle('active', n.dataset.nav === 'home');
    });
  } catch(e) {}

  _bootUser(); _bootMatches(); _bootJoinRequests(); _bootNotifications();
  _bootWallet(); _bootReferrals(); _bootAppSettings(); _bootSupportOnline();
  _startMatchTimers();
  /* ✅ BUG FIX (2026-08-24): was setTimeout 2000ms — delayed cosmetics/
     achievements load meant the store could render with stale/empty
     ownership data if opened quickly after boot. Fire immediately;
     _loadExtras is a cheap indexed SELECT. */
  _loadExtras();
  window._loadExtras = _loadExtras;
}

/* ================================================================ L1: USER */
function _bootUser() {
  _loadUser();
  _rtCh('user-' + U.uid, 'users', 'id=eq.' + U.uid, function(p) { if (p.new) _applyUser(p.new); });
  _poll('user', _loadUser, 15000); /* ✅ SPEED FIX (2026-08-24): tightened safety-net poll — realtime is primary, this only fires if a channel silently drops */
}
function _loadUser() {
  if (!window._supa || !U) return;
  window._supa.from('users').select('*').eq('id', U.uid).single()
    .then(function(r) { if (r.data) _applyUser(r.data); })
    .catch(function(e) { console.warn('[L1]', e.message); });
}
function _applyUser(sp) {
  if (!sp) return;
  if (!UD) UD = {};
  UD.uid = sp.id;
  UD.coins = typeof sp.coins === 'number' ? sp.coins : (UD.coins || 0);
  UD.skyDiamonds = typeof sp.sky_diamonds === 'number' ? sp.sky_diamonds : (UD.skyDiamonds || 0);
  UD.greenDiamonds = typeof sp.green_diamonds === 'number' ? sp.green_diamonds : (UD.greenDiamonds || 0);
  UD.realMoney = { deposited: UD.skyDiamonds, winnings: UD.greenDiamonds, bonus: 0 };
  UD.ign = sp.ign || UD.ign || '';
  UD.displayName = sp.ign || UD.displayName || '';
  UD.email = sp.email || UD.email || '';
  UD.phone = sp.phone || UD.phone || '';
  UD.profileImage = sp.avatar_url || UD.profileImage || '';
  /* ✅ BUG FIX (2026-08-23): "Profile image and banner update hi nahi ho
     rahe". Two separate root causes fixed together —
     (1) users.banner_url didn't exist as a column at all until this
     session; DB.users.update({banner_url:...}) was failing outright
     with a real Postgres 42703 error every time, surfaced to the user
     only as a generic "Network error" toast.
     (2) even for avatar_url (which DID exist and DID save correctly),
     this line never read sp.banner_url into UD.bannerImage at all —
     it only ever preserved whatever was already cached (starts empty,
     never updates), so even a successful banner save would never show
     up here since nothing ever populated it from the DB. */
  UD.bannerImage = sp.banner_url || UD.bannerImage || '';
  UD.city = sp.city || UD.city || '';
  UD.state = sp.state || UD.state || '';
  UD.locationSetAt = sp.location_set_at || UD.locationSetAt || null;
  UD.referralCode = sp.referral_code || UD.referralCode || '';
  UD.referralCount = sp.referral_count || UD.referralCount || 0;
  /* ✅ Audit Fix: these were never copied onto UD, so:
     - wallet.js's sponsored-tournament withdrawal card always read 0 (button never showed)
     - the "already referred" input-lock in security-patches.js never engaged
     - the first-login referral popup logic could not tell it had already been shown */
  UD.sponsored_winnings = typeof sp.sponsored_winnings === 'number' ? sp.sponsored_winnings : (UD.sponsored_winnings || 0);
  /* ✅ BUG FIX (2026-08-23): duo/squad team fields were never mapped back
     into UD at all — db-bridge.js writes to snake_case columns
     (duo_team, squad_team, partner_uid, squad_uids) but nothing copied
     them into the camelCase UD.duoTeam/squadTeam/partnerUid/squadUids
     that saveTM()'s self-check and the profile screen's teammate
     display read. Without this, even a fully successful "Add Teammate"
     save would never visibly reflect anywhere in the UI. */
  UD.duoTeam = sp.duo_team || UD.duoTeam || null;
  UD.squadTeam = sp.squad_team || UD.squadTeam || null;
  UD.partnerUid = sp.partner_uid || UD.partnerUid || '';
  UD.squadUids = sp.squad_uids || UD.squadUids || [];
  /* BUG #19 FIX (2026-07): is_creator was never read into UD anywhere — even a correct
     backend approval would never have reached any UI check for creator status. */
  UD.is_creator = !!sp.is_creator;
  UD.isCreator  = UD.is_creator;
  UD.referredBy = sp.referred_by || UD.referredBy || null;
  UD.referralPopupDone = !!sp.referral_popup_done || !!UD.referralPopupDone;
  UD.clanId = sp.clan_id || UD.clanId || null;
  UD.isBanned = sp.is_banned || false;
  UD.isAdmin = sp.is_admin || false;
  /* ✅ BUG FIX (2026-07-22): age_verified/accepted_policy were never
     mapped here — meaning both only ever got set as a session-local
     override by whichever screen (legal-compliance.js) happened to write
     them, and were lost again on every fresh page load/reload, since
     _applyUser (this function) is the actual source UD is built from.
     This was the root cause of the age-verification screen reappearing
     every session even after the write-side bug (age_verified/
     date_of_birth/age_verified_at not existing as columns at all) is
     fixed — the read-side needs this mapping too, or a freshly-loaded UD
     will never reflect a previously-saved true value. */
  UD.age_verified = !!sp.age_verified;
  UD.accepted_policy = !!sp.accepted_policy;
  UD.profileStatus = sp.profile_status || sp.profileStatus || UD.profileStatus || 'not_requested'; /* ✅ snake_case fix */
  UD.ffUid = sp.ffUid || sp.ff_uid || UD.ffUid || '';
  UD.bio = sp.bio || UD.bio || '';
  UD.stats = { matches: sp.total_matches || 0, wins: sp.total_wins || 0, kills: sp.total_kills || 0, earnings: (UD.stats && UD.stats.earnings) || 0 };
  UD.rankTier = sp.rank_tier || UD.rankTier || 'bronze';
  UD.rankPoints = sp.rank_points || UD.rankPoints || 0;
  UD.loginStreak = sp.streak_days || UD.loginStreak || 0;
  /* ✅ BUG FIX (2026-08-24): needed so checkStreakMilestones() can see
     what's genuinely already claimed (see premium-creator.js) — this
     column didn't exist before this session's migration. */
  UD.streakMilestonesClaimed = sp.streak_milestones_claimed || UD.streakMilestonesClaimed || {};
  UD.lastCheckIn = sp.last_checkin_date || UD.lastCheckIn || '';
  if (window.updateDailyCheckInButton) window.updateDailyCheckInButton();
  /* ── Premium: handle both premium_level (INT) and premium_tier (TEXT) ── */
  var _premTier = 0;
  if (typeof sp.premium_level === 'number' && sp.premium_level >= 0) {
    /* Guide standard: premium_level INT (0=free,1=Silver,2=Gold,3=Diamond) */
    _premTier = sp.premium_level;
  } else if (sp.premium_tier) {
    /* Legacy text field fallback */
    _premTier = ['silver','gold','diamond'].indexOf((sp.premium_tier||'').toLowerCase()) + 1;
  }
  UD.premium = UD.premium || {};
  UD.premium.tier = _premTier;
  var _premExpiry = sp.premium_expires || sp.premium_expires_at || null;
  UD.premium.expiresAt = _premExpiry ? new Date(_premExpiry).getTime() : 0;
  /* Expose as premium_level and premiumLevel for all features */
  UD.premium_level = _premTier;
  UD.premiumLevel  = _premTier;
  if (window._supaCosmetics) UD.cosmetics = window._supaCosmetics;
  if (window._supaAchievements) UD.achievementsV3 = window._supaAchievements;
  if (window.updateHdr) updateHdr();
  if (window.applyState) applyState();
  if (window.renderHome) renderHome();
  if (window.renderProfile) renderProfile();
  if (window.renderWallet) renderWallet();
  if (window.checkStreakBonus) checkStreakBonus();
  updateBell();
  if (window.mesInit) window.mesInit();
}
/* ✅ BUG FIX (2026-08-24): "Green Diamond shows correct value in wallet
   but 0 in header chip". _applyUser is the ONE function that correctly
   maps the raw Supabase row's snake_case columns (green_diamonds,
   sky_diamonds, ...) into the camelCase UD fields every screen actually
   reads (UD.greenDiamonds, UD.skyDiamonds). It was never exposed on
   window, so bugfixes.js's own reconnect-handler fix (which explicitly
   tries to call window._applyUser instead of a raw `UD = u` reassignment)
   always fell through to ITS OWN fallback — which does `Object.assign
   (window.UD, u)`, i.e. dumps the raw snake_case row straight onto UD,
   the exact same bug it was written to avoid. Same root issue existed
   in several boot.js paths that do a hard `window.UD = p` with a raw
   getMe()/create() result. Exporting this here so every one of those
   call sites can now route through the real merge-and-map function
   instead of quietly reintroducing the snake_case bug. */
window._applyUser = _applyUser;

/* ================================================================ L2+L3: MATCHES */
/* BUG FIX (2026-08): "Completed" tab on Home was always empty even when
   matches were genuinely completed in Supabase (and correctly shown in
   Admin Panel's Completed filter). Root cause: _loadMatches() only ever
   queried status IN ('upcoming','live'), and the realtime handler below
   actively deleted a match from MT the moment it turned 'completed'. So
   MT (the in-memory table renderHome() filters against) could never
   contain a completed match — the Completed tab had nothing to show by
   construction, independent of the actual DB state.
   Fix: also load recently-completed matches (last 7 days, capped) on
   boot/poll, and stop deleting completed matches from MT on realtime
   update — just keep them in MT like any other status so the Completed
   tab can find them. Only cancelled/deleted matches are removed outright
   since those should never be shown anywhere. */
function _bootMatches() {
  _loadMatches();
  _rtCh('matches-all', 'matches', null, function(p) {
    if ((p.eventType === 'INSERT' || p.eventType === 'UPDATE') && p.new) {
      var m = p.new, st = (m.status || '').toLowerCase();
      if (['cancelled','canceled','deleted'].indexOf(st) !== -1) { delete MT[m.id]; }
      else { MT[m.id] = _toMT(m); }
      detectChanges();
      /* Bug 69 Fix: Debounce re-renders — rapid successive match updates
         (e.g. admin updates 3 matches in quick succession) would previously
         trigger renderHome+renderSP+renderMM 3×3 = 9 times. Now coalesced to 1. */
      _debouncedRender();
    } else if (p.eventType === 'DELETE' && p.old) {
      delete MT[p.old.id];
      _debouncedRender();
    }
  });
  _poll('matches', _loadMatches, 15000); /* ✅ SPEED FIX (2026-08-24): tightened safety-net poll */
  _bootSponsored();
}
/* ✅ BUG FIX (2026-08-24): sponsored tournaments load + realtime, same
   pattern as _bootMatches above — see SP_T declaration in firebase.js. */
function _bootSponsored() {
  _loadSponsored();
  _rtCh('sponsored-all', 'sponsored_tournaments', null, function(p) {
    if ((p.eventType === 'INSERT' || p.eventType === 'UPDATE') && p.new) {
      SP_T[p.new.id] = p.new;
    } else if (p.eventType === 'DELETE' && p.old) {
      delete SP_T[p.old.id];
    }
    if (window.renderSponsoredTournaments) window.renderSponsoredTournaments();
  });
  _poll('sponsored', _loadSponsored, 15000); /* ✅ SPEED FIX (2026-08-24): tightened safety-net poll */
}
function _loadSponsored() {
  if (!window._supa) return;
  window._supa.from('sponsored_tournaments').select('*').eq('status', 'active').order('created_at', { ascending: false })
    .then(function(r) {
      /* ✅ BUG FIX (2026-08-25): part of the "sponsored tournaments
         blinking" fix (see renderSponsoredTournaments/renderHome for the
         render-side half). This ran every 15s and always cleared SP_T
         completely before refilling it, so for one render cycle SP_T
         (and therefore the sponsored block) was genuinely empty even
         with active tournaments still in the DB — a second, independent
         source of the same blink, on top of the renderHome innerHTML
         wipe. Diff in place instead: only remove ids that are no longer
         active, only touch ids that actually changed, so a still-active
         tournament's DOM never goes through an empty state at all. */
      var freshIds = {};
      (r.data || []).forEach(function(s) { freshIds[s.id] = true; SP_T[s.id] = s; });
      for (var k in SP_T) { if (!freshIds[k]) delete SP_T[k]; }
      if (window.renderSponsoredTournaments) window.renderSponsoredTournaments();
    }, function(e) { console.warn('[sponsored]', e && e.message); });
}
function _loadMatches() {
  if (!window._supa) return;
  var _sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600000).toISOString();
  Promise.all([
    window._supa.from('matches').select('*').in('status', ['upcoming', 'live']).order('scheduled_at', { ascending: true }),
    window._supa.from('matches').select('*').eq('status', 'completed').gte('scheduled_at', _sevenDaysAgo).order('scheduled_at', { ascending: false }).limit(100)
  ]).then(function(results) {
    var r1 = results[0], r2 = results[1];
    if (!r1.data && !r2.data) return;
    for (var k in MT) delete MT[k];
    (r1.data || []).forEach(function(m) { MT[m.id] = _toMT(m); });
    (r2.data || []).forEach(function(m) { MT[m.id] = _toMT(m); });
    detectChanges(); renderHome(); renderSP(); renderMM();
  }).catch(function(e) { console.warn('[L2]', e.message); });
}
function _toMT(m) {
  var _filled = m.filled_slots || 0;
  return { id: m.id, name: m.title, title: m.title, status: m.status||'upcoming', mode: m.mode||'solo', gameMode: m.mode||'solo', map: m.map||'Bermuda', entryFee: m.entry_fee||0, entryType: (function(et){
      if(!et) return 'free';
      et = et.toLowerCase().replace(/_/g,'').replace(/-/g,'');
      if(et==='coin'||et==='coins')            return 'coin';
      if(et==='ad'||et==='ads'||et==='adwatch') return 'ad';
      if(et==='free'||et==='freeentry')         return 'free';
      if(et==='paid'||et==='sky'||et==='skydia'||et==='skydiamond'||et==='sd') return 'paid';
      return 'free';
    })(m.entry_type), firstPrize: m.first_prize||m.prize_1st||m.prize_pool||0, maxSlots: m.max_slots||12, filledSlots: _filled, joinedSlots: _filled, matchTime: m.scheduled_at ? new Date(m.scheduled_at).getTime() : 0, roomId: m.room_id||'', roomPassword: m.room_password||'', roomStatus: m.room_id?'released':'pending', bannerUrl: m.banner_url||'', creatorCode: m.creator_code||'', isSponsored: m.is_sponsored||false, prizeDistribution: m.prize_distribution||[], prize1st: m.first_prize||m.prize_1st||m.prize_pool||0,  /* ✅ both names */ prize2nd: m.second_prize||m.prize_2nd||0, prize3rd: m.third_prize||m.prize_3rd||0, perKillPrize: m.per_kill_prize||0, minRank: m.min_rank||null, isFeatured: m.is_featured||false, adsRequired: m.ads_required||2, matchSubType: m.match_sub_type||null, creatorUid: m.creator_uid||null, _src:'supabase' };
}

/* ================================================================ L4: JOIN REQUESTS */
function _bootJoinRequests() {
  _loadJR();
  _rtCh('jr-' + U.uid, 'join_requests', 'user_id=eq.' + U.uid, function(p) {
    if (p.new) { JR[p.new.id] = _toJR(p.new); }
    else if (p.eventType === 'DELETE' && p.old) { delete JR[p.old.id]; }
    renderHome(); renderMM(); checkRefunds();
  });
  _poll('jr', _loadJR, 15000); /* ✅ SPEED FIX (2026-08-24): tightened safety-net poll */
}
function _loadJR() {
  if (!window._supa || !U) return;
  window._supa.from('join_requests').select('*').eq('user_id', U.uid)
    .then(function(r) {
      JR = {};
      (r.data || []).forEach(function(jr) { JR[jr.id] = _toJR(jr); });
      renderHome(); renderMM(); checkRefunds();
    }).catch(function(e) { console.warn('[L4]', e.message); });
}
function _toJR(jr) {
  return { _key: jr.id, id: jr.id, matchId: jr.match_id, tournamentId: jr.match_id, userId: jr.user_id, uid: jr.user_id, status: jr.status||'pending', entryType: (function(et){
      if(!et) return 'free';
      et = et.toLowerCase().replace(/_/g,'');
      if(et==='coin'||et==='coins') return 'coin';
      if(et==='ad'||et==='ads')     return 'ad';
      if(et==='free')               return 'free';
      return 'paid';
    })(jr.entry_type), entryFee: jr.entry_fee_paid||0, userName: jr.ign_at_join||'', ign: jr.ign_at_join||'', kills: jr.kills||0, rank: jr.placement||0, winnings: jr.prize_earned||0, inRoom: jr.in_room||false, checkedIn: jr.checked_in||false, refunded: jr.status==='refunded', resultStatus: jr.status==='approved'?'done':jr.status, createdAt: jr.created_at ? new Date(jr.created_at).getTime() : 0 };
}

/* ================================================================ L5: NOTIFICATIONS */
function _bootNotifications() {
  _loadNotifs();
  _rtCh('notifs-' + U.uid, 'notifications', 'user_id=eq.' + U.uid, function(p) {
    if (p.eventType === 'INSERT' && p.new) {
      var n = _toNotif(p.new);
      if (_notifClearedAt > 0 && (n.createdAt||0) <= _notifClearedAt) return;
      if (!NOTIFS.some(function(x) { return x._key === n._key; })) {
        NOTIFS.unshift(n); updateBell(); if (curScr === 'notif') renderNotifs();
        var imp = ['result','wallet_approved','wallet_rejected','room_released','admin_alert'];
        if (imp.indexOf(n.type) !== -1) {
          toast('🔔 ' + (n.title || 'New Notification'), (n.type==='result'||n.type==='wallet_approved')?'ok':'inf');
          if (n.type==='result' && n.prize && Number(n.prize)>0 && window.showLootCrate) showLootCrate(n.prize);
        }
      }
    } else if (p.eventType === 'UPDATE' && p.new) {
      NOTIFS.forEach(function(x) { if (x._key===p.new.id) { x.is_read=p.new.is_read; x._localRead=p.new.is_read; } });
      updateBell();
    }
  });
  _poll('notifs', _loadNotifs, 30000); /* ✅ SPEED FIX (2026-08-24): tightened safety-net poll */
}
function _loadNotifs() {
  if (!window._supa || !U) return;
  window._supa.from('notifications').select('*').eq('user_id', U.uid).order('created_at', { ascending: false }).limit(50)
    .then(function(r) {
      NOTIFS = [];
      (r.data || []).forEach(function(n) {
        var m = _toNotif(n);
        if (_notifClearedAt > 0 && (m.createdAt||0) <= _notifClearedAt) return;
        NOTIFS.push(m);
      });
      updateBell(); if (curScr === 'notif') renderNotifs();
    }).catch(function(e) { console.warn('[L5]', e.message); });
}
function _toNotif(n) {
  return { _key: n.id, id: n.id, type: n.type||'system', title: n.title||'', message: n.body||'', body: n.body||'', matchId: n.ref_id||'', targetUserId: n.user_id, createdAt: n.created_at ? new Date(n.created_at).getTime() : Date.now(), timestamp: n.created_at ? new Date(n.created_at).getTime() : Date.now(), _localRead: n.is_read||false, _src:'supabase' };
}
function markNotifRead(key) {
  if (!key || !window._supa) return;
  _READ_KEYS[key] = true;
  window._supa.from('notifications').update({ is_read: true }).eq('id', key).eq('user_id', U.uid).then(null, function(){});
}
function clearAllNotifs() {
  _notifClearedAt = Date.now();
  if (window._supa) window._supa.from('notifications').update({ is_read: true }).eq('user_id', U.uid).eq('is_read', false).then(null, function(){});
  NOTIFS = []; _READ_KEYS = {}; if (UD) UD.readNotifications = {};
  updateBell(); if (curScr === 'notif') renderNotifs(); toast('All notifications cleared', 'ok');
}
function pushLocalNotif(type, title, msg, matchName, matchId) {
  if (NOTIFS.some(function(n) { return n.matchId===matchId && n.type===type; })) return;
  if (!window._supa || !U) return;
  window._supa.from('notifications').insert({ user_id: U.uid, type: type, title: title, body: msg, ref_id: matchId||null })
    .then(function(r) { if (r.data && r.data[0]) { NOTIFS.unshift(_toNotif(r.data[0])); updateBell(); } }).catch(function(){});
}

/* ================================================================ L9: WALLET */
function _bootWallet() {
  _loadWalletHistory(); _loadTransactions();
  _rtCh('wallet-' + U.uid, 'sd_requests', 'user_id=eq.' + U.uid, function(p) {
    if (p.new) {
      var ns=(p.new.status||'').toLowerCase();
      /* ✅ FIX: p.old is null in Supabase Realtime by default — compare against WH cache */
      var _cachedReq = WH.find(function(w){ return w._key===p.new.id; });
      var os = _cachedReq ? (_cachedReq.status||'').toLowerCase() : '';
      if (ns==='approved' && os!=='approved') {
        toast('✅ Sky Diamonds added! 💎'+(p.new.sd_amount||0),'ok');
        if(window.updateHdr) updateHdr();
      } else if (ns==='rejected' && os!=='rejected') {
        toast('❌ Deposit request rejected. Contact support.','err');
      }
      _loadWalletHistory();
    }
  });
  _rtCh('txns-' + U.uid, 'wallet_transactions', 'user_id=eq.' + U.uid, function(p) {
    if (p.eventType==='INSERT') { _loadTransactions(); _loadUser(); }
  });
  _poll('wallet', _loadWalletHistory, 30000); /* ✅ SPEED FIX (2026-08-24): tightened safety-net poll */
}
function _loadWalletHistory() {
  if (!window._supa || !U) return;
  window._supa.from('sd_requests').select('*').eq('user_id', U.uid).order('created_at', { ascending: false }).limit(30)
    .then(function(r) {
      WH = (r.data||[]).map(function(w) { return { _key:w.id, uid:U.uid, amount:w.amount_inr||w.sd_amount||0, sdAmount:w.sd_amount||0, type:'deposit', status:w.status||'pending', utr:w.upi_ref||'', screenshotUrl:w.screenshot_url||'', createdAt:w.created_at?new Date(w.created_at).getTime():0 }; });
      WH.sort(function(a,b) { return (b.createdAt||0)-(a.createdAt||0); });
      if (curScr==='wallet') renderWallet();
    }).catch(function(e) { console.warn('[L9]', e.message); });
}
function _loadTransactions() {
  if (!window._supa || !U) return;
  window._supa.from('wallet_transactions').select('*').eq('user_id', U.uid).order('created_at', { ascending: false }).limit(50)
    .then(function(r) {
      TXNS = (r.data||[]).map(function(t) {
        var _C=['credit','match_win','admin_credit','watch_earn','daily_bonus',
          'referral','check_in','checkin','refund','match_refund','ad_reward',
          'no_show_refund','referral_bonus','gift_coins','bonus','winning','wallet_credit'];
        /* ✅ BUG FIX (2026-08-23): two related bugs fixed together —
           (1) this allow-list only recognized the literal word 'credit',
           not other genuinely-credit txn_type strings written elsewhere
           in the stack (e.g. 'sky_diamond_credit', 'sd_purchase_approved').
           Anything unrecognized became 'debit' and displayed as a fake
           "🎮 Entry Fee" (wallet.js typeMap). The specific duplicate
           write that triggered this is fixed at the source
           (admin-inline.js approveSkyDiaReq no longer double-writes),
           but keeping this purely allow-list-based means any future new
           txn_type string would silently misfire the same way — so
           reason strings ending in _credit/_bonus/_paid/_refund/
           _approved/_win are now also treated as credits.
           (2) `amount:t.txn_type==='credit'?t.amount:-t.amount` used to
           check the RAW t.txn_type against the literal string 'credit'
           again, independently of the classification just computed —
           so even after correctly classifying e.g. 'sky_diamond_credit'
           as type:'credit' for display, the amount sign check right
           next to it used a DIFFERENT, narrower test and still negated
           it. Both now derive from the same single classification. */
        var t2 = (t.txn_type||'').toLowerCase();
        var isCredit = _C.indexOf(t2) !== -1 || /_(credit|bonus|paid|refund|approved|win)$/.test(t2);
        return { _key:t.id, type: isCredit ? 'credit' : 'debit',
          amount: isCredit ? t.amount : -t.amount,
          description:t.note||t.reason||'', currency:t.currency||'coins',
          timestamp:t.created_at?new Date(t.created_at).getTime():0, read:true };
      });
      if (curScr==='wallet') renderWallet();
    }).catch(function(e) { console.warn('[L4b]', e.message); });
}

/* ================================================================ L10: REFERRALS */
function _bootReferrals() {
  _loadReferrals();
  _poll('referrals', _loadReferrals, 60000); /* ✅ SPEED FIX (2026-08-24): tightened safety-net poll — now backed by realtime above too */
  /* ✅ SPEED FIX (2026-08-24): referrals had zero realtime channel —
     purely a 120s poll. `referrals` is now in the supabase_realtime
     publication (this session's DB delta), so a new referral (or
     join-bonus getting paid) now shows up instantly instead of up to
     2 minutes later. */
  _rtCh('referrals-' + U.uid, 'referrals', 'referrer_id=eq.' + U.uid, function() { _loadReferrals(); });
}
function _loadReferrals() {
  if (!window._supa || !U) return;
  window._supa.from('referrals').select('*, referred:users!referred_id(ign, avatar_url)').eq('referrer_id', U.uid)
    .then(function(r) {
      REFS = (r.data||[]).map(function(ref) { return { referredUid:ref.referred_id, referredName:ref.referred&&ref.referred.ign||'Player', createdAt:ref.created_at?new Date(ref.created_at).getTime():0, joinBonusPaid:ref.join_bonus_paid||false }; });
      if (curScr==='profile') renderProfile();
    }).catch(function(){});
}

/* ================================================================ APP SETTINGS */
function _bootAppSettings() {
  if (window.loadAppConfig) loadAppConfig();
  _poll('appcfg', function() { if (window.loadAppConfig) loadAppConfig(); }, 60000); /* ✅ SPEED FIX (2026-08-24): was 5 minutes — tightened safety-net; live_config realtime channel above is now primary */
  if (window._supa) {
    function _loadLiveConfig() {
      window._supa.from('app_settings').select('value').eq('key', 'live_config').single()
        .then(function(r) {
          if (!r.data||!r.data.value) return;
          var cfg = r.data.value;
          if (cfg.ticker) { var tt=$('tickerTxt'); if (tt) tt.textContent = cfg.ticker; }
          if (cfg.banner) { var el=$('dynamicBanner'); if (el) { el.style.display='block'; el.textContent=typeof cfg.banner==='string'?cfg.banner:(cfg.banner.text||''); el.style.background=typeof cfg.banner==='object'&&cfg.banner.color?cfg.banner.color:'rgba(0,255,156,.1)'; el.style.color=typeof cfg.banner==='object'&&cfg.banner.textColor?cfg.banner.textColor:'var(--green)'; } }
          if (cfg.payment) PAY = cfg.payment;
        }).catch(function(){});
    }
    _loadLiveConfig();
    /* ✅ SPEED FIX (2026-08-24): app_settings had a 5-MINUTE poll and no
       realtime channel — the slowest data path in the whole app. If
       admin updates the ticker/banner, users could wait up to 5 minutes
       to see it. app_settings is already in the publication (an earlier
       session added it for maintenance-mode). Also removed the
       "!tt.textContent" guard on ticker — that silently prevented ANY
       ticker update after the very first one ever set, forever, since
       textContent is never empty once set once. */
    window._supa.channel('app-settings-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings', filter: 'key=eq.live_config' }, _loadLiveConfig)
      .subscribe();
  }
}

/* ================================================================ SUPPORT ONLINE (only Firebase RTDB call remaining) */
function _bootSupportOnline() {
  /* support.js ke startChat() mein Firebase RTDB use hota hai for chat — woh wahan hi rahega */
  /* Sirf supportOnline status ke liye — ye safe hai */
  if (window.db) { window.db.ref('appSettings/supportOnline').on('value', function(s) {}); }
}

/* ================================================================ DETECT CHANGES */
function detectChanges() {
  var newKeys = {};
  for (var k in MT) newKeys[k] = true;
  for (var k in newKeys) {
    var t = MT[k]; if (!t) continue;
    if (t.roomId && t.roomPassword && !prevMTKeys[k+'_room']) {
      prevMTKeys[k+'_room'] = true;
      if (hasJ(k)) {
        pushLocalNotif('room_released', '🔑 Room Details Released!', 'Room ID & Password ready for "' + (t.name||'Match') + '". Tap to view.', t.name, k);
        toast('🔑 Room ID released! Bell icon tap karo.', 'ok');
        if (navigator.vibrate) navigator.vibrate([200,100,200]);
        setTimeout(function(match) { if (window.showRP) showRP(match); }.bind(null, t), 600);
      }
    }
    var st = (t.status||'').toLowerCase();
    if ((st==='completed'||st==='finished'||st==='ended') && !prevMTKeys[k+'_done']) {
      prevMTKeys[k+'_done'] = true;
      if (hasJ(k)) pushLocalNotif('match_completed', '✅ Match Completed!', '"' + (t.name||'Match') + '" has ended. Results soon.', t.name, k);
    }
  }
  for (var k in newKeys) prevMTKeys[k] = true;
}

/* ================================================================ TIMERS */
function _startMatchTimers() {
  function fmtCd(ms) {
    if (ms<=0) return 'Starting soon...';
    var h=Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000), s=Math.floor((ms%60000)/1000);
    if (h>0) return h+'h '+m+'m'; if (m>5) return m+'m '+s+'s'; return (m>0?m+'m ':'') + s+'s';
  }
  setInterval(function() {
    var now = Date.now();
    for (var mid in MT) {
      var el=document.getElementById('timer-'+mid); if (!el) continue;
      var t=MT[mid], mt=Number(t.matchTime)||0, diff=mt-now, es=effSt(t);
      if (!mt) { el.textContent=''; continue; }
      if (es==='live') { el.style.color='#ff4455'; el.textContent='🔴 LIVE'; }
      else if (es==='completed') { el.style.color='var(--txt2)'; el.textContent='Ended'; }
      else if (diff>0) { el.style.color=diff<300000?'#ff9900':'#ffaa00'; el.textContent='⏱ '+fmtCd(diff); }
      else { el.textContent=''; }
    }
  }, 1000);
  setInterval(function() {
    var need=false;
    for (var mid in MT) { var t=MT[mid], ns=effSt(t); if (!t._lastSt) t._lastSt=ns; if (t._lastSt!==ns) { t._lastSt=ns; need=true; } }
    if (need) { renderHome(); renderSP(); renderMM(); }
  }, 5000);
}
window.startMatchTimers = _startMatchTimers;

function _loadExtras() {
  if (!window._supa || !U) return;
  window._supa.from('user_achievements').select('*').eq('user_id', U.uid).then(function(r) { window._supaAchievements = r.data||[]; }, function(){});
  /* ✅ BUG FIX (2026-08-23): "Cosmetic store me kharida hua item bhi
     unlock nahi dikhta, dobara buy karne ka option aata rehta hai".
     The purchase itself (purchase_cosmetic RPC) was working fine and
     the row really was landing in user_cosmetics — confirmed live: a
     purchased frame_fire row existed in the DB while the store still
     showed it as buyable. Root cause: this stored the raw Supabase
     response as an ARRAY of rows, but every screen that reads
     UD.cosmetics (growth.js's renderCosmeticCards: `owned[c.id]`)
     expects an OBJECT keyed by cosmetic_key — `owned['frame_fire']` on
     an array is always undefined (arrays index numerically), so
     isOwned was unconditionally false regardless of what was actually
     purchased. Now keyed by cosmetic_key at the source, matching what
     every consumer already expects. */
  window._supa.from('user_cosmetics').select('*').eq('user_id', U.uid).then(function(r) {
    var keyed = {};
    (r.data || []).forEach(function(row) { keyed[row.cosmetic_key] = row; });
    window._supaCosmetics = keyed;
    /* ✅ BUG FIX (2026-08-24): "Buy karne ke baad Owned dikhta hai, but
       refresh karne par phir se Buy aa jata hai — fake owned". Root
       cause: window._supaCosmetics is only assigned here, 2s after boot,
       via an un-awaited async call — but UD.cosmetics is only ever
       copied FROM window._supaCosmetics inside _applyUser (see above),
       which typically already ran (from the initial _loadUser) well
       before this promise resolves. Nothing re-ran _applyUser or
       re-rendered anything once this data actually landed, so UD.cosmetics
       stayed undefined for the rest of the session (until the next
       realtime users-row update or 30s poll happened to fire) — the
       store kept reading an empty owned{} and showed "Buy" on truly
       owned items every single load. Now we push it into UD directly
       the moment it arrives, and re-render the store if it's open. */
    if (!window.UD) window.UD = {};
    window.UD.cosmetics = keyed;
    if (document.getElementById('cosmeticsList') && window.filterCosmetics) {
      var activeTab = ['all','frames','tags','vip'].filter(function(t) {
        var b = document.getElementById('cosTab_' + t);
        return b && b.style.background === 'rgb(0, 212, 255)';
      })[0] || 'all';
      window.filterCosmetics(activeTab);
    }
  }, function(){});
}

window.markNotifRead = markNotifRead;
window.clearAllNotifs = clearAllNotifs;
window.pushLocalNotif = pushLocalNotif;
/* Bug C-3 Fix: Expose channel management for token refresh */
window._cleanupChannels = _cleanupChannels;
