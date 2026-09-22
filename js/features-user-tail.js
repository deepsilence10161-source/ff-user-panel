/* ── features-user-tail: post-IIFE stubs (showProfileUpdate_v2, updateSeasonDisplay, showResultScreenshot) ── */

/* ── showProfileUpdate_v2: Enhanced profile update (v17 stub → calls v1) ── */
window.showProfileUpdate_v2 = function() {
  if (typeof showProfileUpdate === 'function') {
    showProfileUpdate();
  }
};

/* ── updateSeasonDisplay: Updates season UI elements ── */
window.updateSeasonDisplay = function(season) {
  if (!season) return;
  var els = document.querySelectorAll('[data-season-name]');
  els.forEach(function(el) { el.textContent = season.name || ''; });
  var rankEls = document.querySelectorAll('[data-season-rank]');
  rankEls.forEach(function(el) { el.textContent = season.rank || ''; });
};

/* ✅ AUDIT FIX: "Result" button on completed matches in match history called
   this but it was never defined — tap did nothing, with no feedback at all.
   Until the real screenshot viewer is wired to wherever the admin-side
   result image is actually stored, show clear feedback instead of a dead
   tap so it doesn't look broken. */
if (!window.showResultScreenshot) {
  window.showResultScreenshot = function(matchId, matchName) {
    if (window.toast) toast((matchName || 'Match') + ' ka result screenshot abhi yahan dikhane ka feature ban raha hai!', 'inf');
  };
}
