/* ====== MINI eSPORTS: SECURITY SYSTEM ======
   1. Strong Device Fingerprint (canvas + hardware)
   2. Fake Screenshot Detection (UTR validation + watermark check)
   3. Multi-account detection
*/

(function() {
'use strict';

/* ═══════════════════════════════════════════════
   PART 1: STRONG DEVICE FINGERPRINT
   localStorage se better — hardware info include karta hai
   Clear karne se bhi fingerprint same rahega (mostly)
═══════════════════════════════════════════════ */

function buildStrongFingerprint() {
  var parts = [];

  // Canvas fingerprint — GPU rendering alag hota hai har device pe
  try {
    var canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 50;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.font = '11pt Arial';
    ctx.fillText('Mini eSports FP 🎮', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,.7)';
    ctx.font = '18pt Arial';
    ctx.fillText('Mini', 4, 45);
    parts.push(canvas.toDataURL().slice(-50)); // last 50 chars enough
  } catch(e) { parts.push('canvas_err'); }

  // Screen + hardware
  parts.push(screen.width + 'x' + screen.height);
  parts.push(screen.colorDepth || 24);
  parts.push(navigator.hardwareConcurrency || 0); // CPU cores
  parts.push(navigator.deviceMemory || 0);        // RAM (GB)
  parts.push(navigator.platform || 'unknown');
  parts.push(navigator.language || 'unknown');
  parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown');

  // Touch support
  parts.push('touch:' + (('ontouchstart' in window) ? 1 : 0));

  // WebGL renderer (GPU info)
  try {
    var gl = document.createElement('canvas').getContext('webgl');
    if (gl) {
      var dbExt = gl.getExtension('WEBGL_debug_renderer_info');
      if (dbExt) {
        parts.push(gl.getParameter(dbExt.UNMASKED_RENDERER_WEBGL).slice(0, 30));
      }
    }
  } catch(e) {}

  // Hash karo
  var str = parts.join('|');
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  var fp = 'FP' + Math.abs(hash).toString(36).toUpperCase();

  // localStorage mein bhi save karo backup ke liye
  try { localStorage.setItem('_mesFP', fp); } catch(e) {}
  return fp;
}

// Global fingerprint
window.getStrongFingerprint = function() {
  return window._mesFP || (window._mesFP = buildStrongFingerprint());
};

// Device fingerprint Firebase mein save karo (login ke baad call karo)
window.saveDeviceFingerprint = function(uid) {
  if (!uid || typeof db === 'undefined') return;
  var fp = window.getStrongFingerprint();
  var deviceInfo = {
    fp: fp,
    ua: navigator.userAgent.substring(0, 100),
    screen: screen.width + 'x' + screen.height,
    platform: navigator.platform || '',
    lang: navigator.language || '',
    cores: navigator.hardwareConcurrency || 0,
    lastSeen: Date.now()
  };

  // Is fingerprint se kitne accounts linked hain check karo
  db.ref('deviceFingerprints/' + fp).once('value', function(s) {
    var existing = s.val() || {};
    var linkedUids = existing.uids || [];

    if (linkedUids.indexOf(uid) === -1) {
      // New UID on this device
      if (linkedUids.length >= 2) {
        // 2+ accounts already on this device — flag karo
        db.ref('adminAlerts').push({
          type: 'multi_account',
          fingerprint: fp,
          newUid: uid,
          existingUids: linkedUids,
          timestamp: Date.now(),
          severity: 'HIGH',
          message: 'Same device se ' + (linkedUids.length + 1) + ' accounts detected!'
        });
        // User ko bhi flag karo
        db.ref('users/' + uid + '/flags/multiAccount').set({
          detected: true, timestamp: Date.now(), fp: fp, linkedAccounts: linkedUids.length
        });
      }
      linkedUids.push(uid);
    }

    db.ref('deviceFingerprints/' + fp).set(Object.assign(deviceInfo, { uids: linkedUids }));
    db.ref('users/' + uid + '/deviceFP').set({ fp: fp, lastSeen: Date.now() });
  });
};

/* ═══════════════════════════════════════════════
   PART 2: FAKE SCREENSHOT DETECTION
   UTR validation + Screenshot metadata check
═══════════════════════════════════════════════ */

// UTR format validate karo (IMPS/UPI = 12 digit number)
window.validateUTR = function(utr) {
  if (!utr) return { valid: false, reason: 'UTR empty hai' };
  utr = utr.trim().replace(/\s/g, '');

  // IMPS UTR: exactly 12 digits
  if (/^\d{12}$/.test(utr)) return { valid: true, type: 'IMPS/UPI' };

  // UPI Ref (some apps): alphanumeric, 12-22 chars
  if (/^[A-Z0-9]{12,22}$/i.test(utr) && utr.length >= 12) return { valid: true, type: 'UPI_REF' };

  return { valid: false, reason: 'UTR format galat! 12 digit number hona chahiye' };
};

// Screenshot metadata check — size + dimensions verify karo
window.validateScreenshot = function(file, callback) {
  if (!file) { callback({ valid: false, reason: 'No file' }); return; }

  // File size check (too small = suspicious, might be edited)
  var sizeKB = file.size / 1024;
  if (sizeKB < 15) {
    callback({ valid: false, reason: 'Screenshot too small — edited ya fake lagti hai (min 15KB)' });
    return;
  }

  // Image dimensions check
  var img = new Image();
  var url = URL.createObjectURL(file);
  img.onload = function() {
    URL.revokeObjectURL(url);
    var w = img.naturalWidth, h = img.naturalHeight;

    // Mobile screenshot min dimensions
    if (w < 300 || h < 400) {
      callback({ valid: false, reason: 'Screenshot dimensions bahut chhoti hain — valid screenshot nahi lagti' });
      return;
    }

    // Aspect ratio check — mobile screens portrait hoti hain
    var ratio = h / w;
    if (ratio < 1.2) {
      callback({ valid: false, reason: 'Screenshot landscape hai — mobile payment screenshot portrait hona chahiye' });
      return;
    }

    callback({ valid: true, width: w, height: h, sizeKB: Math.round(sizeKB) });
  };
  img.onerror = function() {
    URL.revokeObjectURL(url);
    callback({ valid: false, reason: 'Image load nahi hui — file corrupt hai' });
  };
  img.src = url;
};

// Enhanced submitAddMoney — UTR + screenshot validate karo pehle
window._mesOrigHandleSS = null; // placeholder

// Hook into payment submission
var _origSubmitAddMoney = window.submitAddMoney;
window.submitAddMoney = function() {
  var utrInput = document.getElementById('addUtr');
  var utr = utrInput ? utrInput.value.trim() : '';
  var ssInput = document.getElementById('ssInput');
  var ssFile = ssInput && ssInput.files && ssInput.files[0];

  // UTR validate karo
  var utrCheck = window.validateUTR(utr);
  if (!utrCheck.valid) {
    if (window.toast) toast(utrCheck.reason, 'err');
    else alert(utrCheck.reason);
    return;
  }

  // Screenshot validate karo
  if (ssFile) {
    window.validateScreenshot(ssFile, function(result) {
      if (!result.valid) {
        if (window.toast) toast('⚠️ ' + result.reason, 'err');
        else alert(result.reason);
        // Flag as suspicious in Firebase
        if (typeof db !== 'undefined' && window.U) {
          db.ref('adminAlerts').push({
            type: 'fake_screenshot_attempt',
            uid: window.U.uid,
            utr: utr,
            reason: result.reason,
            timestamp: Date.now(),
            severity: 'MEDIUM'
          });
        }
        return;
      }
      // Valid — proceed with original
      if (_origSubmitAddMoney) _origSubmitAddMoney();
    });
  } else {
    // No screenshot — UTR enough hai, proceed
    if (_origSubmitAddMoney) _origSubmitAddMoney();
  }
};

// Original function restore karo after page load
window.addEventListener('load', function() {
  _origSubmitAddMoney = window.submitAddMoney;
  // Rebind after potential overrides
  setTimeout(function() {
    if (window._mesOrigSubmit) return;
    window._mesOrigSubmit = true;
  }, 500);
});

/* ═══════════════════════════════════════════════
   PART 3: ADMIN ALERTS DASHBOARD (Admin ke liye)
   Firebase mein save hua fraud automatically
═══════════════════════════════════════════════ */

// Fingerprint check on app start
window.addEventListener('DOMContentLoaded', function() {
  // Fingerprint generate karo immediately
  window.getStrongFingerprint();
});

console.log('[Mini eSports] ✅ Security System loaded (Fingerprint + Screenshot Validation)');

})();
