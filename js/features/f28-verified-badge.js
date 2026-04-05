/* =============================================
   FEATURE 28: Verified Player Badge
   - ONLY shows in public user search results
   - NOT on own profile page
   ============================================= */
(function() {
  'use strict';

  function getVerifiedBadgeHTML(size) {
    size = size || 'sm';
    var s = size === 'lg' ? '14px' : '11px';
    var p = size === 'lg' ? '3px 10px' : '2px 7px';
    return '<span style="background:rgba(0,255,156,.12);color:#00ff9c;border:1px solid rgba(0,255,156,.35);border-radius:20px;padding:' + p + ';font-size:' + s + ';font-weight:700;white-space:nowrap"><i class="fas fa-check-circle" style="margin-right:3px"></i>Verified</span>';
  }

  // Do NOT inject badge into own profile — only expose for public search use
  window.f28VerifiedBadge = { getHTML: getVerifiedBadgeHTML };
  window.getVerifiedBadgeHTML = getVerifiedBadgeHTML;
  window._f28Hooked = true; // prevent any hook attempts
})();
