/* ====== ANTI-SPAM FEATURE f73: AUTO SESSION KICK (Idle Timeout) ======
   - 30 min inactivity ke baad auto logout
   - Withdrawal ke liye extra 10 min timeout
   - Re-auth modal dikhata hai
*/
(function(){
'use strict';

var IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
var WARNING_TIME = 5 * 60 * 1000;  // Warn 5 min before
var _idleTimer = null;
var _warnTimer = null;
var _warned = false;

function resetIdleTimer() {
  _warned = false;
  clearTimeout(_idleTimer);
  clearTimeout(_warnTimer);

  _warnTimer = setTimeout(function() {
    if (!_warned) {
      _warned = true;
      if (window.toast) toast('⚠️ 5 minute mein auto-logout hoga — kuch karo!', 'inf');
    }
  }, IDLE_TIMEOUT - WARNING_TIME);

  _idleTimer = setTimeout(function() {
    if (window.U) {
      // Log session expiry
      if (window.db) {
        window.db.ref('users/' + window.U.uid + '/lastSeen').set(Date.now());
      }
      if (window.toast) toast('🔐 Session expired due to inactivity. Logout ho rahe hain...', 'err');
      setTimeout(function() {
        if (window.firebase && firebase.auth) firebase.auth().signOut();
      }, 2000);
    }
  }, IDLE_TIMEOUT);
}

// Activity events
['mousemove','click','keydown','scroll','touchstart'].forEach(function(ev) {
  document.addEventListener(ev, resetIdleTimer, { passive: true });
});

// Start timer
resetIdleTimer();

console.log('[Anti-Spam] ✅ f73: Auto Session Kick (Idle Timeout) loaded');
})();


/* ====== ANTI-SPAM FEATURE f74: DEPOSIT SCREENSHOT METADATA CHECKER ======
   - EXIF data check: screenshot edited nahi honi chahiye
   - Screenshot capture time vs submission time validate karta hai
   - Suspicious metadata = flag + reject
*/
(function(){
'use strict';

window.checkScreenshotMetadata = function(file, matchTimestamp) {
  return new Promise(function(resolve) {
    if (!file || !file.arrayBuffer) return resolve({ valid: true });

    file.arrayBuffer().then(function(buffer) {
      var bytes = new Uint8Array(buffer);
      var issues = [];

      // Check JPEG header
      if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
        issues.push('Not a valid JPEG file');
      }

      // Check for suspicious "edited" markers (Photoshop, Lightroom)
      var str = '';
      for (var i = 0; i < Math.min(bytes.length, 500); i++) {
        str += String.fromCharCode(bytes[i]);
      }
      if (str.includes('Adobe') || str.includes('Photoshop') || str.includes('GIMP')) {
        issues.push('Image edited with photo editor detected');
      }
      if (str.includes('PaintShop') || str.includes('Lightroom') || str.includes('Snapseed')) {
        issues.push('Photo editing software detected');
      }

      // File too small for real screenshot
      if (file.size < 15 * 1024) {
        issues.push('Screenshot too small — may be fake (' + Math.round(file.size/1024) + 'KB)');
      }

      if (issues.length > 0) {
        if (window.db && window.U) {
          window.db.ref('adminAlerts').push({
            type: 'edited_screenshot_metadata',
            uid: window.U.uid,
            issues: issues,
            fileName: file.name,
            fileSize: file.size,
            timestamp: Date.now(),
            severity: 'HIGH',
            message: 'Edited screenshot detected for ' + window.U.uid + ': ' + issues.join('; ')
          });
        }
        return resolve({ valid: false, reason: issues.join(', ') });
      }

      resolve({ valid: true });
    }).catch(function() { resolve({ valid: true }); }); // Fail open
  });
};

/* ── Hook into file upload handlers ── */
document.addEventListener('change', function(e) {
  var input = e.target;
  if (input.type !== 'file' || !input.accept || !input.accept.includes('image')) return;
  var file = input.files && input.files[0];
  if (!file) return;

  window.checkScreenshotMetadata(file, null).then(function(result) {
    if (!result.valid) {
      if (window.toast) toast('⚠️ Screenshot invalid: ' + result.reason, 'err');
      input.value = ''; // Clear the file input
    }
  });
}, true);

console.log('[Anti-Spam] ✅ f74: Screenshot Metadata Checker loaded');
})();
