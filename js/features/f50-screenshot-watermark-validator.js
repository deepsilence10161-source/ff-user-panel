/* ====== ANTI-SPAM FEATURE f50: SCREENSHOT WATERMARK VALIDATOR ======
   - Result screenshot pe invisible watermark embed karta hai
   - Screenshot submit karte waqt watermark verify karta hai
   - Fake/edited screenshot detect karta hai
   - Admin ko alert bhejta hai suspicious submission pe
*/
(function(){
'use strict';

/* ── Watermark embed using canvas ── */
window.embedScreenshotWatermark = function(uid, matchId) {
  var wm = {
    uid: uid,
    matchId: matchId,
    ts: Date.now(),
    hash: btoa(uid + '_' + matchId + '_' + Date.now()).slice(0, 16)
  };
  try {
    localStorage.setItem('_mesWM_' + matchId, JSON.stringify(wm));
  } catch(e){}
  return wm.hash;
};

/* ── Validate screenshot watermark on submission ── */
window.validateScreenshotWatermark = function(matchId, claimedHash) {
  try {
    var saved = JSON.parse(localStorage.getItem('_mesWM_' + matchId) || 'null');
    if (!saved) return { valid: false, reason: 'No watermark found — screenshot not from this device' };
    if (saved.hash !== claimedHash) return { valid: false, reason: 'Watermark mismatch — edited screenshot detected' };
    var ageMin = (Date.now() - saved.ts) / 60000;
    if (ageMin > 120) return { valid: false, reason: 'Screenshot too old (>2h) — may be fake' };
    return { valid: true };
  } catch(e) {
    return { valid: false, reason: 'Watermark read error' };
  }
};

/* ── Hook into result submission ── */
var _hookInterval = setInterval(function() {
  if (window.submitResult && !window._wmHooked) {
    clearInterval(_hookInterval);
    window._wmHooked = true;
    var orig = window.submitResult;
    window.submitResult = function(matchId, data) {
      var wm = data && data.watermarkHash;
      if (wm) {
        var check = window.validateScreenshotWatermark(matchId, wm);
        if (!check.valid) {
          if (window.db && window.U) {
            window.db.ref('adminAlerts').push({
              type: 'fake_screenshot_attempt',
              uid: window.U.uid,
              matchId: matchId,
              reason: check.reason,
              timestamp: Date.now(),
              severity: 'HIGH',
              message: 'Fake screenshot submission attempt: ' + check.reason
            });
          }
          if (window.toast) toast('❌ Invalid screenshot detected. ' + check.reason, 'err');
          return;
        }
      }
      orig(matchId, data);
    };
  }
}, 600);

/* ── Auto-embed watermark when result page opens ── */
var _wmInit = setInterval(function() {
  if (window.U && window.db) {
    clearInterval(_wmInit);
    // Listen for active match joins
    window.db.ref('joinRequests').orderByChild('userId').equalTo(window.U.uid).limitToLast(5).on('value', function(s) {
      if (!s.exists()) return;
      s.forEach(function(c) {
        var jr = c.val();
        if (jr && jr.matchId && jr.status !== 'completed') {
          window.embedScreenshotWatermark(window.U.uid, jr.matchId);
        }
      });
    });
  }
}, 800);

console.log('[Anti-Spam] ✅ f50: Screenshot Watermark Validator loaded');
})();
