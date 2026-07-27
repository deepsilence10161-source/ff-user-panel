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
  setTimeout(_loadExtras, 2000);
}

/* ================================================================ L1: USER */
function _bootUser() {
  _loadUser();
  _rtCh('user-' + U.uid, 'users', 'id=eq.' + U.uid, function(p) { if (p.new) _applyUser(p.new); });
  _poll('user', _loadUser, 30000);
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
  UD.bannerImage = UD.bannerImage || '';
  UD.city = sp.city || UD.city || '';
  UD.state = sp.state || UD.state || '';
  UD.referralCode = sp.referral_code || UD.referralCode || '';
  UD.referralCount = sp.referral_count || UD.referralCount || 0;
  /* ✅ Audit Fix: these were never copied onto UD, so:
     - wallet.js's sponsored-tournament withdrawal card always read 0 (button never showed)
     - the "already referred" input-lock in security-patches.js never engaged
     - the first-login referral popup logic could not tell it had already been shown */
  UD.sponsored_winnings = typeof sp.sponsored_winnings === 'number' ? sp.sponsored_winnings : (UD.sponsored_winnings || 0);
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
  UD.lastCheckIn = sp.last_checkin_date || UD.lastCheckIn || '';
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

/* ================================================================ L2+L3: MATCHES */
function _bootMatches() {
  _loadMatches();
  _rtCh('matches-all', 'matches', null, function(p) {
    if ((p.eventType === 'INSERT' || p.eventType === 'UPDATE') && p.new) {
      var m = p.new, st = (m.status || '').toLowerCase();
      if (['cancelled','canceled','deleted','completed'].indexOf(st) !== -1) { delete MT[m.id]; }
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
  _poll('matches', _loadMatches, 30000);
}
function _loadMatches() {
  if (!window._supa) return;
  window._supa.from('matches').select('*').in('status', ['upcoming','live']).order('scheduled_at', { ascending: true })
    .then(function(r) {
      if (!r.data) return;
      for (var k in MT) delete MT[k];
      r.data.forEach(function(m) { MT[m.id] = _toMT(m); });
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
    })(m.entry_type), firstPrize: m.first_prize||m.prize_1st||m.prize_pool||0, maxSlots: m.max_slots||12, filledSlots: _filled, joinedSlots: _filled, matchTime: m.scheduled_at ? new Date(m.scheduled_at).getTime() : 0, roomId: m.room_id||'', roomPassword: m.room_password||'', roomStatus: m.room_id?'released':'pending', bannerUrl: m.banner_url||'', creatorCode: m.creator_code||'', isSponsored: m.is_sponsored||false, prizeDistribution: m.prize_distribution||[], prize1st: m.first_prize||m.prize_1st||m.prize_pool||0,  /* ✅ both names */ prize2nd: m.second_prize||m.prize_2nd||0, prize3rd: m.third_prize||m.prize_3rd||0, perKillPrize: m.per_kill_prize||0, minRank: m.min_rank||null, isFeatured: m.is_featured||false, adsRequired: m.ads_required||2, matchSubType: m.match_sub_type||null, _src:'supabase' };
}

/* ================================================================ L4: JOIN REQUESTS */
function _bootJoinRequests() {
  _loadJR();
  _rtCh('jr-' + U.uid, 'join_requests', 'user_id=eq.' + U.uid, function(p) {
    if (p.new) { JR[p.new.id] = _toJR(p.new); }
    else if (p.eventType === 'DELETE' && p.old) { delete JR[p.old.id]; }
    renderHome(); renderMM(); checkRefunds();
  });
  _poll('jr', _loadJR, 30000);
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
  _poll('notifs', _loadNotifs, 60000);
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
  window._supa.from('notifications').update({ is_read: true }).eq('id', key).eq('user_id', U.uid).catch(function(){});
}
function clearAllNotifs() {
  _notifClearedAt = Date.now();
  if (window._supa) window._supa.from('notifications').update({ is_read: true }).eq('user_id', U.uid).eq('is_read', false).catch(function(){});
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
  _poll('wallet', _loadWalletHistory, 60000);
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
      TXNS = (r.data||[]).map(function(t) { return { _key:t.id, type:(function(tt){
      var _C=['credit','match_win','admin_credit','watch_earn','daily_bonus',
        'referral','check_in','checkin','refund','match_refund','ad_reward',
        'no_show_refund','referral_bonus','gift_coins','bonus','winning','wallet_credit'];
      return _C.indexOf((tt||'').toLowerCase())!==-1?'credit':'debit';
    })(t.txn_type), amount:t.txn_type==='credit'?t.amount:-t.amount, description:t.note||t.reason||'', currency:t.currency||'coins', timestamp:t.created_at?new Date(t.created_at).getTime():0, read:true }; });
      if (curScr==='wallet') renderWallet();
    }).catch(function(e) { console.warn('[L4b]', e.message); });
}

/* ================================================================ L10: REFERRALS */
function _bootReferrals() {
  _loadReferrals();
  _poll('referrals', _loadReferrals, 120000);
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
  _poll('appcfg', function() { if (window.loadAppConfig) loadAppConfig(); }, 300000);
  if (window._supa) {
    window._supa.from('app_settings').select('value').eq('key', 'live_config').single()
      .then(function(r) {
        if (!r.data||!r.data.value) return;
        var cfg = r.data.value;
        if (cfg.ticker) { var tt=$('tickerTxt'); if (tt && !tt.textContent) tt.textContent = cfg.ticker; }
        if (cfg.banner) { var el=$('dynamicBanner'); if (el) { el.style.display='block'; el.textContent=typeof cfg.banner==='string'?cfg.banner:(cfg.banner.text||''); el.style.background=typeof cfg.banner==='object'&&cfg.banner.color?cfg.banner.color:'rgba(0,255,156,.1)'; el.style.color=typeof cfg.banner==='object'&&cfg.banner.textColor?cfg.banner.textColor:'var(--green)'; } }
        if (cfg.payment) PAY = cfg.payment;
      }).catch(function(){});
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
  window._supa.from('user_achievements').select('*').eq('user_id', U.uid).then(function(r) { window._supaAchievements = r.data||[]; }).catch(function(){});
  window._supa.from('user_cosmetics').select('*').eq('user_id', U.uid).then(function(r) { window._supaCosmetics = r.data||[]; }).catch(function(){});
}

window.markNotifRead = markNotifRead;
window.clearAllNotifs = clearAllNotifs;
window.pushLocalNotif = pushLocalNotif;
/* Bug C-3 Fix: Expose channel management for token refresh */
window._cleanupChannels = _cleanupChannels;
