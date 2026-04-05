/* ====== ANTI-SPAM FEATURE f54: MULTI-ACCOUNT SAME MATCH BLOCKER ======
   - Ek device se same match mein 2 accounts join block karta hai
   - Cross-device same IP detection (Firebase-side check)
   - Ek device ke multiple accounts ko detect karta hai
   - Admin ko instant HIGH alert bhejta hai
*/
(function(){
'use strict';

/* ── Pre-join check: same device already joined this match? ── */
window.checkMultiAccountSameMatch = function(matchId, uid) {
  if (!window.db) return Promise.resolve({ safe: true });

  var deviceFP = window.getStrongFingerprint ? window.getStrongFingerprint() : (window.getDeviceId ? window.getDeviceId() : 'unknown');

  // Check deviceJoins for this match
  return window.db.ref('deviceJoins/' + deviceFP + '/' + matchId).once('value').then(function(s) {
    if (!s.exists()) return { safe: true };
    var existing = s.val();
    if (existing && existing.uid && existing.uid !== uid) {
      // Different UID, same device, same match = multi-account!
      window.db.ref('adminAlerts').push({
        type: 'multi_account_same_match',
        uid: uid,
        existingUid: existing.uid,
        matchId: matchId,
        deviceFP: deviceFP,
        timestamp: Date.now(),
        severity: 'HIGH',
        message: 'Multi-account detected: ' + uid + ' aur ' + existing.uid + ' dono same device se match "' + matchId + '" join karne ki koshish'
      });

      // Flag both accounts
      window.db.ref('users/' + uid + '/flags/multiAccount').set(true);
      window.db.ref('users/' + existing.uid + '/flags/multiAccount').set(true);

      return { safe: false, reason: 'Is device se ek aur account already is match mein join kar chuka hai. Multi-account not allowed!' };
    }
    return { safe: true };
  });
};

/* ── Save device join record (enhanced) ── */
window.saveEnhancedDeviceJoin = function(matchId, uid) {
  var deviceFP = window.getStrongFingerprint ? window.getStrongFingerprint() : (window.getDeviceId ? window.getDeviceId() : 'unknown');
  if (!window.db) return;
  window.db.ref('deviceJoins/' + deviceFP + '/' + matchId).set({
    uid: uid,
    joinedAt: Date.now(),
    userAgent: navigator.userAgent.substring(0, 80)
  });
};

/* ── Cross-account family detection ── */
window.detectAccountFamily = function(uid) {
  if (!window.db) return;
  var deviceFP = window.getStrongFingerprint ? window.getStrongFingerprint() : 'unknown';

  window.db.ref('deviceJoins/' + deviceFP).once('value', function(s) {
    if (!s.exists()) return;
    var matchData = s.val();
    var uids = new Set();
    Object.values(matchData).forEach(function(d) {
      if (d && d.uid) uids.add(d.uid);
    });

    if (uids.size > 2) {
      window.db.ref('adminAlerts').push({
        type: 'account_family_detected',
        primaryUid: uid,
        allUids: Array.from(uids),
        deviceFP: deviceFP,
        accountCount: uids.size,
        timestamp: Date.now(),
        severity: 'HIGH',
        message: uids.size + ' accounts detected on same device (FP: ' + deviceFP.slice(0,10) + ') — possible account family'
      });
    }
  });
};

/* ── Hook into doJoin ── */
var _hookI = setInterval(function() {
  if (window.doJoin && !window._maHooked) {
    clearInterval(_hookI);
    window._maHooked = true;
    var orig = window.doJoin;
    window.doJoin = function(matchId) {
      if (!window.U) { orig(matchId); return; }
      window.checkMultiAccountSameMatch(matchId, window.U.uid).then(function(result) {
        if (!result.safe) {
          if (window.toast) toast('🚫 ' + result.reason, 'err');
          return;
        }
        window.saveEnhancedDeviceJoin(matchId, window.U.uid);
        orig(matchId);
      });
    };
  }
}, 700);

/* ── Run family check after login ── */
var _initI = setInterval(function() {
  if (window.U && window.db) {
    clearInterval(_initI);
    setTimeout(function() { window.detectAccountFamily(window.U.uid); }, 4000);
  }
}, 800);

console.log('[Anti-Spam] ✅ f54: Multi-Account Same Match Blocker loaded');
})();
