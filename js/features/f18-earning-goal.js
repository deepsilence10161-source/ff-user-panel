/* =============================================
   FEATURE 18: Earning Goal Tracker
   - User apna daily earning goal set karta hai (e.g., ₹200)
   - Wallet screen pe progress bar dikhti hai
   - Goal achieve hone par celebration popup
   - localStorage me save, daily reset
   ============================================= */
(function() {
  'use strict';

  function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  function getTodayEarnings() {
    // Approximate from wallet history — winnings today
    if (!window.WH) return 0;
    var today = getTodayStr();
    var total = 0;
    window.WH.forEach(function(w) {
      if (w.type === 'withdraw') return;
      var wDate = new Date(Number(w.createdAt) || 0);
      var wDateStr = wDate.getFullYear() + '-' + (wDate.getMonth()+1) + '-' + wDate.getDate();
      if (wDateStr === today && (w.status === 'approved' || w.status === 'done')) {
        total += Number(w.amount) || 0;
      }
    });
    // Also check realMoney winnings changes
    return total;
  }

  function getGoal() {
    var saved = localStorage.getItem('f18_goal') || '{}';
    try { saved = JSON.parse(saved); } catch(e) { saved = {}; }
    if (saved.date !== getTodayStr()) return { amount: 0, date: getTodayStr() };
    return saved;
  }

  function setGoal(amount) {
    localStorage.setItem('f18_goal', JSON.stringify({ amount: Number(amount), date: getTodayStr() }));
  }

  function showGoalSetter() {
    var current = getGoal();
    var todayEarned = getTodayEarnings();

    var h = '<div>';
    h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:12px">Aaj ka earning target set karo</div>';
    if (current.amount > 0) {
      var pct = Math.min(Math.round(todayEarned / current.amount * 100), 100);
      h += '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:12px">';
      h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px">';
      h += '<span style="font-size:12px;color:var(--txt2)">Current Goal</span>';
      h += '<span style="font-size:13px;font-weight:800;color:#00ff9c">₹' + current.amount + '</span></div>';
      h += '<div style="display:flex;justify-content:space-between;margin-bottom:6px">';
      h += '<span style="font-size:12px;color:var(--txt2)">Earned Today</span>';
      h += '<span style="font-size:13px;font-weight:800;color:#ffaa00">₹' + todayEarned + '</span></div>';
      h += '<div style="height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden">';
      h += '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,#00ff9c,#00d4ff);border-radius:4px"></div></div>';
      h += '<div style="text-align:right;font-size:10px;color:var(--txt2);margin-top:3px">' + pct + '% Complete</div>';
      h += '</div>';
    }
    h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px">';
    [100, 200, 500, 1000, 2000, 5000].forEach(function(amt) {
      h += '<button onclick="window.f18Goal.quickSet(' + amt + ',this)" style="padding:8px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--txt);font-size:12px;font-weight:700;cursor:pointer">₹' + amt + '</button>';
    });
    h += '</div>';
    h += '<div class="f-group"><label>Custom Amount (₹)</label><input type="number" id="f18GoalInput" class="f-input" placeholder="e.g. 300" min="10"></div>';
    h += '<button onclick="window.f18Goal.save()" style="width:100%;padding:13px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;font-size:14px;border:none;cursor:pointer;margin-top:8px">Set Goal 🎯</button>';
    h += '</div>';

    if (window.openModal) window.openModal('🎯 Daily Earning Goal', h);
  }

  function renderGoalBar() {
    var goal = getGoal();
    if (!goal.amount) return '';

    var todayEarned = getTodayEarnings();
    var pct = Math.min(Math.round(todayEarned / goal.amount * 100), 100);
    var done = pct >= 100;

    return '<div onclick="window.f18Goal&&f18Goal.show()" style="cursor:pointer;background:' + (done ? 'linear-gradient(135deg,rgba(0,255,156,.1),rgba(0,212,255,.05))' : 'var(--card)') + ';border:1px solid ' + (done ? 'rgba(0,255,156,.3)' : 'var(--border)') + ';border-radius:12px;padding:10px 12px;margin-bottom:8px">' +
      '<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:5px">' +
        '<span style="color:var(--txt2)">🎯 Aaj ka Goal</span>' +
        '<span style="font-weight:700;color:' + (done ? '#00ff9c' : '#ffaa00') + '">' + (done ? '✅ Achieved!' : '₹' + todayEarned + ' / ₹' + goal.amount) + '</span>' +
      '</div>' +
      '<div style="height:6px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden">' +
        '<div style="height:100%;width:' + pct + '%;background:' + (done ? 'linear-gradient(90deg,#00ff9c,#00d4ff)' : 'linear-gradient(90deg,#ffaa00,#ff6b35)') + ';border-radius:3px;transition:width .8s ease"></div>' +
      '</div>' +
    '</div>';
  }

  window.f18Goal = {
    show: showGoalSetter,
    quickSet: function(amt, el) {
      document.querySelectorAll('.f18-quick').forEach(function(e) { e.style.background = 'var(--card)'; e.style.borderColor = 'var(--border)'; });
      if (el) { el.style.background = 'rgba(0,255,156,.1)'; el.style.borderColor = 'rgba(0,255,156,.3)'; el.className += ' f18-quick'; }
      var inp = document.getElementById('f18GoalInput');
      if (inp) inp.value = amt;
    },
    save: function() {
      var inp = document.getElementById('f18GoalInput');
      var amt = inp ? Number(inp.value) : 0;
      if (!amt || amt < 10) { if (window.toast) window.toast('Goal enter karo (min ₹10)', 'err'); return; }
      setGoal(amt);
      if (window.closeModal) window.closeModal();
      if (window.toast) window.toast('🎯 Goal set: ₹' + amt + '!', 'ok');
      if (window.renderWallet) window.renderWallet();
    }
  };

  // Hook renderWallet to inject goal bar
  function hookRenderWallet() {
    var orig = window.renderWallet;
    if (!orig || window._f18Hooked) return;
    window._f18Hooked = true;
    window.renderWallet = function() {
      orig.apply(this, arguments);
      setTimeout(function() {
        var wMain = document.getElementById('walletMain');
        if (!wMain || wMain.querySelector('.f18-goal-bar')) return;
        var div = document.createElement('div');
        div.className = 'f18-goal-bar';
        div.innerHTML = renderGoalBar() || '<div onclick="window.f18Goal&&f18Goal.show()" style="cursor:pointer;text-align:center;padding:10px;background:rgba(255,170,0,.04);border:1px dashed rgba(255,170,0,.2);border-radius:12px;margin-bottom:8px;font-size:12px;color:#ffaa00">🎯 Daily Earning Goal Set karo</div>';
        var histSection = wMain.querySelector('.wh-section');
        if (histSection) wMain.insertBefore(div, histSection);
      }, 400);
    };
  }

  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.renderWallet) { clearInterval(_check); hookRenderWallet(); }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.showEarningGoal = showGoalSetter;
})();
