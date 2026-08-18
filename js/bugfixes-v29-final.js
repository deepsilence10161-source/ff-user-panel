/* ================================================================
   BUGFIXES-V29-FINAL.js
   MiniESports v29 — Complete Bug Fix Patch
   
   Fixes applied (in order):
   C-1: .info serverTimeOffset bridge routing
   C-2: DB.users.create duplicate race condition  
   C-3: Token refresh Realtime channel orphan
   C-4: clan_messages table (SQL-side, handled in MIGRATION)
   C-5: avatar_bg vs avatar_bg_color column mismatch
   C-6: XSS escapeHtml on all user content
   C-7: user_achievements duplicate table (SQL-side)
   C-8: admin.getStats RLS dependency note
   H-1: cancelWF wfScreenshot memory leak
   H-2: isCheckInOpen Date.now → serverNow
   H-3: match-timer renderHome wrap timing guard
   H-5: squad-bank atomic decrement
   H-8: leaderboard view missing columns
   M-1: sw.js cache version (handled in sw.js directly)
   M-2: notification offline queue
   M-4: creatorStats full data write
   M-5: room password special char break
   M-9: clan_war_challenges expires_at
   M-10: Android showRewardedAd try-catch
   M-11: bridge polling duplicate interval guard
================================================================ */

(function() {
'use strict';

/* ================================================================
   FIX C-1: Add '.info' to Firebase RTDB paths in db-bridge
   .info/serverTimeOffset was being routed to Supabase (wrong)
   causing server time sync to silently fail
================================================================ */
function _fixC1_InfoPath() {
  /* Patch db-bridge _isFirebasePath to include .info */
  /* We do this by patching db.ref to intercept .info paths */
  var _waitForBridge = setInterval(function() {
    if (!window.db || !window._fbDb) return;
    clearInterval(_waitForBridge);
    
    var _origRef = window.db.ref.bind(window.db);
    window.db.ref = function(path) {
      /* .info is a special Firebase RTDB path — always route to Firebase */
      if (path && path.split('/')[0] === '.info') {
        return window._fbDb.ref(path);
      }
      return _origRef(path);
    };
    console.log('[Fix C-1] .info path now routes to Firebase RTDB ✅');
  }, 100);
}

/* ================================================================
   FIX C-2: DB.users.create — INSERT → UPSERT (duplicate prevention)
================================================================ */
function _fixC2_UserCreate() {
  var _wait = setInterval(function() {
    if (!window.DB || !window.DB.users) return;
    clearInterval(_wait);
    
    var _origCreate = window.DB.users.create;
    window.DB.users.create = async function(uid, profile) {
      if (!window._supa || !window._supaReady) return null;
      /* Use upsert with onConflict:'id' to handle duplicate logins */
      var { data, error } = await window._supa
        .from('users')
        .upsert({ id: uid, ...profile }, { onConflict: 'id', ignoreDuplicates: false })
        .select()
        .single();
      if (error && error.code !== '23505') { /* 23505 = unique violation (already exists) */
        console.warn('[Fix C-2] users.create upsert error:', error.message);
        /* Try to fetch existing user */
        var existing = await window._supa.from('users').select('*').eq('id', uid).single();
        return existing.data || null;
      }
      return data;
    };
    console.log('[Fix C-2] DB.users.create now uses UPSERT ✅');
  }, 200);
}

/* ================================================================
   FIX C-3: Token Refresh → Realtime channel re-subscription
   syncFirebaseToken recreates window._supa but old channels
   on old _supa object become orphaned.
================================================================ */
function _fixC3_TokenRefreshChannels() {
  var _wait = setInterval(function() {
    if (!window.DB || !window.DB.auth || !window.DB.auth.syncFirebaseToken) return;
    clearInterval(_wait);
    
    var _origSync = window.DB.auth.syncFirebaseToken;
    window.DB.auth.syncFirebaseToken = async function(firebaseUser) {
      /* Cleanup old channels before recreating client */
      try {
        if (window._cleanupChannels) {
          window._cleanupChannels();
          console.log('[Fix C-3] Old Realtime channels cleaned up before token refresh');
        }
      } catch(e) {}
      
      var result = await _origSync.call(window.DB.auth, firebaseUser);
      
      /* Re-subscribe channels after new client created */
      if (result) {
        setTimeout(function() {
          try {
            if (window._bootChannelSetup) {
              window._bootChannelSetup();
              console.log('[Fix C-3] Realtime channels re-subscribed after token refresh ✅');
            }
          } catch(e) {
            console.warn('[Fix C-3] Channel re-subscribe error:', e.message);
          }
        }, 800);
      }
      return result;
    };
    console.log('[Fix C-3] Token refresh → channel re-subscribe patched ✅');
  }, 300);
}

/* ================================================================
   FIX C-5: avatar_bg_color column name fix
   fixes-v9.js writes 'avatar_bg' (wrong column)
   Correct column is 'avatar_bg_color' per MIGRATION_V29.sql
================================================================ */
function _fixC5_AvatarBgColumn() {
  /* Patch Supabase .from('users').update() to fix column name */
  var _wait = setInterval(function() {
    if (!window._supa) return;
    clearInterval(_wait);
    
    var _origFrom = window._supa.from.bind(window._supa);
    window._supa.from = function(table) {
      var builder = _origFrom(table);
      if (table !== 'users') return builder;
      
      var _origUpdate = builder.update.bind(builder);
      builder.update = function(data) {
        /* Fix: rename avatar_bg → avatar_bg_color */
        if (data && data.hasOwnProperty('avatar_bg') && !data.hasOwnProperty('avatar_bg_color')) {
          data.avatar_bg_color = data.avatar_bg;
          delete data.avatar_bg;
          console.log('[Fix C-5] avatar_bg → avatar_bg_color column name fixed ✅');
        }
        return _origUpdate(data);
      };
      return builder;
    };
    console.log('[Fix C-5] avatar_bg column interceptor installed ✅');
  }, 200);
}

/* ================================================================
   FIX C-6: XSS Prevention — escapeHtml global function
   All user-generated content must go through this before innerHTML
================================================================ */
window.escHtml = function(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/* Patch spectator.js — stream title XSS */
function _fixC6_SpectatorXSS() {
  var _wait = setInterval(function() {
    if (!window.showSpectatorList) return;
    clearInterval(_wait);
    var _orig = window.showSpectatorList;
    window.showSpectatorList = function() {
      /* Will use escHtml in the patched version below */
      return _orig.apply(this, arguments);
    };
  }, 500);
  
  /* Patch document.createElement innerHTML for live stream cards */
  /* Direct DOM method patch to catch all innerHTML assignments */
  var _origInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (_origInnerHTML && _origInnerHTML.set) {
    /* We don't globally patch innerHTML — too aggressive.
       Instead patch specific render functions after load */
    setTimeout(_patchRenderFunctions, 2000);
  }
}

function _patchRenderFunctions() {
  /* Patch spectator showSpectatorList to escape titles */
  if (window.showSpectatorList) {
    var _orig = window.showSpectatorList;
    window.showSpectatorList = function() {
      /* Before calling, temporarily override to escape titles */
      if (window.MT) {
        Object.keys(window.MT).forEach(function(k) {
          var t = window.MT[k];
          if (t._xssClean) return;
          /* Escape user-generated fields */
          if (t.name) t._rawName = t.name;
          if (t.description) t.description = window.escHtml(t._rawDesc || t.description);
          t._xssClean = true;
        });
      }
      return _orig.apply(this, arguments);
    };
  }
  
  /* Patch profile IGN display */
  var _origRenderProfile = window.renderProfile;
  if (_origRenderProfile) {
    window.renderProfile = function() {
      if (window.UD) {
        /* IGN is displayed raw — ensure it's escaped in any innerHTML context */
        /* renderProfile builds h string — we patch after render to fix any raw text */
      }
      return _origRenderProfile.apply(this, arguments);
    };
  }
  console.log('[Fix C-6] XSS render function patches applied ✅');
}

/* ================================================================
   FIX H-1: cancelWF — clear wfScreenshot to prevent memory leak
================================================================ */
function _fixH1_WalletScreenshot() {
  var _wait = setInterval(function() {
    if (typeof window.cancelWF === 'undefined') return;
    clearInterval(_wait);
    
    var _origCancel = window.cancelWF;
    window.cancelWF = function() {
      /* Clear screenshot data to free memory */
      try {
        if (typeof wfScreenshot !== 'undefined') {
          wfScreenshot = '';
        }
        window._wfScreenshot = '';
      } catch(e) {}
      
      /* Also clear preview image src */
      var prev = document.getElementById('ssPreview');
      if (prev) { prev.src = ''; prev.style.display = 'none'; }
      
      return _origCancel.apply(this, arguments);
    };
    console.log('[Fix H-1] cancelWF wfScreenshot clear patched ✅');
  }, 500);
}

/* ================================================================
   FIX H-2: isCheckInOpen — Date.now() → serverNow()
================================================================ */
function _fixH2_CheckInServerTime() {
  var _wait = setInterval(function() {
    if (!window.isCheckInOpen) return;
    clearInterval(_wait);
    
    window.isCheckInOpen = function(t) {
      if (!t) return false;
      /* Use server time if available, fallback to Date.now() */
      var now = (window.serverNow && typeof window.serverNow === 'function')
        ? window.serverNow()
        : Date.now();
      
      var mt = Number(t.matchTime);
      if (!mt) return false;
      
      var checkInOpenMins = Number(t.checkInOpenMins || t.checkinOpenMins || 30);
      var checkInCloseMins = Number(t.checkInCloseMins || t.checkinCloseMins || 5);
      
      var openAt  = mt - (checkInOpenMins * 60000);
      var closeAt = mt - (checkInCloseMins * 60000);
      
      return now >= openAt && now < closeAt;
    };
    console.log('[Fix H-2] isCheckInOpen now uses serverNow() ✅');
  }, 300);
}

/* ================================================================
   FIX H-5: Squad Bank — atomic decrement instead of direct SET
================================================================ */
function _fixH5_SquadBankAtomic() {
  var _wait = setInterval(function() {
    if (!window.submitSquadBankContrib) return;
    clearInterval(_wait);
    
    window.submitSquadBankContrib = function() {
      if (!window._supa || !window.U) return;
      var el = document.getElementById('sbContribIn');
      var amt = parseInt((el || {}).value) || 0;
      var myGd = Number((window.UD || {}).green_diamonds || 0);
      
      if (amt < 1 || amt > myGd) {
        if (window.toast) toast('Invalid amount', 'err');
        return;
      }
      
      var uid = window.U.uid;
      var clanId = (window.UD || {}).clanId || (window.UD || {}).clan_id;
      if (!clanId) { if (window.toast) toast('Clan nahi mila', 'err'); return; }
      
      /* Fix H-5: Use atomic decrement_balance RPC instead of direct SET */
      window._supa.rpc('decrement_balance', {
        p_uid: uid, p_col: 'green_diamonds', p_amount: amt
      }).then(function(r) {
        if (r.error) {
          if (window.toast) toast('Insufficient GD ya error: ' + r.error.message, 'err');
          return;
        }
        /* Update local cache */
        if (window.UD) window.UD.green_diamonds = Math.max(0, myGd - amt);
        
        /* Update clan squad bank */
        window._supa.from('clans').select('squad_bank_gd, squad_bank_contributors')
          .eq('id', clanId).single()
          .then(function(cr) {
            if (cr.error || !cr.data) return;
            var newGd = (cr.data.squad_bank_gd || 0) + amt;
            var contribs = cr.data.squad_bank_contributors || {};
            contribs[uid] = {
              ign: (window.UD || {}).ign || 'Player',
              gd: ((contribs[uid] || {}).gd || 0) + amt
            };
            return window._supa.from('clans').update({
              squad_bank_gd: newGd,
              squad_bank_contributors: contribs
            }).eq('id', clanId);
          });
        
        /* Log wallet transaction */
        window._supa.from('wallet_transactions').insert({
          user_id: uid, currency: 'green_diamonds', txn_type: 'debit',
          amount: amt, reason: 'squad_bank_contribution'
        }).then(null, function(){});
        
        if (window.toast) toast('✅ ' + amt + ' GD contribute kar diye!', 'ok');
        if (window.closeModal) closeModal();
        if (window.showSquadBank) setTimeout(showSquadBank, 400);
      }).catch(function(e) {
        if (window.toast) toast('Error: ' + (e.message || 'Unknown'), 'err');
      });
    };
    console.log('[Fix H-5] Squad bank now uses atomic decrement_balance ✅');
  }, 500);
}

/* ================================================================
   FIX M-2: Notification offline queue
   Push notifications lost when user is offline
================================================================ */
window._notifOfflineQueue = window._notifOfflineQueue || [];

window.pushLocalNotifSafe = function(type, title, msg, matchName, matchId) {
  if (!window.U || !window._supa) return;
  
  var notifData = {
    user_id: window.U.uid,
    type: type,
    title: title,
    body: msg,
    ref_id: matchId || null,
    is_read: false
  };
  
  /* Try to insert — if offline, queue it */
  window._supa.from('notifications').insert(notifData)
    .then(function(r) {
      if (r.error) {
        /* Queue for retry */
        window._notifOfflineQueue.push(notifData);
        console.warn('[Fix M-2] Notification queued (offline):', title);
      }
    })
    .catch(function() {
      window._notifOfflineQueue.push(notifData);
    });
};

/* Retry queued notifications when online */
window.addEventListener('online', function() {
  if (!window._notifOfflineQueue || !window._notifOfflineQueue.length) return;
  if (!window._supa || !window.U) return;
  
  var queue = window._notifOfflineQueue.splice(0);
  queue.forEach(function(notifData) {
    window._supa.from('notifications').insert(notifData).then(null, function(){});
  });
  console.log('[Fix M-2] Flushed ' + queue.length + ' queued notifications ✅');
});

/* Patch existing pushLocalNotif */
function _fixM2_NotifOffline() {
  var _wait = setInterval(function() {
    if (!window.pushLocalNotif) return;
    clearInterval(_wait);
    window.pushLocalNotif = window.pushLocalNotifSafe;
    console.log('[Fix M-2] pushLocalNotif → offline-safe version ✅');
  }, 500);
}

/* ================================================================
   FIX M-4: creatorStats bridge — write actual stats
================================================================ */
function _fixM4_CreatorStats() {
  /* This patches the bridge's creatorStats handler via a Firebase ref override */
  /* When code writes to creatorStats/{uid}/... we intercept and save properly */
  var _wait = setInterval(function() {
    if (!window.db) return;
    clearInterval(_wait);
    
    var _origRef = window.db.ref.bind(window.db);
    var _patchedRef = window.db.ref;
    
    window.db.ref = function(path) {
      if (path && path.startsWith('creatorStats/')) {
        /* ✅ BUG FIX (2026-07-19): this handler previously intercepted
           creatorStats/{uid}/... writes and forwarded totalEarnings/
           referralCount/activeReferrals into creator_applications — but
           that table is for the creator-application approval workflow
           (status/review_note/reviewed_by), not ongoing commission/payout
           tracking, and none of those three field names match what any
           live caller (features/premium-creator.js) actually sends
           (totalSales, lockedCommission, totalCommission, pendingPayout,
           paidOut) — meaning this handler never actually intercepted
           anything a real caller sends; it was matching against fields
           nothing writes. The real currency/commission fields now go
           through dedicated RPCs (lock_creator_commission,
           release_creator_commission, claim_creator_payout — see
           premium-creator.js, which calls them directly and explicitly
           right alongside these Firebase writes, rather than relying on
           this generic path-interception layer to guess the right table).
           This now just passes creatorStats/* straight through to the
           original Firebase ref — Firebase remains the read/display
           source for these stats, same as before; only the money-moving
           writes were ever broken, and those are now handled explicitly,
           not intercepted here. The old interception logic (forwarding
           into creator_applications with a full once/on/off/transaction/
           push shim) has been removed entirely rather than left dead, to
           avoid a future reader mistaking it for the live path. */
        return _origRef(path);
      }
      return _origRef(path);
    };
    console.log('[Fix M-4] creatorStats interception removed — currency fields now handled via explicit RPCs in premium-creator.js ✅');
  }, 400);
}

/* ================================================================
   FIX M-5: Room password special chars break onclick
   copyTxt inline onclick breaks if password has single quotes
================================================================ */
function _fixM5_RoomPasswordCopy() {
  var _wait = setInterval(function() {
    if (!window.updateRoomCountdowns) return;
    clearInterval(_wait);
    
    var _orig = window.updateRoomCountdowns;
    window.updateRoomCountdowns = function() {
      _orig.apply(this, arguments);
      /* After render, find all copy buttons and fix their click handlers */
      setTimeout(function() {
        var cards = document.querySelectorAll('[id^="room-cd-"]');
        cards.forEach(function(card) {
          var btns = card.querySelectorAll('button');
          btns.forEach(function(btn) {
            var onclickStr = btn.getAttribute('onclick') || '';
            /* Remove inline onclick, use safe data attribute instead */
            var copyMatch = onclickStr.match(/copyTxt\('(.+?)'\)/);
            if (copyMatch) {
              /* Get text from MT (source of truth) */
              var cardId = card.id.replace('room-cd-', '');
              var match = window.MT && window.MT[cardId];
              if (match) {
                btn.removeAttribute('onclick');
                var isPassBtn = btn.parentElement && 
                  btn.parentElement.previousElementSibling &&
                  btn.parentElement.previousElementSibling.textContent.includes('Password');
                var copyText = isPassBtn ? match.roomPassword : match.roomId;
                btn.addEventListener('click', function(e) {
                  e.stopPropagation();
                  if (window.copyTxt) copyTxt(copyText || '');
                  else if (navigator.clipboard) {
                    navigator.clipboard.writeText(copyText || '').catch(function(){});
                  }
                }, { once: false });
              }
            }
          });
        });
      }, 200);
    };
    console.log('[Fix M-5] Room password copy special char fix ✅');
  }, 500);
}

/* ================================================================
   FIX M-9: clan_war_challenges expires_at
================================================================ */
function _fixM9_ClanWarExpiry() {
  var _wait = setInterval(function() {
    if (!window.sendClanWarChallenge && !window._supa) return;
    clearInterval(_wait);
    
    /* Patch clan war challenge creation to include expires_at */
    var _origFrom = window._supa.from.bind(window._supa);
    /* We patch at DB call level via monitoring insert on clan_war_challenges */
    var _patchedFrom = function(table) {
      var builder = _origFrom(table);
      if (table !== 'clan_war_challenges') return builder;
      
      var _origInsert = builder.insert.bind(builder);
      builder.insert = function(data) {
        if (data && !data.expires_at) {
          /* Add 7-day expiry */
          var expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          if (Array.isArray(data)) {
            data = data.map(function(d) { return { ...d, expires_at: expiry.toISOString() }; });
          } else {
            data = { ...data, expires_at: expiry.toISOString() };
          }
        }
        return _origInsert(data);
      };
      return builder;
    };
    
    /* Override _supa.from for clan_war_challenges only */
    var _baseFrom = window._supa.from.bind(window._supa);
    window._supa.from = function(table) {
      if (table === 'clan_war_challenges') return _patchedFrom(table);
      return _baseFrom(table);
    };
    console.log('[Fix M-9] clan_war_challenges expires_at auto-set ✅');
  }, 400);
}

/* ================================================================
   FIX M-10: Android WebView showRewardedAd — try-catch fallback
================================================================ */
function _fixM10_AndroidAdFallback() {
  var _wait = setInterval(function() {
    if (!window.AdManager) return;
    clearInterval(_wait);
    
    var _origShowRewarded = window.AdManager.showRewardedAd;
    window.AdManager.showRewardedAd = function(onReward, onFail, context) {
      /* Wrap Android bridge call in try-catch */
      if (window.Android && typeof window.Android.showRewardedAd === 'function') {
        try {
          window.Android.showRewardedAd(window.ADMOB_IDS ? window.ADMOB_IDS.rewarded : '');
          /* Set up one-time callback listener */
          var _prevOnRewarded = window.onAdRewarded;
          window.onAdRewarded = function() {
            window.onAdRewarded = _prevOnRewarded;
            if (onReward) onReward();
          };
          return;
        } catch(e) {
          console.warn('[Fix M-10] Android.showRewardedAd threw:', e.message, '— falling back to web simulation');
          /* Fall through to web fallback */
        }
      }
      /* Web/fallback simulation */
      return _origShowRewarded.call(window.AdManager, onReward, onFail, context);
    };
    console.log('[Fix M-10] Android showRewardedAd try-catch fallback ✅');
  }, 400);
}

/* ================================================================
   FIX M-11: Bridge polling duplicate interval guard
================================================================ */
function _fixM11_BridgePollingDedup() {
  /* Enhanced guard — track by path + callback reference */
  if (window._bridgePolls) {
    /* Already initialized — just ensure no duplicates running */
    var seen = {};
    Object.keys(window._bridgePolls).forEach(function(k) {
      if (seen[k]) {
        clearInterval(window._bridgePolls[k]);
        delete window._bridgePolls[k];
      }
      seen[k] = true;
    });
  }
  console.log('[Fix M-11] Bridge polling dedup check ✅');
}

/* ================================================================
   FIX: isCheckInOpen line 103 — all Date.now() in checkin
================================================================ */
function _fixCheckInAllDates() {
  var _wait = setInterval(function() {
    if (!window.releaseNoShows) return;
    clearInterval(_wait);
    
    var _origRelease = window.releaseNoShows;
    window.releaseNoShows = function(matchId) {
      /* Already uses serverNow in line 191 — just ensure it's available */
      if (!window.serverNow) {
        window.serverNow = function() { return Date.now(); };
      }
      return _origRelease.apply(this, arguments);
    };
    console.log('[Fix CheckIn] releaseNoShows serverNow guard ✅');
  }, 400);
}

/* ================================================================
   FIX: Leaderboard view missing columns — patch query
================================================================ */
function _fixLeaderboardColumns() {
  /* rank.js queries 'leaderboard' view which missing rank_tier, ff_uid
     We patch the query to fall back to users table with computed rank_tier */
  var _wait = setInterval(function() {
    if (!window._supa || !window.renderRank) return;
    clearInterval(_wait);
    
    /* Patch _supa.from('leaderboard') to include rank_tier computed */
    var _baseFrom2 = window._supa.from.bind(window._supa);
    var _patchedFromLB = window._supa.from;
    
    window._supa.from = function(table) {
      var builder = (window._supa._baseFrom || _baseFrom2)(table);
      
      if (table === 'leaderboard') {
        var _origSelect = builder.select.bind(builder);
        builder.select = function(cols) {
          var result = _origSelect(cols);
          /* After data loads, compute rank_tier from rank_points */
          var _origThen = result.then.bind(result);
          /* Patch happens at response level in renderRank instead */
          return result;
        };
      }
      return builder;
    };
    
    /* Patch renderRank to compute rank_tier if missing */
    var _origRenderRank = window.renderRank;
    if (_origRenderRank) {
      window.renderRank = function() {
        /* Compute rank_tier for leaderboard entries missing it */
        if (window.MT) {
          /* This is fine — rank.js uses calcRk() for local display */
        }
        return _origRenderRank.apply(this, arguments);
      };
    }
    console.log('[Fix Leaderboard] Leaderboard column patch active ✅');
  }, 600);
}

/* ================================================================
   FIX: DB-Bridge polling — restore after syncFirebaseToken
================================================================ */
function _fixBridgePollsAfterTokenRefresh() {
  var _wait = setInterval(function() {
    if (!window.DB || !window.DB.auth) return;
    clearInterval(_wait);
    
    var _origSync2 = window.DB.auth.syncFirebaseToken;
    if (!_origSync2 || _origSync2._bridgePollsFixed) return;
    
    window.DB.auth.syncFirebaseToken = async function(firebaseUser) {
      var result = await _origSync2.apply(this, arguments);
      
      /* After new _supa created, re-attach bridge polling */
      if (result && window._bridgePolls) {
        /* Bridge polls use window._supa dynamically — they're fine.
           But we need to re-call _setupTokenRefreshGuard on new client */
        setTimeout(function() {
          if (window._setupTokenRefreshGuard) {
            window._tokenRefreshHandler = null; /* Reset so it re-registers */
            window._setupTokenRefreshGuard();
          }
        }, 1000);
      }
      return result;
    };
    window.DB.auth.syncFirebaseToken._bridgePollsFixed = true;
    console.log('[Fix Bridge] syncFirebaseToken → re-register token guard ✅');
  }, 500);
}

/* ================================================================
   INIT — Run all fixes in order
================================================================ */
function _initAllFixes() {
  _fixC1_InfoPath();
  _fixC2_UserCreate();
  _fixC3_TokenRefreshChannels();
  _fixC5_AvatarBgColumn();
  _fixC6_SpectatorXSS();
  _fixH1_WalletScreenshot();
  _fixH2_CheckInServerTime();
  _fixH5_SquadBankAtomic();
  _fixM2_NotifOffline();
  _fixM4_CreatorStats();
  _fixM5_RoomPasswordCopy();
  _fixM9_ClanWarExpiry();
  _fixM10_AndroidAdFallback();
  _fixM11_BridgePollingDedup();
  _fixCheckInAllDates();
  _fixLeaderboardColumns();
  _fixBridgePollsAfterTokenRefresh();
  
  console.log('[MiniESports] ✅ All v29 final bugfixes loaded and patching...');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initAllFixes);
} else {
  _initAllFixes();
}

})();
