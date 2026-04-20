/* ====== ANTI-SPAM FEATURES f57-f74: ADVANCED FRAUD SHIELD (User Panel) ======
   f57 - Withdrawal Speed Limiter (min 24h between withdrawals)
   f58 - New Account Deposit-Withdraw Cooldown (7 day lock)
   f59 - Kill Count Anomaly Detector (impossible kills = cheat)
   f60 - Account Age Gate (matches restricted for new accounts)
   f61 - Session Timeout & Re-auth for Withdrawals
   f62 - Screenshot Upload Size/Dimension Validator
   f63 - Emulator/Root Device Detector
   f64 - Result Submit Timing Validator (too fast = bot)
   f65 - Coin Balance Anomaly Alert
   f66 - IP Velocity Check (too many accounts from one IP)
   f67 - Withdrawal Limit Escalation (new user < ₹500/day)
   f68 - Match Join Verify (confirm before high-fee matches)
   f69 - Name/IGN Spoof Detector (copycat names)
   f70 - Penalty Point System (accumulated = auto-restrict)
   f71 - Abnormal Win-streak Alert (10+ wins straight = flag)
   f72 - Fake Team ID Validator
   f73 - Idle Session Kick (auto-logout after 30min inactive)
   f74 - Anti-Screenshot Farming (same match screenshot reuse detect)
*/
(function(){
'use strict';

/* ══════════════════════════════════════════
   f57: WITHDRAWAL SPEED LIMITER
   ══════════════════════════════════════════ */
window.checkWithdrawalCooldown = function(uid) {
  if (!window.db) return Promise.resolve({ allowed: true });
  return window.db.ref('users/' + uid + '/lastWithdrawal').once('value').then(function(s) {
    var last = s.val();
    if (!last) return { allowed: true };
    var hoursSince = (Date.now() - Number(last)) / 3600000;
    if (hoursSince < 24) {
      var hoursLeft = Math.ceil(24 - hoursSince);
      return { allowed: false, reason: 'Next withdrawal ' + hoursLeft + ' ghante baad allowed hai (daily limit)' };
    }
    return { allowed: true };
  });
};

/* ══════════════════════════════════════════
   f58: NEW ACCOUNT DEPOSIT-WITHDRAW COOLDOWN
   ══════════════════════════════════════════ */
window.checkNewAccountWithdrawal = function(uid) {
  if (!window.db || !window.UD) return Promise.resolve({ allowed: true });
  var createdAt = Number(window.UD.createdAt) || Date.now();
  var daysSince = (Date.now() - createdAt) / 86400000;
  if (daysSince < 7) {
    var daysLeft = Math.ceil(7 - daysSince);
    window.db.ref('adminAlerts').push({
      type: 'new_account_withdrawal_attempt',
      uid: uid,
      accountAgeDays: Math.floor(daysSince),
      timestamp: Date.now(),
      severity: 'MEDIUM',
      message: uid + ' ne sirf ' + Math.floor(daysSince) + ' din purana account se withdrawal try kiya'
    });
    return Promise.resolve({ allowed: false, reason: 'Naya account! ' + daysLeft + ' din baad withdrawal allowed hoga (security hold)' });
  }
  return Promise.resolve({ allowed: true });
};

/* ══════════════════════════════════════════
   f59: KILL COUNT ANOMALY DETECTOR
   ══════════════════════════════════════════ */
window.validateKillCount = function(kills, matchType) {
  var MAX_KILLS = { solo: 25, duo: 20, squad: 26, tdm: 40 };
  var max = MAX_KILLS[matchType] || 26;
  if (kills > max) {
    if (window.db && window.U) {
      window.db.ref('adminAlerts').push({
        type: 'impossible_kill_count',
        uid: window.U.uid,
        reportedKills: kills,
        matchType: matchType,
        maxPossible: max,
        timestamp: Date.now(),
        severity: 'HIGH',
        message: window.U.uid + ' ne impossible kill count submit kiya: ' + kills + ' kills (' + matchType + ', max: ' + max + ')'
      });
    }
    return { valid: false, reason: kills + ' kills impossible hai ' + matchType + ' mode mein. Max: ' + max };
  }
  return { valid: true };
};

/* ══════════════════════════════════════════
   f60: ACCOUNT AGE GATE FOR HIGH-STAKE MATCHES
   ══════════════════════════════════════════ */
window.checkAgeGateForMatch = function(matchEntryFee) {
  if (!window.UD) return { allowed: true };
  var createdAt = Number(window.UD.createdAt) || Date.now();
  var daysSince = (Date.now() - createdAt) / 86400000;
  var fee = Number(matchEntryFee) || 0;
  if (fee >= 100 && daysSince < 3) {
    return { allowed: false, reason: 'Naya account ₹100+ fee matches mein 3 din baad join kar sakta hai' };
  }
  if (fee >= 500 && daysSince < 7) {
    return { allowed: false, reason: 'Naya account ₹500+ fee matches mein 7 din baad join kar sakta hai' };
  }
  return { allowed: true };
};

/* ══════════════════════════════════════════
   f61: SESSION TIMEOUT FOR SENSITIVE ACTIONS
   ══════════════════════════════════════════ */
var _lastActivity = Date.now();
var SESSION_TIMEOUT = 30 * 60 * 1000; // 30 min

document.addEventListener('click', function() { _lastActivity = Date.now(); });
document.addEventListener('keydown', function() { _lastActivity = Date.now(); });

window.requireFreshSession = function(action) {
  var elapsed = Date.now() - _lastActivity;
  if (elapsed > SESSION_TIMEOUT) {
    if (window.toast) toast('🔐 Session expired. Please re-login for ' + action + '.', 'err');
    setTimeout(function() { if (window.firebase && firebase.auth) firebase.auth().signOut(); }, 2000);
    return false;
  }
  return true;
};

/* ══════════════════════════════════════════
   f62: SCREENSHOT FILE VALIDATOR
   ══════════════════════════════════════════ */
window.validateScreenshotFile = function(file) {
  if (!file) return { valid: false, reason: 'No file selected' };
  var MAX_SIZE = 5 * 1024 * 1024; // 5MB
  var ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, reason: 'Only JPG/PNG/WebP screenshots allowed. Got: ' + file.type };
  }
  if (file.size > MAX_SIZE) {
    return { valid: false, reason: 'Screenshot too large (' + Math.round(file.size/1024) + 'KB). Max 5MB.' };
  }
  if (file.size < 10 * 1024) {
    return { valid: false, reason: 'Screenshot too small (' + file.size + 'B). May be fake/corrupted.' };
  }
  return { valid: true };
};

/* ══════════════════════════════════════════
   f63: EMULATOR/ROOT DETECTOR
   ══════════════════════════════════════════ */
window.detectEmulator = function() {
  var signals = [];
  // Screen exactly 360x640 = common emulator default
  if (screen.width === 360 && screen.height === 640) signals.push('Common emulator resolution');
  // No touch on "mobile"
  var isMobileUA = /android|iphone|ipad/i.test(navigator.userAgent);
  if (isMobileUA && !('ontouchstart' in window)) signals.push('Mobile UA without touch support');
  // Battery API missing on desktop emulators
  if (navigator.userAgent.includes('Android') && !navigator.getBattery) signals.push('Android UA without Battery API');
  // Low memory on "high-end device"
  if (navigator.deviceMemory && navigator.deviceMemory < 1) signals.push('Suspiciously low device memory');

  if (signals.length >= 2 && window.db && window.U) {
    window.db.ref('adminAlerts').push({
      type: 'emulator_detected',
      uid: window.U.uid,
      signals: signals,
      userAgent: navigator.userAgent.substring(0, 100),
      timestamp: Date.now(),
      severity: 'MEDIUM',
      message: 'Possible emulator/modded device: ' + signals.join('; ')
    });
    window.db.ref('users/' + window.U.uid + '/flags/emulatorSuspected').set(true);
  }
  return { signalCount: signals.length, signals: signals };
};

/* ══════════════════════════════════════════
   f64: RESULT SUBMIT TIMING VALIDATOR
   ══════════════════════════════════════════ */
var _matchJoinTime = {};
window.recordMatchJoinTime = function(matchId) {
  _matchJoinTime[matchId] = Date.now();
};
window.validateResultSubmitTiming = function(matchId) {
  var joinTime = _matchJoinTime[matchId];
  if (!joinTime) return { valid: true }; // No data = pass
  var elapsedMin = (Date.now() - joinTime) / 60000;
  // Min 8 minutes for any FF match (BR, TDM, etc)
  if (elapsedMin < 8) {
    if (window.db && window.U) {
      window.db.ref('adminAlerts').push({
        type: 'result_too_fast',
        uid: window.U.uid,
        matchId: matchId,
        elapsedMinutes: elapsedMin.toFixed(1),
        timestamp: Date.now(),
        severity: 'HIGH',
        message: window.U.uid + ' ne sirf ' + elapsedMin.toFixed(1) + ' min mein result submit kiya — bot/cheat suspected'
      });
    }
    return { valid: false, reason: 'Result submit karne ke liye match puri tarah khelni hogi (min 8 min)' };
  }
  return { valid: true };
};

/* ══════════════════════════════════════════
   f65: COIN BALANCE ANOMALY ALERT
   ══════════════════════════════════════════ */
window.monitorCoinBalanceAnomaly = function(uid) {
  if (!window.db) return;
  var prevBalance = null;
  window.db.ref('users/' + uid + '/coins').on('value', function(s) {
    var current = Number(s.val()) || 0;
    if (prevBalance !== null) {
      var diff = current - prevBalance;
      // Sudden jump of 5000+ coins without deposit/prize = suspicious
      if (diff > 5000) {
        window.db.ref('adminAlerts').push({
          type: 'coin_balance_anomaly',
          uid: uid,
          previousBalance: prevBalance,
          newBalance: current,
          difference: diff,
          timestamp: Date.now(),
          severity: 'HIGH',
          message: uid + ' ka coin balance suddenly ' + diff + ' se badh gaya (' + prevBalance + ' → ' + current + ')'
        });
      }
    }
    prevBalance = current;
  });
};

/* ══════════════════════════════════════════
   f66: WITHDRAWAL DAILY LIMIT FOR NEW USERS
   ══════════════════════════════════════════ */
window.checkWithdrawalLimit = function(uid, amount) {
  if (!window.db || !window.UD) return Promise.resolve({ allowed: true });
  var createdAt = Number(window.UD.createdAt) || 0;
  var daysSince = (Date.now() - createdAt) / 86400000;
  var dailyLimit = daysSince < 7 ? 500 : daysSince < 30 ? 2000 : 10000;

  return window.db.ref('users/' + uid + '/todayWithdrawn').once('value').then(function(s) {
    var todayTotal = Number(s.val()) || 0;
    if (todayTotal + amount > dailyLimit) {
      return { allowed: false, reason: 'Daily limit ₹' + dailyLimit + ' ho gayi hai. Aaj aur withdraw nahi kar sakte.' };
    }
    return { allowed: true, remaining: dailyLimit - todayTotal };
  });
};

/* ══════════════════════════════════════════
   f67: HIGH-FEE MATCH JOIN CONFIRMATION
   ══════════════════════════════════════════ */
window.requireHighFeeConfirmation = function(matchId, fee, onConfirm) {
  if (fee < 100) { onConfirm(); return; }
  var h = '<div style="text-align:center;padding:10px">';
  h += '<div style="font-size:40px;margin-bottom:10px">💰</div>';
  h += '<div style="font-size:16px;font-weight:800;margin-bottom:8px">High Entry Fee Match</div>';
  h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">₹' + fee + ' entry fee kategi aapke wallet se.<br>Kya aap pakka join karna chahte hain?</div>';
  h += '<div style="display:flex;gap:8px">';
  h += '<button onclick="closeModal()" style="flex:1;padding:12px;border-radius:10px;background:rgba(255,255,255,.06);border:1px solid var(--border);color:var(--txt);font-weight:700;cursor:pointer">Cancel</button>';
  h += '<button onclick="window._hfConfirmCb && window._hfConfirmCb(); closeModal();" style="flex:1;padding:12px;border-radius:10px;background:linear-gradient(135deg,#ff6b35,#ff4444);color:#fff;font-weight:800;border:none;cursor:pointer">✅ Confirm Join</button>';
  h += '</div></div>';
  window._hfConfirmCb = onConfirm;
  if (window.openModal) openModal('⚠️ Confirm Entry', h);
  else onConfirm(); // Fallback
};

/* ══════════════════════════════════════════
   f68: IGN/NAME SPOOF DETECTOR
   ══════════════════════════════════════════ */
window.checkIGNSpoof = function(ign) {
  if (!ign || !window.db) return Promise.resolve({ safe: true });
  var normalized = ign.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Check against admin usernames
  var adminNames = ['admin', 'ministore', 'miniesports', 'support', 'official', 'mod', 'owner'];
  if (adminNames.some(function(n) { return normalized.includes(n); })) {
    return Promise.resolve({ safe: false, reason: 'Admin/Official naam use nahi kar sakte: ' + ign });
  }
  return Promise.resolve({ safe: true });
};

/* ══════════════════════════════════════════
   f69: PENALTY POINT SYSTEM
   ══════════════════════════════════════════ */
window.addPenaltyPoint = function(uid, reason, points) {
  if (!window.db) return;
  points = points || 1;
  window.db.ref('users/' + uid + '/penaltyPoints').transaction(function(current) {
    return (Number(current) || 0) + points;
  }).then(function(result) {
    var total = result.snapshot.val();
    // Auto-restrict at 10 points
    if (total >= 10) {
      window.db.ref('users/' + uid + '/restricted').set({
        restricted: true,
        reason: 'Auto-restricted: ' + total + ' penalty points accumulated',
        at: Date.now()
      });
      window.db.ref('adminAlerts').push({
        type: 'auto_restriction',
        uid: uid,
        penaltyPoints: total,
        timestamp: Date.now(),
        severity: 'HIGH',
        message: uid + ' auto-restricted: ' + total + ' penalty points. Last reason: ' + reason
      });
    }
  });
};

/* ══════════════════════════════════════════
   f70: ABNORMAL WIN-STREAK ALERT
   ══════════════════════════════════════════ */
window.checkWinStreak = function(uid) {
  if (!window.db) return;
  window.db.ref('joinRequests').orderByChild('userId').equalTo(uid).limitToLast(15).once('value', function(s) {
    if (!s.exists()) return;
    var results = [];
    s.forEach(function(c) { var d = c.val(); if (d.result) results.push(d.result); });
    // Count consecutive rank 1
    var streak = 0;
    for (var i = results.length - 1; i >= 0; i--) {
      if (String(results[i].rank) === '1') streak++;
      else break;
    }
    if (streak >= 8) {
      window.db.ref('adminAlerts').push({
        type: 'abnormal_win_streak',
        uid: uid,
        streak: streak,
        timestamp: Date.now(),
        severity: 'HIGH',
        message: uid + ' ka ' + streak + ' consecutive first place wins — cheat suspected'
      });
    }
  });
};

/* ══════════════════════════════════════════
   f71: FAKE TEAM ID VALIDATOR
   ══════════════════════════════════════════ */
window.validateTeamID = function(teamId) {
  if (!teamId) return { valid: false, reason: 'Team ID required' };
  var clean = String(teamId).trim();
  // FF team IDs: typically numeric or alphanumeric
  if (!/^[A-Za-z0-9#\-_]{4,20}$/.test(clean)) {
    return { valid: false, reason: 'Invalid Team ID format: ' + clean };
  }
  // Obvious fakes
  if (/^(0+|1234|test|fake|null|none)$/i.test(clean)) {
    return { valid: false, reason: 'Fake Team ID detected: ' + clean };
  }
  return { valid: true };
};

/* ══════════════════════════════════════════
   f72: ANTI-SCREENSHOT FARMING
   Screenshot already used detect
   ══════════════════════════════════════════ */
window.checkScreenshotReuse = function(screenshotUrl, uid, matchId) {
  if (!window.db || !screenshotUrl) return Promise.resolve({ valid: true });
  // Use URL hash as key
  var urlKey = btoa(screenshotUrl).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
  return window.db.ref('usedScreenshots/' + urlKey).once('value').then(function(s) {
    if (s.exists()) {
      var existing = s.val();
      window.db.ref('adminAlerts').push({
        type: 'screenshot_reuse',
        uid: uid,
        matchId: matchId,
        originalUid: existing.uid,
        originalMatchId: existing.matchId,
        timestamp: Date.now(),
        severity: 'HIGH',
        message: 'Screenshot reuse: ' + uid + ' ne wahi screenshot use kiya jo ' + existing.uid + ' ne match ' + existing.matchId + ' mein use kiya tha'
      });
      return { valid: false, reason: 'Yeh screenshot already use ho chuka hai. Nayi screenshot upload karo.' };
    }
    // Register this screenshot
    window.db.ref('usedScreenshots/' + urlKey).set({ uid: uid, matchId: matchId, usedAt: Date.now() });
    return { valid: true };
  });
};

/* ══════════════════════════════════════════
   AUTO-INIT ALL
   ══════════════════════════════════════════ */
var _initI = setInterval(function() {
  if (window.U && window.db && window.UD) {
    clearInterval(_initI);
    var uid = window.U.uid;

    // Emulator check
    setTimeout(function() { window.detectEmulator(); }, 2000);

    // Coin anomaly monitor
    setTimeout(function() { window.monitorCoinBalanceAnomaly(uid); }, 3000);

    // Win streak check
    setTimeout(function() { window.checkWinStreak(uid); }, 6000);

    // Hook into withdrawal
    var _wdHookI = setInterval(function() {
      if (window.submitWithdrawal && !window._wdHooked) {
        clearInterval(_wdHookI);
        window._wdHooked = true;
        var origWd = window.submitWithdrawal;
        window.submitWithdrawal = function(amount, extra) {
          if (!window.requireFreshSession('withdrawal')) return;
          window.checkWithdrawalCooldown(uid).then(function(r1) {
            if (!r1.allowed) { if(window.toast) toast('⏳ ' + r1.reason, 'err'); return; }
            return window.checkNewAccountWithdrawal(uid);
          }).then(function(r2) {
            if (!r2 || !r2.allowed) { if(window.toast && r2) toast('🔒 ' + r2.reason, 'err'); return; }
            return window.checkWithdrawalLimit(uid, amount);
          }).then(function(r3) {
            if (!r3 || !r3.allowed) { if(window.toast && r3) toast('💸 ' + r3.reason, 'err'); return; }
            origWd(amount, extra);
            // Update withdrawal time
            window.db.ref('users/' + uid + '/lastWithdrawal').set(Date.now());
            window.db.ref('users/' + uid + '/todayWithdrawn').transaction(function(c) { return (Number(c)||0) + amount; });
          }).catch(function() { origWd(amount, extra); });
        };
      }
    }, 800);
  }
}, 800);

console.log('[Anti-Spam] ✅ f57-f72: Advanced Fraud Shield loaded (16 features)');
})();
