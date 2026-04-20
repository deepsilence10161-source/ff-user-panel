/* =============================================
   FEATURE 23: Achievement Auto-Earn System
   Triggers: after match result, after login, after join
   Firebase: users/{uid}/badges/{badgeId} = true
   ============================================= */
(function() {
  'use strict';

  var ACHIEVEMENTS = [
    { id: 'first_match',    icon: '🎮', title: 'First Blood',      desc: 'Pehla match khela',            check: function(s) { return (s.matches||0) >= 1; } },
    { id: 'ten_matches',    icon: '🔟', title: '10 Matches',        desc: '10 matches complete kiye',      check: function(s) { return (s.matches||0) >= 10; } },
    { id: 'fifty_matches',  icon: '🏟️', title: 'Veteran',           desc: '50 matches khele',             check: function(s) { return (s.matches||0) >= 50; } },
    { id: 'first_win',      icon: '🥇', title: 'First Win',         desc: 'Pehli baar #1 aya',            check: function(s) { return (s.wins||0) >= 1; } },
    { id: 'five_wins',      icon: '🏆', title: 'Champion',          desc: '5 matches jeete',              check: function(s) { return (s.wins||0) >= 5; } },
    { id: 'kill_machine',   icon: '🎯', title: 'Kill Machine',      desc: '100 total kills',              check: function(s) { return (s.kills||0) >= 100; } },
    { id: 'first_earn',     icon: '💰', title: 'First Earning',     desc: 'Pehli baar prize jeeta',       check: function(s) { return (s.earnings||0) > 0; } },
    { id: 'big_earner',     icon: '💎', title: 'Big Earner',        desc: '₹500 total jeeta',             check: function(s) { return (s.earnings||0) >= 500; } },
    { id: 'week_warrior',   icon: '🔥', title: 'Week Warrior',      desc: '7 din ki streak',              check: function(s,b) { return b && b.weekWarrior; } },
    { id: 'monthly_legend', icon: '👑', title: 'Monthly Legend',    desc: '30 din ki streak',             check: function(s,b) { return b && b.monthlyLegend; } },
  ];

  function checkAndUnlock() {
    if (!window.U || !window.UD || !window.db) return;
    var uid = window.U.uid;
    var stats = window.UD.stats || {};
    var badges = window.UD.badges || {};
    var newlyUnlocked = [];

    ACHIEVEMENTS.forEach(function(ach) {
      if (badges[ach.id]) return; // already unlocked
      if (ach.check(stats, badges)) {
        newlyUnlocked.push(ach);
        window.db.ref('users/' + uid + '/badges/' + ach.id).set(true);
      }
    });

    if (newlyUnlocked.length > 0) {
      setTimeout(function() { showUnlockPopup(newlyUnlocked); }, 2000);
    }
  }

  function showUnlockPopup(list) {
    if (!window.toast) return;
    list.forEach(function(ach, i) {
      setTimeout(function() {
        window.toast(ach.icon + ' Achievement Unlocked: ' + ach.title + '!', 'ok');
      }, i * 1500);
    });
  }

  function renderAchievementsHTML() {
    if (!window.UD) return '';
    var badges = window.UD.badges || {};
    var stats = window.UD.stats || {};
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">';
    ACHIEVEMENTS.forEach(function(ach) {
      var unlocked = badges[ach.id] || ach.check(stats, badges);
      html += '<div style="padding:10px;border-radius:12px;background:' +
        (unlocked ? 'rgba(255,215,0,.08)' : 'rgba(255,255,255,.03)') +
        ';border:1px solid ' + (unlocked ? 'rgba(255,215,0,.25)' : 'var(--border)') + ';opacity:' + (unlocked ? '1' : '0.45') + '">' +
        '<div style="font-size:22px;margin-bottom:4px">' + ach.icon + '</div>' +
        '<div style="font-size:12px;font-weight:700;color:' + (unlocked ? '#ffd700' : 'var(--txt)') + '">' + ach.title + '</div>' +
        '<div style="font-size:10px;color:var(--txt2);margin-top:2px">' + ach.desc + '</div>' +
        (unlocked ? '<div style="font-size:9px;color:#ffd700;margin-top:4px;font-weight:700">✅ Unlocked</div>' : '<div style="font-size:9px;color:var(--txt2);margin-top:4px">🔒 Locked</div>') +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  // Hook: check after user data loads
  var _try = 0;
  var _int = setInterval(function() {
    _try++;
    if (window.U && window.UD && window.db) {
      clearInterval(_int);
      setTimeout(checkAndUnlock, 3000);
    }
    if (_try > 60) clearInterval(_int);
  }, 1000);

  window.renderAchievementsHTML = renderAchievementsHTML;
  window.f23Achievements = { check: checkAndUnlock };
})();
