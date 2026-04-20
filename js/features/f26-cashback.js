/* ================================================================
   f26-cashback.js — Cashback Feature
   Safe no-op module. Cashback logic handled via coin reward system.
   ================================================================ */
(function() {
  'use strict';

  // Cashback feature placeholder — rewards are issued via coin system
  window.F26Cashback = {
    init: function() {
      // No active cashback UI needed — handled by coin economy
    },
    apply: function(userId, amount) {
      // Future: hook into coin grant if cashback logic is added
      return false;
    }
  };

  // Auto-init when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.F26Cashback.init();
    });
  } else {
    window.F26Cashback.init();
  }

})();
