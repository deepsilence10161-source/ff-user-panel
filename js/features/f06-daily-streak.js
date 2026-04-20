/* =============================================
   FEATURE 06: Daily Login Streak v2
   - User roz app khole to streak badhti hai
   - 7 din ki streak = increasing rewards (5,10,15,25,35,50,100 coins)
   - Animated popup with day-wise reward grid
   - Firebase: users/{uid}/loginStreak & lastLoginDate
   ============================================= */
(function() {
  'use strict';

  var REWARDS = [5, 7, 10, 12, 15, 20, 30]; // Day 1=5, Day3=10, Day7=30 (balanced)
  var STREAK_BADGES = { 7: '🔥 Week Warrior', 14: '⚡ Fortnight Fighter', 30: '💎 Monthly Legend' };

  function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  function checkStreak() {
    if (!window.U || !window.UD || !window.db) return;
    var uid = window.U.uid;
    var today = getTodayStr();
    var lastLogin = window.UD.lastLoginDate || '';
    var streak = Number(window.UD.loginStreak) || 0;

    if (lastLogin === today) return; // Already checked in today

    var yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    var yesterdayStr = yesterday.getFullYear() + '-' + (yesterday.getMonth()+1) + '-' + yesterday.getDate();

    var newStreak;
    if (lastLogin === yesterdayStr) {
      newStreak = Math.min(streak + 1, 7); // Continue streak
    } else {
      newStreak = 1; // Reset
    }

    var reward = REWARDS[newStreak - 1] || 5;
    var dayIndex = newStreak - 1;

    // Update Firebase
    var totalStreak = (Number(window.UD.totalLoginStreak) || 0) + 1;
    var updates = {
      lastLoginDate: today,
      loginStreak: newStreak,
      totalLoginStreak: totalStreak
    };
    // Unlock streak badge milestones
    if (totalStreak === 7) updates['badges/weekWarrior'] = true;
    if (totalStreak === 14) updates['badges/fortnightFighter'] = true;
    if (totalStreak === 30) updates['badges/monthlyLegend'] = true;
    window.db.ref('users/' + uid).update(updates);
    // Day 30 special bonus: 100 coins
    var bonusCoins = (totalStreak === 30) ? 100 : 0;
    window.db.ref('users/' + uid + '/coins').transaction(function(c) { return (c || 0) + reward + bonusCoins; });

    // Show popup
    setTimeout(function() { showStreakPopup(newStreak, reward); }, 1500);
  }

  function showStreakPopup(streak, reward) {
    // Build day grid
    var days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'SUN'];
    var gridHTML = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin:16px 0">';
    for (var i = 0; i < 7; i++) {
      var done = i < streak;
      var today = i === streak - 1;
      var r = REWARDS[i];
      gridHTML += '<div style="text-align:center;padding:8px 2px;border-radius:10px;background:' +
        (done ? (today ? 'linear-gradient(135deg,#00ff9c,#00cc7a)' : 'rgba(0,255,156,.15)') : 'rgba(255,255,255,.04)') +
        ';border:1px solid ' + (today ? '#00ff9c' : done ? 'rgba(0,255,156,.3)' : 'var(--border)') + '">';
      gridHTML += '<div style="font-size:16px;margin-bottom:2px">' + (done ? '✅' : '🔒') + '</div>';
      gridHTML += '<div style="font-size:8px;color:' + (done ? '#00ff9c' : 'var(--txt2)') + ';font-weight:700">+🪙' + r + '</div>';
      gridHTML += '<div style="font-size:7px;color:var(--txt2);margin-top:1px">' + days[i] + '</div>';
      gridHTML += '</div>';
    }
    gridHTML += '</div>';

    var h = '<div style="text-align:center">';
    h += '<div style="font-size:48px;margin-bottom:4px">' + (streak === 7 ? '🎉' : '🔥') + '</div>';
    h += '<div style="font-size:20px;font-weight:800;margin-bottom:4px">Day ' + streak + ' Streak!</div>';
    h += '<div style="font-size:14px;color:var(--txt2);margin-bottom:4px">Aaj tumhe mila:</div>';
    h += '<div style="font-size:28px;font-weight:900;color:#ffaa00">+🪙 ' + reward + ' Coins</div>';
    if (streak === 7) h += '<div style="font-size:12px;color:var(--green);margin-top:4px;font-weight:700">🎊 Week Warrior Badge Unlocked!</div>';
    var total = (window.UD && window.UD.totalLoginStreak) || streak;
    if (total === 14) h += '<div style="font-size:12px;color:#00d4ff;margin-top:4px;font-weight:700">⚡ Fortnight Fighter Badge!</div>';
    if (total === 30) h += '<div style="font-size:12px;color:#ffd700;margin-top:4px;font-weight:700">💎 Monthly Legend! +🪙100 Bonus Coins!</div>';
    h += gridHTML;
    h += '<div style="font-size:11px;color:var(--txt2)">' + (streak < 7 ? (7 - streak) + ' din aur — max reward pao!' : 'Kal phir aao streak ke liye!') + '</div>';
    h += '<button onclick="if(window.closeModal)closeModal()" style="width:100%;margin-top:16px;padding:13px;border-radius:14px;background:linear-gradient(135deg,#ffaa00,#ff6b35);color:#000;font-weight:800;font-size:14px;border:none;cursor:pointer">Claim! 🎁</button>';
    h += '</div>';

    if (window.openModal) window.openModal('🔥 Daily Streak', h);
  }

  // Init after user data loaded
  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.U && window.UD && window.db) {
      clearInterval(_check);
      setTimeout(checkStreak, 2000);
    }
    if (_try > 60) clearInterval(_check);
  }, 1000);

  // Also hook into L1 boot listener
  var _origBoot = window.boot;
  if (_origBoot) {
    // Will run after UD is loaded via L1
  }

  window.f06Streak = { check: checkStreak, show: showStreakPopup };
})();
