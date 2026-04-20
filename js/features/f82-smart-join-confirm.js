/* =============================================
   FEATURE 37: Smart Join Confirmation
   - Join se pehle beautiful confirm modal
   - Shows: match name, slot, entry fee, team members
   - One-tap confirm — no accidental joins
   ============================================= */
(function() {
  'use strict';

  function showJoinConfirm(matchId, onConfirm) {
    var t = window.MT && window.MT[matchId];
    if (!t || !window.UD || !window.openModal) { if (onConfirm) onConfirm(); return; }

    var mode = (t.mode || 'solo').toLowerCase();
    var isCoin = (t.entryType || '').toLowerCase() === 'coin' || Number(t.entryFee) === 0;
    var fee = Number(t.entryFee) || 0;
    var UD = window.UD;

    // Team info
    var teamHTML = '';
    if (mode === 'duo' && UD.duoTeam && UD.duoTeam.memberUid) {
      teamHTML = '<div style="background:rgba(0,212,255,.06);border:1px solid rgba(0,212,255,.15);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px"><i class="fas fa-user-friends" style="color:var(--blue);margin-right:6px"></i>With: <strong>' + (UD.duoTeam.memberName || 'Partner') + '</strong></div>';
    } else if (mode === 'squad') {
      var sq = (UD.squadTeam && UD.squadTeam.members) || [];
      if (sq.length) teamHTML = '<div style="background:rgba(185,100,255,.06);border:1px solid rgba(185,100,255,.15);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px"><i class="fas fa-users" style="color:var(--purple);margin-right:6px"></i>Squad: You + ' + sq.slice(0,3).map(function(m){return m.name||'?';}).join(', ') + '</div>';
    }

    var h = '<div>' +
      '<div style="text-align:center;padding:14px;background:rgba(0,255,156,.05);border-radius:14px;margin-bottom:14px">' +
        '<div style="font-size:12px;color:var(--txt2);margin-bottom:4px">' + mode.toUpperCase() + ' · ' + (t.map || '') + '</div>' +
        '<div style="font-size:18px;font-weight:800">' + t.name + '</div>' +
        '<div style="font-size:13px;color:var(--txt2);margin-top:4px">Entry: <strong style="color:' + (isCoin ? '#ffd700' : 'var(--green)') + '">' + (isCoin ? '🪙 ' + fee + ' Coins' : '₹' + fee) + '</strong></div>' +
        '<div style="font-size:11px;color:var(--txt2);margin-top:2px">Prize Pool: <strong>₹' + (t.prizePool||0) + '</strong></div>' +
      '</div>' +
      teamHTML +
      '<div style="font-size:11px;color:var(--txt2);text-align:center;margin-bottom:14px">Entry fee non-refundable hai after joining</div>' +
      '<button onclick="window._confirmJoin()" style="width:100%;padding:13px;border-radius:12px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:900;border:none;cursor:pointer;font-size:14px;margin-bottom:8px">⚡ Confirm Join</button>' +
      '<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:10px;border-radius:12px;background:transparent;border:1px solid var(--border);color:var(--txt2);font-size:13px;cursor:pointer">Cancel</button>' +
    '</div>';

    window._confirmJoin = function() {
      if (window.closeModal) window.closeModal();
      if (onConfirm) onConfirm();
    };
    window.openModal('🎮 Join Match?', h);
  }

  window.f37JoinConfirm = { show: showJoinConfirm };
  window.showJoinConfirm = showJoinConfirm;
})();
