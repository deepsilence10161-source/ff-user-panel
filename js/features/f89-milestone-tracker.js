/* ================================================================
   FEATURE f89: Milestone Tracker
   - "50 more kills for Kill Machine achievement" progress bar
   - Milestones: kills, wins, matches, referrals, earnings
   - Small card on home/profile
   ================================================================ */
(function () {
  'use strict';

  var MILESTONES = [
    { id: 'kills_50',    label: 'Sharpshooter',   icon: '🎯', field: 'totalKills',   target: 50,   reward: '50 coins' },
    { id: 'kills_200',   label: 'Kill Machine',    icon: '🔫', field: 'totalKills',   target: 200,  reward: '200 coins' },
    { id: 'wins_10',     label: 'Veteran',         icon: '🏆', field: 'totalWins',    target: 10,   reward: '100 coins' },
    { id: 'wins_50',     label: 'Champion',        icon: '👑', field: 'totalWins',    target: 50,   reward: '500 coins' },
    { id: 'matches_20',  label: 'Regular Player',  icon: '🎮', field: 'totalMatches', target: 20,   reward: '75 coins' },
    { id: 'matches_100', label: 'Hardcore Gamer',  icon: '⚡', field: 'totalMatches', target: 100,  reward: '300 coins' },
    { id: 'refs_5',      label: 'Connector',       icon: '🤝', field: 'referralCount',target: 5,    reward: '250 coins' },
    { id: 'earn_500',    label: 'Money Maker',     icon: '💰', field: 'totalEarnings',target: 500,  reward: '100 coins' }
  ];

  function getCurrentMilestone(UD) {
    var stats = UD.stats || {};
    var values = {
      totalKills:    Number(stats.kills)    || 0,
      totalWins:     Number(stats.wins)     || 0,
      totalMatches:  Number(stats.matches)  || 0,
      referralCount: Number(UD.referralCount) || 0,
      totalEarnings: Number(stats.earnings) || 0
    };
    var achieved = UD.achievedMilestones || {};

    for (var i = 0; i < MILESTONES.length; i++) {
      var m = MILESTONES[i];
      if (!achieved[m.id]) {
        var cur = values[m.field] || 0;
        if (cur >= m.target) {
          // Mark achieved
          if (window.db && window.U) {
            var upd = {};
            upd['achievedMilestones/' + m.id] = Date.now();
            window.db.ref('users/' + window.U.uid).update(upd);
            if (!UD.achievedMilestones) UD.achievedMilestones = {};
            UD.achievedMilestones[m.id] = Date.now();
            // Celebration toast
            setTimeout(function (mm) {
              return function () {
                if (window.toast) window.toast(mm.icon + ' ' + mm.label + ' unlock! Reward: ' + mm.reward, 'ok');
              };
            }(m), 500);
          }
          continue;
        }
        return { milestone: m, current: cur };
      }
    }
    return null;
  }

  window.f89_renderMilestoneCard = function (containerId) {
    var UD = window.UD;
    if (!UD) return;
    var el = document.getElementById(containerId);
    if (!el) return;

    var next = getCurrentMilestone(UD);
    if (!next) {
      el.innerHTML = '<div style="text-align:center;padding:14px;font-size:12px;color:#555">🏅 Saare milestones achieve kar liye! Great job!</div>';
      return;
    }

    var m   = next.milestone;
    var cur = next.current;
    var pct = Math.min(100, Math.round((cur / m.target) * 100));
    var rem = m.target - cur;

    el.innerHTML =
      '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,215,0,.15);border-radius:16px;padding:14px;margin:10px 0">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">' +
          '<div style="font-size:28px">' + m.icon + '</div>' +
          '<div style="flex:1">' +
            '<div style="font-size:13px;font-weight:800;color:#fff">' + m.label + '</div>' +
            '<div style="font-size:11px;color:#888">🎁 Reward: ' + m.reward + '</div>' +
          '</div>' +
          '<div style="font-size:11px;color:#ffd700;font-weight:700">' + cur + '/' + m.target + '</div>' +
        '</div>' +
        '<div style="background:rgba(255,255,255,.06);border-radius:6px;height:8px;overflow:hidden;margin-bottom:6px">' +
          '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#ffd700,#ff8c00);border-radius:6px;transition:width .6s ease"></div>' +
        '</div>' +
        '<div style="font-size:11px;color:#666">Aur <b style="color:#ffd700">' + rem + '</b> chahiye ' + m.id.split('_')[0] + ' ke liye</div>' +
      '</div>';
  };

  function tryInject() {
    var profileSection = document.getElementById('profileScreen') ||
                         document.querySelector('.profile-content') ||
                         document.querySelector('[data-section="profile"]');
    if (profileSection && !document.getElementById('f89MilestoneCard')) {
      var div = document.createElement('div');
      div.id = 'f89MilestoneCard';
      profileSection.appendChild(div);
    }
    if (document.getElementById('f89MilestoneCard') && window.UD) {
      window.f89_renderMilestoneCard('f89MilestoneCard');
    }
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.U) { clearInterval(_iv); setTimeout(tryInject, 1600); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f89] ✅ Milestone Tracker loaded');
})();
