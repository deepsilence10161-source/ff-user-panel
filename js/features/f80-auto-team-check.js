/* =============================================
   FEATURE 35: Auto Team Readiness Check
   - Duo/Squad match join karne se pehle
   - Check kare kya team complete hai
   - Agar nahi → smart warning (not blocking)
   ============================================= */
(function() {
  'use strict';

  function checkTeamReady(mode, callback) {
    if (!window.UD) { callback(true); return; }
    var UD = window.UD;
    mode = (mode || 'solo').toLowerCase();

    if (mode === 'solo') { callback(true); return; }

    if (mode === 'duo') {
      var hasPartner = UD.duoTeam && UD.duoTeam.memberUid;
      if (hasPartner) { callback(true); return; }
      showTeamWarning('duo');
      callback(false);
      return;
    }

    if (mode === 'squad') {
      var members = (UD.squadTeam && UD.squadTeam.members) || [];
      if (members.length >= 3) { callback(true); return; }
      showTeamWarning('squad', 3 - members.length);
      callback(false);
    }
  }

  function showTeamWarning(mode, needed) {
    if (!window.openModal) return;
    var h = '<div style="text-align:center;padding:8px">' +
      '<div style="font-size:48px;margin-bottom:8px">' + (mode === 'duo' ? '👥' : '👪') + '</div>' +
      '<div style="font-size:16px;font-weight:800;margin-bottom:6px">Team Incomplete!</div>' +
      '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">' +
        (mode === 'duo'
          ? 'Duo match ke liye partner add karo Profile > My Team se'
          : needed + ' aur squad member chahiye. Profile > My Team se add karo') +
      '</div>' +
      '<button onclick="if(window.navTo)navTo(\'profile\');if(window.closeModal)closeModal()" style="width:100%;padding:12px;border-radius:12px;background:var(--primary);color:#000;font-weight:800;border:none;cursor:pointer;margin-bottom:8px">👥 Team Add Karo</button>' +
      '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:10px;border-radius:12px;background:transparent;border:1px solid var(--border);color:var(--txt2);font-size:13px;cursor:pointer">Cancel</button>' +
    '</div>';
    window.openModal('⚠️ Team Check', h);
  }

  window.f35TeamCheck = { check: checkTeamReady, warn: showTeamWarning };
})();
