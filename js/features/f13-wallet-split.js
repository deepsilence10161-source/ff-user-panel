/* =============================================
   FEATURE 13: Wallet Split View
   - Wallet screen pe animated pie chart dikhta hai
   - Deposited / Winnings / Bonus alag colors me
   - Tap karo to breakdown detail popup aata hai
   - Pure CSS/SVG chart, koi library nahi
   ============================================= */
(function() {
  'use strict';

  function buildSplitChart(dep, win, bon) {
    var total = dep + win + bon;
    if (total <= 0) return '';

    var depPct = Math.round(dep / total * 100);
    var winPct = Math.round(win / total * 100);
    var bonPct = 100 - depPct - winPct;

    // SVG donut chart
    var r = 40, cx = 50, cy = 50;
    var circumference = 2 * Math.PI * r;

    function segment(pct, color, offset) {
      if (pct <= 0) return '';
      var dash = (pct / 100) * circumference;
      return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + color + '" ' +
        'stroke-width="16" stroke-dasharray="' + dash + ' ' + circumference + '" ' +
        'stroke-dashoffset="-' + offset + '" stroke-linecap="butt" ' +
        'style="transition:stroke-dasharray .8s ease"/>';
    }

    var dep_dash = (depPct / 100) * circumference;
    var win_dash = (winPct / 100) * circumference;

    var svgHTML = '<svg width="100" height="100" style="transform:rotate(-90deg)">';
    svgHTML += '<circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="16"/>';
    svgHTML += segment(depPct, '#00d4ff', 0);
    svgHTML += segment(winPct, '#00ff9c', dep_dash);
    svgHTML += segment(bonPct, '#ffaa00', dep_dash + win_dash);
    svgHTML += '</svg>';

    var html = '<div onclick="window.f13WalletSplit&&f13WalletSplit.showDetail()" style="cursor:pointer;background:linear-gradient(135deg,rgba(255,255,255,.03),rgba(255,255,255,.01));border:1px solid var(--border);border-radius:16px;padding:14px;margin-bottom:10px">';
    html += '<div style="font-size:11px;color:var(--txt2);margin-bottom:10px;font-weight:600">💰 Balance Breakdown</div>';
    html += '<div style="display:flex;align-items:center;gap:16px">';
    html += '<div style="position:relative;flex-shrink:0">' + svgHTML;
    html += '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">';
    html += '<div style="font-size:11px;font-weight:800;color:var(--txt)">₹' + total + '</div>';
    html += '<div style="font-size:8px;color:var(--txt2)">Total</div></div></div>';
    html += '<div style="flex:1">';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><div style="width:10px;height:10px;border-radius:3px;background:#00d4ff;flex-shrink:0"></div><div style="font-size:11px;flex:1;color:var(--txt2)">Deposited</div><div style="font-size:12px;font-weight:700;color:#00d4ff">₹' + dep + '</div></div>';
    html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px"><div style="width:10px;height:10px;border-radius:3px;background:#00ff9c;flex-shrink:0"></div><div style="font-size:11px;flex:1;color:var(--txt2)">Winnings</div><div style="font-size:12px;font-weight:700;color:#00ff9c">₹' + win + '</div></div>';
    html += '<div style="display:flex;align-items:center;gap:6px"><div style="width:10px;height:10px;border-radius:3px;background:#ffaa00;flex-shrink:0"></div><div style="font-size:11px;flex:1;color:var(--txt2)">Bonus</div><div style="font-size:12px;font-weight:700;color:#ffaa00">₹' + bon + '</div></div>';
    html += '</div></div>';
    html += '<div style="font-size:9px;color:var(--txt2);text-align:right;margin-top:6px">Tap for details →</div>';
    html += '</div>';
    return html;
  }

  function showDetail() {
    if (!window.UD) return;
    var rm = window.UD.realMoney || {};
    var dep = Number(rm.deposited) || 0;
    var win = Number(rm.winnings) || 0;
    var bon = Number(rm.bonus) || 0;
    var total = dep + win + bon;

    var h = '<div>';
    [
      { label: '💙 Deposited', val: dep, color: '#00d4ff', desc: 'Tumne apne paison se add kiya' },
      { label: '💚 Winnings', val: win, color: '#00ff9c', desc: 'Match jeeth ke kamaya' },
      { label: '💛 Bonus', val: bon, color: '#ffaa00', desc: 'Referral/event se mila' }
    ].forEach(function(item) {
      var pct = total > 0 ? Math.round(item.val / total * 100) : 0;
      h += '<div style="padding:12px;border-radius:12px;background:var(--card);border:1px solid var(--border);margin-bottom:8px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
      h += '<span style="font-size:13px;font-weight:700">' + item.label + '</span>';
      h += '<span style="font-size:16px;font-weight:900;color:' + item.color + '">₹' + item.val + '</span></div>';
      h += '<div style="font-size:10px;color:var(--txt2);margin-bottom:6px">' + item.desc + '</div>';
      h += '<div style="height:4px;background:rgba(255,255,255,.06);border-radius:2px"><div style="height:100%;width:' + pct + '%;background:' + item.color + ';border-radius:2px"></div></div>';
      h += '<div style="font-size:9px;color:var(--txt2);text-align:right;margin-top:2px">' + pct + '% of total</div>';
      h += '</div>';
    });
    h += '<div style="text-align:center;padding:10px;background:rgba(255,255,255,.03);border-radius:10px;border:1px solid var(--border)">';
    h += '<div style="font-size:11px;color:var(--txt2)">Total Balance</div>';
    h += '<div style="font-size:22px;font-weight:900;color:var(--green)">₹' + total + '</div>';
    h += '</div></div>';

    if (window.openModal) window.openModal('💰 Balance Breakdown', h);
  }

  // Hook renderWallet
  function hookRenderWallet() {
    var orig = window.renderWallet;
    if (!orig || window._f13Hooked) return;
    window._f13Hooked = true;

    window.renderWallet = function() {
      orig.apply(this, arguments);
      setTimeout(function() {
        var rm = (window.UD && window.UD.realMoney) || {};
        var dep = Number(rm.deposited) || 0;
        var win = Number(rm.winnings) || 0;
        var bon = Number(rm.bonus) || 0;

        var wMain = document.getElementById('walletMain');
        if (!wMain || wMain.querySelector('.f13-split')) return;

        var div = document.createElement('div');
        div.className = 'f13-split';
        div.innerHTML = buildSplitChart(dep, win, bon);

        var histSection = wMain.querySelector('.wh-section');
        if (histSection) wMain.insertBefore(div, histSection);
        else wMain.appendChild(div);
      }, 300);
    };
  }

  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.renderWallet) { clearInterval(_check); hookRenderWallet(); }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f13WalletSplit = { buildChart: buildSplitChart, showDetail: showDetail };
})();
