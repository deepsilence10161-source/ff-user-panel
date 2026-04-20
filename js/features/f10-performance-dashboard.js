/* =============================================
   FEATURE 10: Personal Performance Dashboard
   - Profile me "My Stats" button aata hai
   - Kills/Wins/Earnings ka bar chart (pure CSS)
   - Win rate, K/D ratio, best match highlight
   - Koi external library nahi chahiye
   ============================================= */
(function() {
  'use strict';

  function calcKD(stats) {
    var kills = Number(stats.kills) || 0;
    var matches = Number(stats.matches) || 1;
    var wins = Number(stats.wins) || 0;
    var deaths = matches - wins;
    if (deaths <= 0) return kills.toFixed(1);
    return (kills / deaths).toFixed(2);
  }

  function calcWinRate(stats) {
    var matches = Number(stats.matches) || 0;
    if (matches === 0) return '0';
    return Math.round((Number(stats.wins)||0) / matches * 100);
  }

  function showPerformanceDashboard() {
    if (!window.UD) return;
    var st = window.UD.stats || {};
    var matches = Number(st.matches) || 0;
    var wins = Number(st.wins) || 0;
    var kills = Number(st.kills) || 0;
    var earnings = Number(st.earnings) || 0;
    var wr = calcWinRate(st);
    var kd = calcKD(st);
    var avgKills = matches > 0 ? (kills / matches).toFixed(1) : '0';
    var avgEarn = matches > 0 ? Math.round(earnings / matches) : 0;

    // Bar chart data
    var maxBar = Math.max(matches, wins * 5, kills, 1);
    function bar(val, color, label, unit) {
      var pct = Math.min(Math.round((val / maxBar) * 100), 100);
      return '<div style="margin-bottom:12px">' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">' +
        '<span style="color:var(--txt2)">' + label + '</span>' +
        '<span style="font-weight:700;color:' + color + '">' + val + unit + '</span></div>' +
        '<div style="height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:4px;transition:width 1s ease"></div>' +
        '</div></div>';
    }

    var h = '<div>';
    // Stat chips
    h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:16px">';
    var chips = [
      { val: matches, label: 'Matches', color: '#00d4ff' },
      { val: wins, label: 'Wins', color: '#00ff9c' },
      { val: kills, label: 'Kills', color: '#ff2d55' },
      { val: '₹'+earnings, label: 'Earned', color: '#ffaa00' }
    ];
    chips.forEach(function(c) {
      h += '<div style="text-align:center;padding:10px 4px;background:var(--card);border:1px solid var(--border);border-radius:10px">';
      h += '<div style="font-size:16px;font-weight:900;color:' + c.color + '">' + c.val + '</div>';
      h += '<div style="font-size:9px;color:var(--txt2);margin-top:2px">' + c.label + '</div></div>';
    });
    h += '</div>';

    // Ratios
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">';
    [
      { val: wr + '%', label: 'Win Rate', color: '#00ff9c' },
      { val: kd, label: 'K/D Ratio', color: '#ff2d55' },
      { val: avgKills, label: 'Avg Kills', color: '#b964ff' }
    ].forEach(function(r) {
      h += '<div style="text-align:center;padding:12px 4px;background:linear-gradient(135deg,rgba(255,255,255,.03),rgba(255,255,255,.01));border:1px solid var(--border);border-radius:12px">';
      h += '<div style="font-size:20px;font-weight:900;color:' + r.color + '">' + r.val + '</div>';
      h += '<div style="font-size:9px;color:var(--txt2);margin-top:2px">' + r.label + '</div></div>';
    });
    h += '</div>';

    // Progress bars
    h += '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px">';
    h += '<div style="font-size:12px;font-weight:700;margin-bottom:10px;color:var(--txt2)">Performance Bars</div>';
    h += bar(matches, '#00d4ff', 'Total Matches', '');
    h += bar(wins, '#00ff9c', 'Wins', '');
    h += bar(kills, '#ff2d55', 'Total Kills', '');
    h += '</div>';

    // Avg per match
    h += '<div style="margin-top:12px;padding:10px 12px;background:rgba(255,170,0,.06);border:1px solid rgba(255,170,0,.15);border-radius:10px;display:flex;justify-content:space-between">';
    h += '<span style="font-size:12px;color:var(--txt2)">Avg Earnings/Match</span>';
    h += '<span style="font-size:13px;font-weight:800;color:#ffaa00">₹' + avgEarn + '</span>';
    h += '</div>';

    // Rank badge
    var rk = window.calcRk ? window.calcRk(st) : { badge: 'Player', emoji: '🎮' };
    h += '<div style="margin-top:12px;text-align:center;padding:12px;background:linear-gradient(135deg,rgba(185,100,255,.08),rgba(121,40,202,.04));border:1px solid rgba(185,100,255,.2);border-radius:12px">';
    h += '<div style="font-size:24px">' + rk.emoji + '</div>';
    h += '<div style="font-size:13px;font-weight:800;color:var(--purple)">' + rk.badge + '</div>';
    h += '<div style="font-size:10px;color:var(--txt2)">Current Rank</div>';
    h += '</div>';

    h += '</div>';
    if (window.openModal) window.openModal('📊 My Performance', h);
  }

  // Add button to profile
  function hookRenderProfile() {
    var orig = window.renderProfile;
    if (!orig || window._f10Hooked) return;
    window._f10Hooked = true;

    window.renderProfile = function() {
      orig.apply(this, arguments);
      setTimeout(function() {
        var pc = document.getElementById('profileContent');
        if (!pc || pc.querySelector('.f10-perf-btn')) return;

        var btn = document.createElement('button');
        btn.className = 'prof-btn f10-perf-btn';
        btn.style.cssText = 'width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,rgba(0,212,255,.12),rgba(0,255,156,.06));color:#00d4ff;border:1px solid rgba(0,212,255,.2);font-weight:700;font-size:13px;cursor:pointer;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:8px';
        btn.innerHTML = '📊 Performance Dashboard';
        btn.onclick = showPerformanceDashboard;

        var firstSection = pc.querySelector('.prof-section');
        if (firstSection) firstSection.parentNode.insertBefore(btn, firstSection);
      }, 250);
    };
  }

  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.renderProfile) { clearInterval(_check); hookRenderProfile(); }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f10Dashboard = { show: showPerformanceDashboard };
  window.showPerformanceDashboard = showPerformanceDashboard;
})();
