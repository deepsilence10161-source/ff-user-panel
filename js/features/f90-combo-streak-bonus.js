/* ================================================================
   FEATURE f90: Combo Streak Bonus
   - 3 matches in a day = +25 bonus coins auto-credit
   - 5 matches in a day = +60 bonus coins
   - Animated popup on milestone
   - Tracks daily join count in Firebase
   ================================================================ */
(function () {
  'use strict';

  var COMBOS = [
    { count: 3, bonus: 25, label: '3 Match Combo! 🔥' },
    { count: 5, bonus: 60, label: '5 Match Legend! 🔥🔥' },
    { count: 10, bonus: 150, label: 'Ultimate Grinder! ⚡' }
  ];

  function getTodayKey() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '');
  }

  window.f90_trackMatchJoin = function () {
    var db = window.db; var U = window.U; var UD = window.UD;
    if (!db || !U || !UD) return;

    var todayKey = getTodayKey();
    var counterRef = db.ref('dailyMatchCount/' + U.uid + '/' + todayKey);

    counterRef.transaction(function (cur) {
      return (cur || 0) + 1;
    }, function (err, committed, snap) {
      if (!committed || err) return;
      var newCount = snap.val();

      // Also track in f86 session counter
      if (window._f86_trackMatchJoin) window._f86_trackMatchJoin();

      COMBOS.forEach(function (combo) {
        if (newCount === combo.count) {
          // Award bonus coins
          db.ref('users/' + U.uid + '/coins').transaction(function (c) { return (c || 0) + combo.bonus; });

          // Log transaction
          db.ref('coinTransactions/' + U.uid).push({
            type: 'combo_bonus',
            amount: combo.bonus,
            description: combo.label,
            timestamp: Date.now()
          });

          showComboBanner(combo);

          // Notify UD
          if (UD) UD.coins = (Number(UD.coins) || 0) + combo.bonus;
          if (window.updateHdr) window.updateHdr();
        }
      });
    });
  };

  function showComboBanner(combo) {
    var old = document.getElementById('_f90Combo');
    if (old) old.remove();

    var el = document.createElement('div');
    el.id = '_f90Combo';
    el.style.cssText = [
      'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(.8);',
      'background:linear-gradient(135deg,#1a1a30,#0f0f1e);',
      'border:2px solid rgba(255,165,0,.5);border-radius:24px;',
      'padding:28px 32px;text-align:center;z-index:99999;',
      'box-shadow:0 0 60px rgba(255,165,0,.3);',
      'animation:f90pop .4s cubic-bezier(.34,1.56,.64,1) forwards'
    ].join('');

    el.innerHTML =
      '<style>' +
        '@keyframes f90pop{to{transform:translate(-50%,-50%) scale(1);opacity:1}}' +
        '@keyframes f90coins{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-40px);opacity:0}}' +
      '</style>' +
      '<div style="font-size:52px;margin-bottom:8px">🔥</div>' +
      '<div style="font-size:18px;font-weight:900;color:#fff;margin-bottom:4px">' + combo.label + '</div>' +
      '<div style="font-size:13px;color:#888;margin-bottom:16px">Combo bonus unlock!</div>' +
      '<div style="font-size:36px;font-weight:900;color:#ffd700;animation:f90coins 1.5s ease 0.3s forwards">+' + combo.bonus + ' 🪙</div>' +
      '<button onclick="document.getElementById(\'_f90Combo\').remove()" ' +
        'style="margin-top:16px;padding:10px 28px;border-radius:12px;background:linear-gradient(135deg,#ffd700,#ff8c00);border:none;color:#000;font-weight:900;font-size:14px;cursor:pointer">Awesome! 🎉</button>';

    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 5000);
  }

  // Hook into match join — patch window.joinMatch
  function hookJoinMatch() {
    if (!window.joinMatch || window._f90Hooked) return;
    window._f90Hooked = true;
    var _orig = window.joinMatch;
    window.joinMatch = function () {
      var ret = _orig.apply(this, arguments);
      // Track after a short delay to let join complete
      setTimeout(function () { window.f90_trackMatchJoin(); }, 1500);
      return ret;
    };
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.joinMatch) { clearInterval(_iv); hookJoinMatch(); }
    if (_t > 50) clearInterval(_iv);
  }, 300);

  console.log('[f90] ✅ Combo Streak Bonus loaded');
})();
