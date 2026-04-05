/* =============================================
   F51: RAPID JOIN SPAM BLOCKER v2
   - Max 1 join per 3 seconds
   - Max 5 joins per minute
   - Blocks double-tap on join button
   ============================================= */
(function() {
  'use strict';

  var _lastJoinTime = 0;
  var _joinCountThisMinute = 0;
  var _joinMinuteStart = 0;
  var _joinInProgress = false;

  var origDoJoin = null;

  function patchJoin() {
    if (window._f51Patched || !window.doJoin) return;
    window._f51Patched = true;
    origDoJoin = window.doJoin;

    window.doJoin = function(id) {
      var now = Date.now();

      // Double-tap guard
      if (_joinInProgress) {
        if (window.toast) window.toast('Join in progress, please wait...', 'inf');
        return;
      }

      // 3 second cooldown
      if (now - _lastJoinTime < 3000) {
        var wait = Math.ceil((3000 - (now - _lastJoinTime)) / 1000);
        if (window.toast) window.toast('Wait ' + wait + 's before joining again', 'err');
        return;
      }

      // Per-minute rate limit (max 5)
      if (now - _joinMinuteStart > 60000) {
        _joinMinuteStart = now;
        _joinCountThisMinute = 0;
      }
      if (_joinCountThisMinute >= 5) {
        if (window.toast) window.toast('Too many join attempts! Wait 1 minute.', 'err');
        return;
      }

      _joinInProgress = true;
      _lastJoinTime = now;
      _joinCountThisMinute++;

      // Auto-release lock after 5s
      setTimeout(function() { _joinInProgress = false; }, 5000);

      origDoJoin(id);
    };

    // Also patch confirmAdMatchJoin
    if (window.confirmAdMatchJoin) {
      var origAdJoin = window.confirmAdMatchJoin;
      window.confirmAdMatchJoin = function(matchId) {
        var now = Date.now();
        if (now - _lastJoinTime < 3000) { if (window.toast) window.toast('Please wait...', 'inf'); return; }
        _lastJoinTime = now;
        origAdJoin(matchId);
      };
    }

    console.log('[F51] Join spam blocker active');
  }

  // Patch after app loads
  var _t = 0;
  var _iv = setInterval(function() {
    _t++;
    if (window.doJoin) { patchJoin(); clearInterval(_iv); }
    if (_t > 30) clearInterval(_iv);
  }, 500);

  window.f51JoinBlocker = { reset: function() { _joinInProgress = false; _joinCountThisMinute = 0; } };
})();
