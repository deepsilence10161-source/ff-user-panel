/* ================================================================
   smart-automations.js — Smart Automations Coordinator
   Coordinates auto-triggers across features after DOM is ready.
   ================================================================ */
(function() {
  'use strict';

  function runAutomations() {
    // Daily streak auto-check
    if (typeof window.doCheckIn === 'function') {
      // Don't auto-trigger check-in — user must click
    }

    // Match reminder auto-setup
    if (typeof window.F37PerMatchReminder === 'object' && window.F37PerMatchReminder.init) {
      try { window.F37PerMatchReminder.init(); } catch(e) {}
    }

    // Combo streak init
    if (typeof window.F90ComboStreak === 'object' && window.F90ComboStreak.init) {
      try { window.F90ComboStreak.init(); } catch(e) {}
    }

    // Comeback alert init
    if (typeof window.F87ComebackAlert === 'object' && window.F87ComebackAlert.init) {
      try { window.F87ComebackAlert.init(); } catch(e) {}
    }

    // Session summary init
    if (typeof window.F86SessionSummary === 'object' && window.F86SessionSummary.init) {
      try { window.F86SessionSummary.init(); } catch(e) {}
    }

    // Milestone tracker init
    if (typeof window.F89MilestoneTracker === 'object' && window.F89MilestoneTracker.init) {
      try { window.F89MilestoneTracker.init(); } catch(e) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAutomations);
  } else {
    runAutomations();
  }

})();
