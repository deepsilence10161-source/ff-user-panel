/* =============================================
   FEATURE 07: Weekly Challenge System
   - Har hafte 3 challenges: join X matches, earn Y coins, get Z kills
   - Profile screen pe progress bar dikhti hai
   - Complete karo → bonus coins milte hain
   - Firebase: users/{uid}/weeklyChallenge
   ============================================= */
(function() {
  'use strict';

  function getWeekNumber() {
    var d = new Date();
    var jan1 = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  }

  function getCurrentChallenges() {
    var wk = getWeekNumber();
    // Rotate challenges based on week number
    var sets = [
      [
        { id: 'join3',  label: 'Join 3 Matches',   target: 3,   field: 'matches', reward: 50,  icon: '🎮' },
        { id: 'win1',   label: 'Win 1 Match',       target: 1,   field: 'wins',    reward: 100, icon: '🏆' },
        { id: 'kill10', label: 'Get 10 Kills',      target: 10,  field: 'kills',   reward: 75,  icon: '💀' }
      ],
      [
        { id: 'join5',  label: 'Join 5 Matches',   target: 5,   field: 'matches', reward: 80,  icon: '🎮' },
        { id: 'win2',   label: 'Win 2 Matches',     target: 2,   field: 'wins',    reward: 150, icon: '🏆' },
        { id: 'kill20', label: 'Get 20 Kills',      target: 20,  field: 'kills',   reward: 100, icon: '💀' }
      ],
      [
        { id: 'join2',  label: 'Join 2 Matches',   target: 2,   field: 'matches', reward: 40,  icon: '🎮' },
        { id: 'earn50', label: 'Earn ₹50',          target: 50,  field: 'earnings',reward: 120, icon: '💰' },
        { id: 'kill5',  label: 'Get 5 Kills',       target: 5,   field: 'kills',   reward: 60,  icon: '💀' }
      ]
    ];
    return sets[wk % sets.length];
  }

  function showWeeklyChallenge() {
    if (!window.UD) return;
    var st = window.UD.stats || {};
    var wk = getWeekNumber();
    var challenges = getCurrentChallenges();
    var wkData = (window.UD.weeklyChallenge && window.UD.weeklyChallenge.week === wk)
      ? window.UD.weeklyChallenge
      : { week: wk, completed: {} };

    var h = '<div style="padding:4px 0">';
    h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:12px;text-align:center">Week ' + wk + ' Challenges — Reset on Monday</div>';

    challenges.forEach(function(c) {
      var current = Number(st[c.field] || 0);
      var prog = Math.min(current, c.target);
      var pct = Math.round((prog / c.target) * 100);
      var done = wkData.completed && wkData.completed[c.id];

      h += '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:10px' + (done ? ';opacity:.6' : '') + '">';
      h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">';
      h += '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:20px">' + c.icon + '</span>';
      h += '<div><div style="font-size:13px;font-weight:700">' + c.label + '</div>';
      h += '<div style="font-size:11px;color:var(--txt2)">Reward: 🪙' + c.reward + '</div></div></div>';
      h += '<div style="font-size:12px;font-weight:800;color:' + (done ? '#00ff9c' : 'var(--txt)') + '">' + (done ? '✅ Done' : prog + '/' + c.target) + '</div>';
      h += '</div>';
      h += '<div style="height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">';
      h += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#00ff9c,#00d4ff);border-radius:3px;transition:width .5s ease"></div>';
      h += '</div></div>';

      // Auto-complete check
      if (!done && prog >= c.target && window.U && window.db) {
        var upd = {};
        upd['weeklyChallenge/week'] = wk;
        upd['weeklyChallenge/completed/' + c.id] = true;
        window.db.ref('users/' + window.U.uid).update(upd);
        window.db.ref('users/' + window.U.uid + '/coins').transaction(function(v) { return (v||0) + c.reward; });
        if (window.toast) window.toast('🎉 Challenge complete! +🪙' + c.reward, 'ok');
      }
    });

    h += '</div>';
    if (window.openModal) window.openModal('📋 Weekly Challenges', h);
  }

  // Add Weekly Challenge button to profile render
  function hookRenderProfile() {
    var orig = window.renderProfile;
    if (!orig || window._f07Hooked) return;
    window._f07Hooked = true;

    window.renderProfile = function() {
      orig.apply(this, arguments);
      setTimeout(function() {
        var pc = document.getElementById('profileContent');
        if (!pc) return;
        if (pc.querySelector('.f07-weekly-btn')) return;

        // Find the prof-section with "Game Info" and add after it
        var btn = document.createElement('button');
        btn.className = 'prof-btn f07-weekly-btn';
        btn.style.cssText = 'width:100%;padding:12px;border-radius:12px;background:linear-gradient(135deg,rgba(255,170,0,.12),rgba(255,107,53,.08));color:#ffaa00;border:1px solid rgba(255,170,0,.2);font-weight:700;font-size:13px;cursor:pointer;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:8px';
        btn.innerHTML = '📋 Weekly Challenges';
        btn.onclick = showWeeklyChallenge;

        var firstSection = pc.querySelector('.prof-section');
        if (firstSection) firstSection.parentNode.insertBefore(btn, firstSection);
      }, 200);
    };
  }

  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.renderProfile) { clearInterval(_check); hookRenderProfile(); }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f07WeeklyChallenge = { show: showWeeklyChallenge, getChallenges: getCurrentChallenges };
  window.showWeeklyChallenges = showWeeklyChallenge;
})();
