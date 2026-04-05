/* =============================================
   FEATURE 12: Player Title System
   - Stats ke basis par auto title milta hai
   - "Rush King", "Silent Sniper", "The Destroyer" etc.
   - Profile pe badge ke saath dikhta hai
   - Multiple titles unlock ho sakte hain
   ============================================= */
(function() {
  'use strict';

  var TITLES = [
    { id: 'destroyer',  label: 'The Destroyer',  emoji: '💥', color: '#ff2d55', condition: function(s){ return (s.kills||0) >= 100; } },
    { id: 'rush_king',  label: 'Rush King',       emoji: '⚡', color: '#ffaa00', condition: function(s){ return (s.wins||0) >= 10 && (s.kills||0)/Math.max(s.matches||1,1) >= 3; } },
    { id: 'sniper',     label: 'Silent Sniper',   emoji: '🎯', color: '#00d4ff', condition: function(s){ return (s.kills||0) >= 50 && (s.wins||0)/Math.max(s.matches||1,1) >= 0.5; } },
    { id: 'money_man',  label: 'Money Maker',     emoji: '💰', color: '#00ff9c', condition: function(s){ return (s.earnings||0) >= 500; } },
    { id: 'veteran',    label: 'Veteran',          emoji: '🎖️', color: '#b964ff', condition: function(s){ return (s.matches||0) >= 50; } },
    { id: 'champion',   label: 'Champion',         emoji: '🏆', color: '#ffd700', condition: function(s){ return (s.wins||0) >= 25; } },
    { id: 'survivor',   label: 'Survivor',         emoji: '🛡️', color: '#00ff9c', condition: function(s){ return (s.matches||0) >= 20 && (s.wins||0) >= 5; } },
    { id: 'rookie',     label: 'Rookie',           emoji: '🌱', color: '#aaaaaa', condition: function(s){ return (s.matches||0) < 5; } },
    { id: 'rising',     label: 'Rising Star',      emoji: '🌟', color: '#00d4ff', condition: function(s){ return (s.matches||0) >= 5 && (s.matches||0) < 20; } },
    { id: 'consistent', label: 'Consistent',       emoji: '📈', color: '#00ff9c', condition: function(s){ return (s.matches||0) >= 15 && (s.wins||0)/Math.max(s.matches||1,1) >= 0.4; } }
  ];

  function getUnlockedTitles(stats) {
    return TITLES.filter(function(t) { return t.condition(stats); });
  }

  function getPrimaryTitle(stats) {
    var unlocked = getUnlockedTitles(stats);
    // Return highest tier title (first matching in priority order)
    var priority = ['champion','destroyer','money_man','sniper','rush_king','veteran','consistent','rising','survivor','rookie'];
    for (var i = 0; i < priority.length; i++) {
      var found = unlocked.find ? unlocked.find(function(t){ return t.id === priority[i]; }) : null;
      if (!found) { for (var j=0; j<unlocked.length; j++) { if(unlocked[j].id===priority[i]){ found=unlocked[j]; break; } } }
      if (found) return found;
    }
    return unlocked[0] || { label: 'Warrior', emoji: '⚔️', color: '#aaaaaa' };
  }

  function showAllTitles() {
    if (!window.UD) return;
    var st = window.UD.stats || {};
    var unlocked = getUnlockedTitles(st);

    var h = '<div>';
    h += '<div style="font-size:12px;color:var(--txt2);margin-bottom:12px">Tumne ' + unlocked.length + '/' + TITLES.length + ' titles unlock kiye hain</div>';

    TITLES.forEach(function(t) {
      var isUnlocked = t.condition(st);
      h += '<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:' +
        (isUnlocked ? 'linear-gradient(135deg,rgba(255,255,255,.05),rgba(255,255,255,.02))' : 'rgba(255,255,255,.01)') +
        ';border:1px solid ' + (isUnlocked ? t.color + '44' : 'var(--border)') + ';margin-bottom:6px;opacity:' + (isUnlocked ? '1' : '.4') + '">';
      h += '<div style="font-size:24px">' + t.emoji + '</div>';
      h += '<div style="flex:1"><div style="font-size:13px;font-weight:700;color:' + (isUnlocked ? t.color : 'var(--txt2)') + '">' + t.label + '</div>';
      h += '<div style="font-size:10px;color:var(--txt2)">' + (isUnlocked ? '✅ Unlocked' : '🔒 Locked') + '</div></div>';
      if (isUnlocked) {
        h += '<div style="font-size:10px;padding:3px 8px;border-radius:10px;background:' + t.color + '22;color:' + t.color + ';font-weight:700">Active</div>';
      }
      h += '</div>';
    });
    h += '</div>';

    if (window.openModal) window.openModal('🏅 Player Titles', h);
  }

  // Hook renderProfile to add title badge below name
  function hookRenderProfile() {
    var orig = window.renderProfile;
    if (!orig || window._f12Hooked) return;
    window._f12Hooked = true;

    window.renderProfile = function() {
      orig.apply(this, arguments);
      setTimeout(function() {
        var pc = document.getElementById('profileContent');
        if (!pc) return;

        var st = (window.UD && window.UD.stats) || {};
        var title = getPrimaryTitle(st);

        // Add title badge below name
        var nameDiv = pc.querySelector('.prof-name');
        if (nameDiv && !pc.querySelector('.f12-title-badge')) {
          var badge = document.createElement('div');
          badge.className = 'f12-title-badge';
          badge.style.cssText = 'text-align:center;margin:-6px 0 8px;cursor:pointer';
          badge.innerHTML = '<span onclick="window.f12Titles&&f12Titles.showAll()" style="display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:20px;background:' + title.color + '18;border:1px solid ' + title.color + '44;color:' + title.color + ';font-size:11px;font-weight:700">' + title.emoji + ' ' + title.label + '</span>';
          nameDiv.after(badge);
        }

        // Add Titles button to profile actions
        if (!pc.querySelector('.f12-titles-btn')) {
          var btn = document.createElement('button');
          btn.className = 'prof-btn f12-titles-btn';
          btn.style.cssText = 'width:100%;padding:11px;border-radius:12px;background:rgba(185,100,255,.06);color:var(--purple);border:1px solid rgba(185,100,255,.15);font-weight:700;font-size:12px;cursor:pointer;margin:0;display:flex;align-items:center;justify-content:center;gap:8px';
          btn.innerHTML = '🏅 My Titles (' + getUnlockedTitles(st).length + ')';
          btn.onclick = showAllTitles;

          var btns = pc.querySelector('.prof-btn');
          if (btns && btns.parentNode) btns.parentNode.insertBefore(btn, btns);
        }
      }, 300);
    };
  }

  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.renderProfile) { clearInterval(_check); hookRenderProfile(); }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f12Titles = { showAll: showAllTitles, getUnlocked: getUnlockedTitles, getPrimary: getPrimaryTitle };
})();
