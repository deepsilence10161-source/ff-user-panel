/* =============================================
   FEATURE 38: Beautiful Result Card in My Matches
   - Completed match pe result summary card
   - Rank, kills, prize, cashback — visually rich
   - Share button to share result
   ============================================= */
(function() {
  'use strict';

  function buildResultCard(jr, matchName) {
    var r = jr.result || {};
    var rank = r.rank || jr.rank;
    var kills = r.kills || jr.kills || 0;
    var prize = r.prize || r.winnings || jr.reward || 0;
    var cashback = jr.cashbackGiven;

    if (!rank && !kills && !prize) return '';

    var rankColor = rank === 1 ? '#ffd700' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : 'var(--txt)';
    var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;

    return '<div style="margin-top:8px;background:linear-gradient(135deg,rgba(255,215,0,.07),rgba(0,0,0,0));border:1px solid rgba(255,215,0,.2);border-radius:12px;padding:10px 12px">' +
      '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="text-align:center;min-width:44px">' +
          '<div style="font-size:24px">' + medal + '</div>' +
          '<div style="font-size:9px;color:var(--txt2)">Rank</div>' +
        '</div>' +
        '<div style="text-align:center;min-width:44px">' +
          '<div style="font-size:18px;font-weight:900;color:#ff6b6b">' + kills + '💀</div>' +
          '<div style="font-size:9px;color:var(--txt2)">Kills</div>' +
        '</div>' +
        (prize > 0 ? '<div style="text-align:center;min-width:44px"><div style="font-size:18px;font-weight:900;color:var(--green)">₹' + prize + '</div><div style="font-size:9px;color:var(--txt2)">Won</div></div>' : '') +
        (cashback ? '<div style="text-align:center;min-width:44px"><div style="font-size:14px;font-weight:700;color:#ffd700">🪙CB</div><div style="font-size:9px;color:var(--txt2)">Cashback</div></div>' : '') +
        '<div style="margin-left:auto">' +
          '<button onclick="window.f38ResultCard.share(\'' + (jr.matchId||'') + '\',' + rank + ',' + kills + ',' + prize + ')" style="padding:6px 10px;border-radius:8px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);color:var(--green);font-size:10px;font-weight:700;cursor:pointer"><i class="fas fa-share-alt"></i></button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function shareResult(matchId, rank, kills, prize) {
    var t = window.MT && window.MT[matchId];
    var text = '🎮 Mini eSports Result!\n' +
      '🏆 Match: ' + (t ? t.name : 'Tournament') + '\n' +
      '#' + rank + ' Rank · ' + kills + ' Kills' +
      (prize > 0 ? ' · ₹' + prize + ' Won!' : '') + '\n' +
      '📱 mini-esports.app';
    if (navigator.share) navigator.share({ text: text });
    else if (window.copyTxt) { window.copyTxt(text); if (window.toast) window.toast('Result copied!', 'ok'); }
  }

  window.f38ResultCard = { build: buildResultCard, share: shareResult };
  window.buildResultCard = buildResultCard;
})();
