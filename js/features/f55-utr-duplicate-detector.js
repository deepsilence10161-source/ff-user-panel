/* ====== ANTI-SPAM FEATURE f55: UTR / TRANSACTION DUPLICATE DETECTOR ======
   - Same UTR number se multiple deposits block karta hai
   - UTR format validation (12 digit numeric)
   - Cross-user UTR reuse detection
   - Fake UTR pattern detection
*/
(function(){
'use strict';

var UTR_MIN_LENGTH = 12;
var UTR_MAX_LENGTH = 22;

/* ── Validate UTR format ── */
window.validateUTRExtended = function(utr) {
  if (!utr || typeof utr !== 'string') return { valid: false, reason: 'UTR empty hai' };
  var clean = utr.trim();

  // Length check
  if (clean.length < UTR_MIN_LENGTH || clean.length > UTR_MAX_LENGTH) {
    return { valid: false, reason: 'UTR ' + UTR_MIN_LENGTH + '-' + UTR_MAX_LENGTH + ' characters ka hona chahiye' };
  }

  // Must be alphanumeric only
  if (!/^[A-Za-z0-9]+$/.test(clean)) {
    return { valid: false, reason: 'UTR mein only letters aur numbers allowed hain' };
  }

  // Common fake UTR patterns
  if (/^0+$|^1234|^9999|^000/.test(clean)) {
    return { valid: false, reason: 'Fake UTR pattern detected' };
  }

  // All same digits = fake
  if (new Set(clean.split('')).size <= 2) {
    return { valid: false, reason: 'Invalid UTR: all same digits' };
  }

  return { valid: true, cleaned: clean };
};

/* ── Check duplicate UTR in Firebase ── */
window.checkDuplicateUTR = function(utr, uid) {
  if (!window.db) return Promise.resolve({ isDuplicate: false });
  var _utrValidator = window.validateUTR || window.validateUTRExtended;
  var validation = _utrValidator ? _utrValidator(utr) : window.validateUTRExtended(utr);
  if (!validation.valid) {
    return Promise.resolve({ isDuplicate: false, validationError: validation.reason });
  }

  return window.db.ref('coinRequests').orderByChild('utr').equalTo(validation.cleaned).once('value').then(function(s) {
    if (!s.exists()) return { isDuplicate: false };

    var existing = [];
    s.forEach(function(c) { existing.push({ key: c.key, data: c.val() }); });

    var isSameUser = existing.some(function(e) { return e.data.uid === uid; });
    var isDiffUser = existing.some(function(e) { return e.data.uid !== uid; });

    if (isSameUser) {
      return { isDuplicate: true, type: 'self_duplicate', reason: 'Yeh UTR already aapke account pe use ho chuka hai' };
    }
    if (isDiffUser) {
      // Different user used same UTR = FRAUD
      window.db.ref('adminAlerts').push({
        type: 'utr_reuse_fraud',
        uid: uid,
        utr: utr,
        originalUid: existing[0].data.uid,
        timestamp: Date.now(),
        severity: 'HIGH',
        message: 'UTR reuse fraud: ' + utr + ' already used by ' + existing[0].data.uid + ', now ' + uid + ' try kar raha hai'
      });
      return { isDuplicate: true, type: 'cross_user', reason: 'Yeh UTR already doosre account pe use ho chuka hai. Fraud detected!' };
    }
    return { isDuplicate: false };
  });
};

/* ── Hook into deposit/coin request submission ── */
var _hookI = setInterval(function() {
  if (window.submitCoinRequest && !window._utrHooked) {
    clearInterval(_hookI);
    window._utrHooked = true;
    var orig = window.submitCoinRequest;
    window.submitCoinRequest = function(utr, amount, extraData) {
      if (!utr) { orig(utr, amount, extraData); return; }

      // First validate format
      var fmtCheck = window.validateUTR(utr);
      if (!fmtCheck.valid) {
        if (window.toast) toast('❌ Invalid UTR: ' + fmtCheck.reason, 'err');
        return;
      }

      // Then check duplicate
      var uid = window.U ? window.U.uid : null;
      window.checkDuplicateUTR(utr, uid).then(function(result) {
        if (result.isDuplicate) {
          if (window.toast) toast('🚫 ' + result.reason, 'err');
          return;
        }
        orig(utr, amount, extraData);
      }).catch(function() {
        orig(utr, amount, extraData); // Fail open on error
      });
    };
  }
}, 700);

console.log('[Anti-Spam] ✅ f55: UTR Duplicate Detector loaded');
})();
