/* =============================================
   FEATURE 34: Prize Breakdown Popup on Match Card
   - Match card pe "Prize" tap karo — full breakdown
   - 1st/2nd/3rd + per kill clearly dikhao
   - Win probability bhi dikhao
   ============================================= */
(function() {
  'use strict';

  function showBreakdown(matchId) {
    var t = window.MT && window.MT[matchId];
    if (!t || !window.openModal) return;
    var pool = Number(t.prizePool) || 0;
    var slots = Number(t.maxSlots) || 1;
    var mode = (t.mode || 'solo').toLowerCase();
    var first = Number(t.firstPrize) || 0;
    var second = Number(t.secondPrize) || 0;
    var third = Number(t.thirdPrize) || 0;
    var perKill = Number(t.perKill) || 0;

    /* Stylish prize breakdown like Image 9 */
    var h = '<div style="background:#050507;border-radius:16px;overflow:hidden">';
    /* Header */
    h += '<div style="text-align:center;padding:20px 16px 16px">';
    h += '<div style="font-size:32px;margin-bottom:8px">🏆</div>';
    h += '<div style="font-size:18px;font-weight:900;color:#ffd700;margin-bottom:4px">Prize Breakdown</div>';
    h += '<div style="font-size:11px;color:#555">' + slots + ' Slots · ' + mode.toUpperCase() + ' · Pool: 💎' + pool + '</div>';
    h += '</div>';

    /* Prize rows - styled like screenshot */
    var prizes = [];
    if (first)  prizes.push({rank:'1st',icon:'🏆',val:first,bg:'linear-gradient(135deg,rgba(255,215,0,.12),rgba(255,140,0,.06))',border:'rgba(255,215,0,.3)',color:'#ffd700',glow:'rgba(255,215,0,.2)'});
    if (second) prizes.push({rank:'2nd',icon:'🥈',val:second,bg:'linear-gradient(135deg,rgba(192,192,192,.1),rgba(192,192,192,.04))',border:'rgba(0,212,255,.3)',color:'#c0c0c0',glow:'rgba(0,212,255,.15)'});
    if (third)  prizes.push({rank:'3rd',icon:'🥉',val:third,bg:'linear-gradient(135deg,rgba(205,127,50,.1),rgba(205,127,50,.04))',border:'rgba(255,140,0,.3)',color:'#cd7f32',glow:'rgba(255,140,0,.15)'});

    h += '<div style="padding:0 12px 12px;display:flex;flex-direction:column;gap:8px">';
    prizes.forEach(function(p) {
      h += '<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:' + p.bg + ';border:1px solid ' + p.border + ';box-shadow:0 4px 20px ' + p.glow + ';position:relative;overflow:hidden">';
      /* Glow line at bottom */
      h += '<div style="position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,' + p.border + ',transparent)"></div>';
      h += '<div style="font-size:26px">' + p.icon + '</div>';
      h += '<div style="flex:1"><div style="font-size:14px;font-weight:800;color:#fff">' + p.rank + ' Prize</div></div>';
      h += '<div style="font-size:22px;font-weight:900;color:' + p.color + '">💎' + p.val + '</div>';
      h += '</div>';
    });
    if (perKill > 0) {
      h += '<div style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:12px;background:rgba(255,60,60,.08);border:1px solid rgba(255,60,60,.2)">';
      h += '<div style="font-size:22px">💀</div>';
      h += '<div style="flex:1"><div style="font-size:13px;font-weight:700;color:#ff4444">Per Kill Bonus</div></div>';
      h += '<div style="font-size:18px;font-weight:900;color:#ff6b6b">💎' + perKill + '</div>';
      h += '</div>';
    }
    h += '</div></div>';

    window.openModal('🏆 Prize Breakdown', h);
  }

  window.f34PrizeBreakdown = { show: showBreakdown };
  window.showPrizeBreakdown = showBreakdown;
})();
