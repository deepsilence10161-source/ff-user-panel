/* ================================================================
   FEATURE f85: Performance Trend Graph
   - Last 7 / 30 days kills & wins animated mini-graph
   - Shows on Profile / Stats tab
   - Reads from Firebase users/{uid}/matchHistory
   ================================================================ */
(function () {
  'use strict';

  window.f85_renderTrendGraph = function (containerId, days) {
    var uid = window.U && window.U.uid;
    var db  = window.db;
    if (!uid || !db || !document.getElementById(containerId)) return;

    days = days || 7;
    var since = Date.now() - days * 86400000;

    db.ref('matchResults').orderByChild('uid').equalTo(uid).once('value', function (snap) {
      var kills = [], wins = [], labels = [];
      var buckets = {};

      if (snap.exists()) {
        snap.forEach(function (c) {
          var d = c.val();
          if (!d.timestamp || d.timestamp < since) return;
          var day = new Date(d.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
          if (!buckets[day]) buckets[day] = { kills: 0, wins: 0 };
          buckets[day].kills += Number(d.kills) || 0;
          if (d.rank === 1 || d.rank === '1') buckets[day].wins += 1;
        });
      }

      // Fill last N days
      for (var i = days - 1; i >= 0; i--) {
        var dt = new Date(Date.now() - i * 86400000);
        var lbl = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        labels.push(lbl);
        kills.push((buckets[lbl] || {}).kills || 0);
        wins.push((buckets[lbl] || {}).wins || 0);
      }

      var maxK = Math.max.apply(null, kills) || 1;
      var maxW = Math.max.apply(null, wins) || 1;
      var totalK = kills.reduce(function (a, b) { return a + b; }, 0);
      var totalW = wins.reduce(function (a, b) { return a + b; }, 0);

      var bars = kills.map(function (k, i) {
        var hK = Math.round((k / maxK) * 60);
        var hW = Math.round((wins[i] / maxW) * 60);
        return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;flex:1">' +
          '<div style="display:flex;align-items:flex-end;gap:2px;height:64px">' +
            '<div title="Kills: ' + k + '" style="width:8px;height:' + hK + 'px;background:linear-gradient(180deg,#00ff9c,#00c47a);border-radius:3px 3px 0 0;transition:height .4s ease"></div>' +
            '<div title="Wins: ' + wins[i] + '" style="width:8px;height:' + hW + 'px;background:linear-gradient(180deg,#ffd700,#ffaa00);border-radius:3px 3px 0 0;transition:height .4s ease"></div>' +
          '</div>' +
          '<div style="font-size:9px;color:#555;writing-mode:vertical-lr;transform:rotate(180deg);max-height:32px;overflow:hidden">' + labels[i].split(' ')[0] + '</div>' +
        '</div>';
      }).join('');

      var html =
        '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px 12px;margin:10px 0">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
            '<span style="font-size:13px;font-weight:800;color:#fff">📈 Performance — Last ' + days + ' Days</span>' +
            '<div style="display:flex;gap:8px">' +
              '<span onclick="window.f85_renderTrendGraph(\'' + containerId + '\',7)" style="font-size:10px;font-weight:700;color:' + (days===7?'#00ff9c':'#555') + ';cursor:pointer">7D</span>' +
              '<span onclick="window.f85_renderTrendGraph(\'' + containerId + '\',30)" style="font-size:10px;font-weight:700;color:' + (days===30?'#00ff9c':'#555') + ';cursor:pointer">30D</span>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:flex-end;gap:2px;overflow-x:auto;padding-bottom:4px">' + bars + '</div>' +
          '<div style="display:flex;gap:14px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.05)">' +
            '<div style="display:flex;align-items:center;gap:5px"><div style="width:8px;height:8px;border-radius:2px;background:#00ff9c"></div><span style="font-size:11px;color:#888">Kills: <b style="color:#fff">' + totalK + '</b></span></div>' +
            '<div style="display:flex;align-items:center;gap:5px"><div style="width:8px;height:8px;border-radius:2px;background:#ffd700"></div><span style="font-size:11px;color:#888">Wins: <b style="color:#fff">' + totalW + '</b></span></div>' +
          '</div>' +
        '</div>';

      var el = document.getElementById(containerId);
      if (el) el.innerHTML = html;
    });
  };

  // Auto-inject into profile stats section when it renders
  function tryInject() {
    var el = document.getElementById('f85TrendGraph');
    if (el && window.U) {
      window.f85_renderTrendGraph('f85TrendGraph', 7);
      return;
    }
    // Create placeholder if stats section exists
    var statsSection = document.getElementById('profileStatsSection') ||
                       document.querySelector('.profile-stats') ||
                       document.querySelector('[data-section="stats"]');
    if (statsSection && !document.getElementById('f85TrendGraph')) {
      var div = document.createElement('div');
      div.id = 'f85TrendGraph';
      statsSection.appendChild(div);
      if (window.U) window.f85_renderTrendGraph('f85TrendGraph', 7);
    }
  }

  // Hook into boot
  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.U) { clearInterval(_iv); setTimeout(tryInject, 1200); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  // Also hook into tab switches
  document.addEventListener('click', function (e) {
    var tab = e.target && (e.target.closest('[data-nav="profile"]') || e.target.closest('.nav-item[data-tab="profile"]'));
    if (tab) setTimeout(tryInject, 600);
  });

  console.log('[f85] ✅ Performance Trend Graph loaded');
})();
