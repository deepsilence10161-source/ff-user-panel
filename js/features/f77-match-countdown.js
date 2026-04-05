/* =============================================
   FEATURE 32: Live Match Countdown Timers on Cards
   - Har match card pe live countdown
   - Color changes as match approaches
   - Auto-refresh every 30s
   ============================================= */
(function() {
  'use strict';

  function getCountdown(matchTime) {
    var diff = Number(matchTime) - Date.now();
    if (diff <= 0) return { text: 'Starting!', color: '#ff4500', urgent: true };
    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    if (diff < 5 * 60 * 1000)  return { text: m + 'm ' + s + 's', color: '#ff4500', urgent: true };
    if (diff < 30 * 60 * 1000) return { text: m + ' min', color: '#ffaa00', urgent: false };
    if (diff < 2 * 3600000)    return { text: h + 'h ' + m + 'm', color: '#ffd700', urgent: false };
    return { text: h + 'h ' + m + 'm', color: 'var(--txt2)', urgent: false };
  }

  function updateAllCountdowns() {
    document.querySelectorAll('[data-match-time]').forEach(function(el) {
      var mt = el.getAttribute('data-match-time');
      if (!mt) return;
      var cd = getCountdown(mt);
      el.textContent = '⏰ ' + cd.text;
      el.style.color = cd.color;
      if (cd.urgent) el.style.fontWeight = '800';
    });
  }

  setInterval(updateAllCountdowns, 30000);
  setTimeout(updateAllCountdowns, 500);

  window.f32Countdown = { update: updateAllCountdowns, get: getCountdown };
  window.startMatchTimers = function() {
    setTimeout(updateAllCountdowns, 200);
  };
})();
