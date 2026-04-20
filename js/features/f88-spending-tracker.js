/* ================================================================
   FEATURE f88: Spending Tracker
   - Monthly entry fees total dikhao
   - Budget alert jab 80% of user-set budget cross ho
   - Widget in wallet/profile section
   ================================================================ */
(function () {
  'use strict';

  function getMonthKey() {
    var d = new Date();
    return d.getFullYear() + '_' + (d.getMonth() + 1);
  }

  function getBudget() {
    var b = localStorage.getItem('_f88budget');
    return b ? Number(b) : 0;
  }

  function getSpent(callback) {
    var db = window.db; var U = window.U;
    if (!db || !U) { callback(0); return; }

    var monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    db.ref('joinedMatches/' + U.uid).once('value', function (snap) {
      var total = 0;
      if (snap.exists()) {
        snap.forEach(function (c) {
          var d = c.val();
          if (d.joinedAt && d.joinedAt >= monthStart.getTime() && d.entryFee) {
            total += Number(d.entryFee) || 0;
          }
        });
      }
      callback(total);
    });
  }

  window.f88_showSpendingWidget = function (containerId) {
    getSpent(function (spent) {
      var budget = getBudget();
      var pct    = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
      var barColor = pct >= 80 ? '#ff6b6b' : pct >= 50 ? '#ffd700' : '#00ff9c';
      var monthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      var html =
        '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px;margin:10px 0">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">' +
            '<span style="font-size:13px;font-weight:800;color:#fff">💸 Spending Tracker</span>' +
            '<span style="font-size:10px;color:#555">' + monthName + '</span>' +
          '</div>' +
          '<div style="font-size:24px;font-weight:900;color:#fff;margin-bottom:4px">₹' + spent + ' <span style="font-size:12px;color:#555;font-weight:400">spent this month</span></div>' +
          (budget > 0 ?
            '<div style="background:rgba(255,255,255,.06);border-radius:6px;height:8px;margin:10px 0;overflow:hidden">' +
              '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:6px;transition:width .5s ease"></div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between">' +
              '<span style="font-size:11px;color:#888">' + pct + '% of ₹' + budget + ' budget</span>' +
              '<span style="font-size:11px;color:' + barColor + ';font-weight:700">' + (budget - spent >= 0 ? '₹' + (budget - spent) + ' left' : '⚠️ Budget exceeded') + '</span>' +
            '</div>' : '') +
          '<div style="display:flex;gap:8px;margin-top:12px">' +
            '<button onclick="window.f88_setBudget()" style="flex:1;padding:8px;border-radius:10px;background:rgba(0,212,255,.1);border:1px solid rgba(0,212,255,.2);color:#00d4ff;font-weight:700;font-size:12px;cursor:pointer">⚙️ Set Budget</button>' +
          '</div>' +
        '</div>';

      var el = document.getElementById(containerId);
      if (el) el.innerHTML = html;

      // Alert if >= 80%
      if (pct >= 80 && budget > 0) {
        var alertKey = '_f88alert_' + getMonthKey();
        if (!localStorage.getItem(alertKey)) {
          localStorage.setItem(alertKey, '1');
          setTimeout(function () {
            if (window.toast) window.toast('⚠️ Monthly spending ' + pct + '% — Budget limit karib hai!', 'warn');
          }, 2000);
        }
      }
    });
  };

  window.f88_setBudget = function () {
    var cur = getBudget();
    var val = prompt('Monthly entry fee budget set karo (₹):', cur || '500');
    if (val === null) return;
    var n = parseInt(val);
    if (isNaN(n) || n < 0) { if (window.toast) window.toast('Valid amount daalo', 'err'); return; }
    localStorage.setItem('_f88budget', n);
    if (window.toast) window.toast('Budget set: ₹' + n, 'ok');
    // Re-render
    var el = document.getElementById('f88SpendingWidget');
    if (el) window.f88_showSpendingWidget('f88SpendingWidget');
  };

  // Inject into wallet section
  function tryInject() {
    var walletSection = document.getElementById('walletSection') ||
                        document.querySelector('.wallet-content') ||
                        document.querySelector('[data-section="wallet"]');
    if (walletSection && !document.getElementById('f88SpendingWidget')) {
      var div = document.createElement('div');
      div.id = 'f88SpendingWidget';
      walletSection.appendChild(div);
      window.f88_showSpendingWidget('f88SpendingWidget');
    }
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.U && window.UD) { clearInterval(_iv); setTimeout(tryInject, 1400); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  // Also inject on wallet tab click
  document.addEventListener('click', function (e) {
    var tab = e.target && e.target.closest('[data-nav="wallet"]');
    if (tab) setTimeout(tryInject, 500);
  });

  console.log('[f88] ✅ Spending Tracker loaded');
})();
