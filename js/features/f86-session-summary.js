/* ================================================================
   FEATURE f86: Session Summary
   - App background/close hone par "Today you played X matches, earned Y coins" popup
   - Tracks session matches joined & coins earned since app open
   ================================================================ */
(function () {
  'use strict';

  var _sessionStart = Date.now();
  var _sessionMatches = 0;
  var _sessionCoinsStart = 0;
  var _summaryShown = false;

  function initSession() {
    if (!window.UD) return;
    _sessionCoinsStart = Number(window.UD.coins) || 0;
    _sessionStart = Date.now();
    _sessionMatches = 0;
    _summaryShown = false;
  }

  // Track match joins during session
  window._f86_trackMatchJoin = function () { _sessionMatches++; };

  function showSummary() {
    if (_summaryShown) return;
    if (!window.UD) return;
    var coinsNow   = Number(window.UD.coins) || 0;
    var coinsDiff  = coinsNow - _sessionCoinsStart;
    var mins       = Math.round((Date.now() - _sessionStart) / 60000);
    if (mins < 1 && _sessionMatches === 0) return; // too short to show
    _summaryShown = true;

    // Remove old
    var old = document.getElementById('_f86Summary');
    if (old) old.remove();

    var toast = document.createElement('div');
    toast.id = '_f86Summary';
    toast.style.cssText = [
      'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);',
      'background:linear-gradient(135deg,#111118,#1a1a28);',
      'border:1px solid rgba(0,255,156,.25);border-radius:18px;',
      'padding:16px 20px;z-index:99995;',
      'box-shadow:0 8px 32px rgba(0,0,0,.7);',
      'min-width:260px;max-width:320px;',
      'animation:f86In .35s ease'
    ].join('');

    var coinColor = coinsDiff >= 0 ? '#00ff9c' : '#ff6b6b';
    var coinSign  = coinsDiff >= 0 ? '+' : '';

    toast.innerHTML =
      '<style>@keyframes f86In{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}</style>' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
        '<div style="font-size:28px">📊</div>' +
        '<div>' +
          '<div style="font-size:13px;font-weight:900;color:#fff">Session Summary</div>' +
          '<div style="font-size:11px;color:#555">' + mins + ' min active</div>' +
        '</div>' +
        '<div onclick="document.getElementById(\'_f86Summary\').remove()" style="margin-left:auto;color:#555;font-size:18px;cursor:pointer;padding:4px">✕</div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
        '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px;text-align:center">' +
          '<div style="font-size:20px;font-weight:900;color:#00d4ff">' + _sessionMatches + '</div>' +
          '<div style="font-size:10px;color:#666">Matches Joined</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px;text-align:center">' +
          '<div style="font-size:20px;font-weight:900;color:' + coinColor + '">' + coinSign + coinsDiff + '</div>' +
          '<div style="font-size:10px;color:#666">Coins Change</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) {
        toast.style.transition = 'opacity .3s';
        toast.style.opacity = '0';
        setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
      }
    }, 8000);
  }

  // Show on page hide (tab switch / close)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) showSummary();
    else { _summaryShown = false; } // reset on return
  });

  // Init when UD ready
  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.U) { clearInterval(_iv); initSession(); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f86] ✅ Session Summary loaded');
})();
