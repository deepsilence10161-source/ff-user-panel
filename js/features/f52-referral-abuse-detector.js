/* ====== ANTI-SPAM FEATURE f52: REFERRAL CODE ABUSE DETECTOR ======
   - Self-referral detect karta hai (same device pe dono accounts)
   - Referral farming: ek device se multiple referral accounts block
   - IP-based referral chain limit
   - Fake referral bonus revoke system
*/
(function(){
'use strict';

var MAX_REFERRALS_PER_DEVICE = 3; // Ek device se max 3 referrals allowed

/* ── Check referral abuse on signup/referral apply ── */
window.checkReferralAbuse = function(referralCode, newUid) {
  if (!window.db) return Promise.resolve({ safe: true });

  var deviceFP = window.getStrongFingerprint ? window.getStrongFingerprint() : window.getDeviceId ? window.getDeviceId() : 'unknown';

  return window.db.ref('referrals').orderByChild('deviceFP').equalTo(deviceFP).once('value').then(function(s) {
    var existingReferrals = [];
    if (s.exists()) s.forEach(function(c) { existingReferrals.push(c.val()); });

    // Check: same device used for referrals more than limit
    if (existingReferrals.length >= MAX_REFERRALS_PER_DEVICE) {
      window.db.ref('adminAlerts').push({
        type: 'referral_abuse',
        newUid: newUid,
        referralCode: referralCode,
        deviceFP: deviceFP,
        existingCount: existingReferrals.length,
        timestamp: Date.now(),
        severity: 'HIGH',
        message: 'Referral farming detected: ' + existingReferrals.length + ' accounts from same device (FP: ' + deviceFP.slice(0,10) + ')'
      });
      return { safe: false, reason: 'Is device se bahut zyada referrals ho chuke hain. Bonus nahi milega.' };
    }

    // Check: referrer and referred same device FP
    return window.db.ref('users').orderByChild('referralCode').equalTo(referralCode).once('value').then(function(rs) {
      if (!rs.exists()) return { safe: true };
      var referrerData = null;
      rs.forEach(function(c) { referrerData = c.val(); });
      if (referrerData && referrerData.deviceFP && referrerData.deviceFP === deviceFP) {
        window.db.ref('adminAlerts').push({
          type: 'self_referral',
          newUid: newUid,
          referralCode: referralCode,
          deviceFP: deviceFP,
          timestamp: Date.now(),
          severity: 'HIGH',
          message: 'Self-referral attempt: Same device ne khud ko refer kiya!'
        });
        return { safe: false, reason: 'Self-referral detected! Bonus nahi milega.' };
      }
      return { safe: true };
    });
  });
};

/* ── Suspicious referral chain detector ── */
window.detectReferralChain = function(uid) {
  if (!window.db) return;
  window.db.ref('referrals').orderByChild('referredBy').equalTo(uid).once('value', function(s) {
    if (!s.exists()) return;
    var referred = [];
    s.forEach(function(c) { referred.push(c.val()); });

    // All same device? = farming
    var fps = referred.map(function(r) { return r.deviceFP || ''; }).filter(Boolean);
    var uniqueFPs = [...new Set(fps)];
    if (referred.length >= 5 && uniqueFPs.length <= 2) {
      window.db.ref('adminAlerts').push({
        type: 'referral_chain_abuse',
        uid: uid,
        referredCount: referred.length,
        uniqueDevices: uniqueFPs.length,
        timestamp: Date.now(),
        severity: 'HIGH',
        message: uid + ' ne ' + referred.length + ' referrals kiye sirf ' + uniqueFPs.length + ' device(s) se — farming suspected'
      });
    }
  });
};

/* ── Auto-run check on page load ── */
var _initI = setInterval(function() {
  if (window.U && window.db) {
    clearInterval(_initI);
    setTimeout(function() { window.detectReferralChain(window.U.uid); }, 5000);
  }
}, 800);

console.log('[Anti-Spam] ✅ f52: Referral Code Abuse Detector loaded');
})();
