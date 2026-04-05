/* ================================================================
   FEATURE f91: Best Match Suggester
   - User ki skill level dekh ke suitable matches recommend karo
   - Entry fee, win rate, slot availability consider
   - Small card on home screen "Recommended for you"
   ================================================================ */
(function () {
  'use strict';

  function getSkillTier(stats) {
    var matches = Number(stats.matches) || 0;
    var wins    = Number(stats.wins)    || 0;
    var wr      = matches > 0 ? (wins / matches) * 100 : 0;
    if (matches < 5)  return 'beginner';
    if (wr < 15)      return 'beginner';
    if (wr < 35)      return 'intermediate';
    return 'advanced';
  }

  function getTierLabel(tier) {
    return { beginner: '🟢 Beginner', intermediate: '🟡 Intermediate', advanced: '🔴 Advanced' }[tier] || '';
  }

  function getEntryFeeRange(tier) {
    if (tier === 'beginner')     return { min: 0, max: 10 };
    if (tier === 'intermediate') return { min: 5, max: 30 };
    return { min: 20, max: 999 };
  }

  window.f91_renderSuggestions = function (containerId) {
    var db = window.db; var UD = window.UD;
    if (!db || !UD) return;
    var el = document.getElementById(containerId);
    if (!el) return;

    var stats = UD.stats || {};
    var tier  = getSkillTier(stats);
    var range = getEntryFeeRange(tier);

    db.ref('matches').orderByChild('status').equalTo('open').once('value', function (snap) {
      var matches = [];
      if (snap.exists()) {
        snap.forEach(function (c) {
          var m = c.val(); m._key = c.key;
          var fee = Number(m.entryFee) || 0;
          if (fee >= range.min && fee <= range.max) {
            var slotsLeft = (Number(m.maxPlayers) || 0) - (Number(m.joinedCount) || 0);
            if (slotsLeft > 0) matches.push(m);
          }
        });
      }

      matches = matches.slice(0, 3);

      if (!matches.length) {
        el.innerHTML = '<div style="text-align:center;padding:12px;font-size:12px;color:#555">Abhi koi recommended match available nahi hai</div>';
        return;
      }

      var cards = matches.map(function (m) {
        var slotsLeft = (Number(m.maxPlayers) || 0) - (Number(m.joinedCount) || 0);
        return '<div style="background:rgba(0,255,156,.04);border:1px solid rgba(0,255,156,.12);border-radius:12px;padding:12px;display:flex;align-items:center;gap:10px">' +
          '<div style="font-size:28px">' + (m.mode === 'squad' ? '👥' : m.mode === 'duo' ? '👫' : '🎯') + '</div>' +
          '<div style="flex:1">' +
            '<div style="font-size:13px;font-weight:700;color:#fff">' + (m.name || 'Match') + '</div>' +
            '<div style="font-size:11px;color:#888">Entry: ₹' + (m.entryFee||0) + ' · Prize: ₹' + (m.prizePool||0) + '</div>' +
            '<div style="font-size:10px;color:#555">' + slotsLeft + ' slots left</div>' +
          '</div>' +
          '<button onclick="window.openMatchDetail&&openMatchDetail(\'' + m._key + '\')" ' +
            'style="padding:8px 14px;border-radius:10px;background:linear-gradient(135deg,#00ff9c,#00c47a);border:none;color:#000;font-weight:800;font-size:12px;cursor:pointer">Join</button>' +
        '</div>';
      }).join('');

      el.innerHTML =
        '<div style="margin:10px 0">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
            '<span style="font-size:13px;font-weight:800;color:#fff">⭐ Recommended for You</span>' +
            '<span style="font-size:10px;color:#555">' + getTierLabel(tier) + '</span>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px">' + cards + '</div>' +
        '</div>';
    });
  };

  function tryInject() {
    var homeSection = document.getElementById('homeScreen') ||
                      document.querySelector('.home-content') ||
                      document.querySelector('.matches-list');
    if (homeSection && !document.getElementById('f91Suggestions')) {
      var div = document.createElement('div');
      div.id = 'f91Suggestions';
      homeSection.insertBefore(div, homeSection.firstChild);
      if (window.UD) window.f91_renderSuggestions('f91Suggestions');
    }
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.db) { clearInterval(_iv); setTimeout(tryInject, 1800); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f91] ✅ Best Match Suggester loaded');
})();
