/* ================================================================
   FEATURE f92: Daily Quiz
   - Free Fire trivia — ek question per day
   - Sahi jawab = +10 coins
   - Shown on home screen as a card
   ================================================================ */
(function () {
  'use strict';

  var QUESTIONS = [
    { q: 'Free Fire mein maximum squad size kya hoti hai?', opts: ['2','4','6','8'], ans: 1 },
    { q: 'Bermuda map ka area approx. kitna hai?', opts: ['1×1 km','4×4 km','8×8 km','12×12 km'], ans: 1 },
    { q: 'Free Fire mein Booyah matlab kya hai?', opts: ['Game Over','Victory','Surrender','Respawn'], ans: 1 },
    { q: 'Which weapon has highest damage in FF?', opts: ['M14','AWM','AK47','MP5'], ans: 1 },
    { q: 'Gloo Wall kiska special skill hai?', opts: ['Alok','Wukong','A124','Clu'], ans: 3 },
    { q: 'Free Fire mein kitne players ek match mein hote hain?', opts: ['50','75','100','48'], ans: 2 },
    { q: 'Purgatory map kab launch hua tha?', opts: ['2017','2018','2019','2020'], ans: 2 },
    { q: 'CS Rank mein sabse high rank kaunsa hai?', opts: ['Diamond','Heroic','Grandmaster','Elite'], ans: 2 },
    { q: 'Kaunsa item instant heal deta hai?', opts: ['Mushroom','Med Kit','Injector','Painkillers'], ans: 2 },
    { q: 'Free Fire developer company kaunsi hai?', opts: ['Tencent','Garena','Activision','EA'], ans: 1 }
  ];

  function getTodayIndex() {
    var d = new Date();
    var day = Math.floor(d.getTime() / 86400000);
    return day % QUESTIONS.length;
  }

  function getTodayKey() {
    return 'f92q_' + new Date().toISOString().slice(0, 10);
  }

  function isAlreadyAnswered() {
    return !!localStorage.getItem(getTodayKey());
  }

  window.f92_answerQuiz = function (optIdx) {
    if (isAlreadyAnswered()) return;
    var q   = QUESTIONS[getTodayIndex()];
    var btn = document.querySelectorAll('._f92Opt')[optIdx];

    if (optIdx === q.ans) {
      // Correct
      if (btn) { btn.style.background = 'rgba(0,255,156,.3)'; btn.style.borderColor = '#00ff9c'; }
      localStorage.setItem(getTodayKey(), 'correct');

      var db = window.db; var U = window.U; var UD = window.UD;
      if (db && U) {
        db.ref('users/' + U.uid + '/coins').transaction(function (c) { return (c || 0) + 10; });
        db.ref('coinTransactions/' + U.uid).push({ type: 'quiz_reward', amount: 10, description: 'Daily Quiz correct answer', timestamp: Date.now() });
        if (UD) UD.coins = (Number(UD.coins) || 0) + 10;
        if (window.updateHdr) window.updateHdr();
      }

      setTimeout(function () {
        var card = document.getElementById('f92QuizCard');
        if (card) card.innerHTML =
          '<div style="text-align:center;padding:16px">' +
            '<div style="font-size:36px;margin-bottom:8px">🎉</div>' +
            '<div style="font-size:14px;font-weight:800;color:#00ff9c">Sahi Jawab!</div>' +
            '<div style="font-size:12px;color:#888;margin-top:4px">+10 coins credit ho gaye!</div>' +
          '</div>';
      }, 500);
    } else {
      // Wrong
      if (btn) { btn.style.background = 'rgba(255,107,107,.25)'; btn.style.borderColor = '#ff6b6b'; }
      // Show correct
      var opts = document.querySelectorAll('._f92Opt');
      if (opts[q.ans]) { opts[q.ans].style.background = 'rgba(0,255,156,.2)'; opts[q.ans].style.borderColor = '#00ff9c'; }
      localStorage.setItem(getTodayKey(), 'wrong');
      if (window.toast) window.toast('Galat! Sahi jawab: ' + q.opts[q.ans], 'err');
    }

    // Disable all buttons
    document.querySelectorAll('._f92Opt').forEach(function (b) { b.disabled = true; });
  };

  window.f92_renderQuizCard = function (containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    if (isAlreadyAnswered()) {
      var ans = localStorage.getItem(getTodayKey());
      el.innerHTML =
        '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px;margin:10px 0;text-align:center">' +
          '<div style="font-size:20px;margin-bottom:6px">' + (ans === 'correct' ? '✅' : '❌') + '</div>' +
          '<div style="font-size:12px;color:#888">Aaj ka quiz ' + (ans === 'correct' ? 'sahi kiya! +10 coins' : 'galat tha. Kal try karo!') + '</div>' +
        '</div>';
      return;
    }

    var q    = QUESTIONS[getTodayIndex()];
    var opts = q.opts.map(function (o, i) {
      return '<button class="_f92Opt" onclick="window.f92_answerQuiz(' + i + ')" ' +
        'style="width:100%;text-align:left;padding:10px 14px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);color:#ccc;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:6px">' +
        '<span style="color:#555;margin-right:8px">' + String.fromCharCode(65+i) + '.</span>' + o +
      '</button>';
    }).join('');

    el.innerHTML =
      '<div style="background:rgba(255,255,255,.03);border:1px solid rgba(0,212,255,.15);border-radius:16px;padding:14px;margin:10px 0">' +
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">' +
          '<span style="font-size:20px">🧠</span>' +
          '<span style="font-size:13px;font-weight:800;color:#fff">Daily Quiz</span>' +
          '<span style="margin-left:auto;font-size:10px;color:#ffd700;font-weight:700">+10 🪙</span>' +
        '</div>' +
        '<div style="font-size:13px;color:#ddd;margin-bottom:12px;line-height:1.5">' + q.q + '</div>' +
        opts +
      '</div>';
  };

  function tryInject() {
    var homeSection = document.getElementById('homeScreen') || document.querySelector('.home-content');
    if (homeSection && !document.getElementById('f92QuizCard')) {
      var div = document.createElement('div');
      div.id = 'f92QuizCard';
      homeSection.appendChild(div);
    }
    if (document.getElementById('f92QuizCard')) window.f92_renderQuizCard('f92QuizCard');
  }

  var _t = 0;
  var _iv = setInterval(function () {
    _t++;
    if (window.UD && window.U) { clearInterval(_iv); setTimeout(tryInject, 2000); }
    if (_t > 40) clearInterval(_iv);
  }, 400);

  console.log('[f92] ✅ Daily Quiz loaded');
})();
