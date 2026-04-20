/* =============================================
   FEATURE 05: Quick Rematch Button
   - Completed match card pe "Rematch" button aata hai
   - Same type/mode ka koi upcoming match dhundh ke suggest karta hai
   - 1 click se join flow shuru hota hai
   ============================================= */
(function() {
  'use strict';

  function findRematch(completedMatch) {
    if (!window.MT) return null;
    var mode = (completedMatch.mode || completedMatch.type || 'solo').toLowerCase();
    var entryType = (completedMatch.entryType || '').toLowerCase();
    var now = Date.now();
    var best = null;
    var bestTime = Infinity;

    for (var id in window.MT) {
      var t = window.MT[id];
      if (!t || !t.maxSlots) continue;
      var es = window.effSt ? window.effSt(t) : (t.status || '');
      if (es !== 'upcoming') continue;
      if (window.hasJ && window.hasJ(id)) continue;
      var slots = Number(t.maxSlots) || 1;
      var joined = Number(t.joinedSlots) || 0;
      if (joined >= slots) continue;

      var tMode = (t.mode || t.type || 'solo').toLowerCase();
      var tEntry = (t.entryType || '').toLowerCase();
      var tTime = Number(t.matchTime) || 0;
      if (tTime < now) continue;

      // Same mode and entry type preferred
      if (tMode === mode && tEntry === entryType && tTime < bestTime) {
        best = t; bestTime = tTime;
      }
    }
    // Fallback: any upcoming same mode
    if (!best) {
      for (var id2 in window.MT) {
        var t2 = window.MT[id2];
        if (!t2 || !t2.maxSlots) continue;
        var es2 = window.effSt ? window.effSt(t2) : (t2.status || '');
        if (es2 !== 'upcoming') continue;
        if (window.hasJ && window.hasJ(id2)) continue;
        var tMode2 = (t2.mode || t2.type || 'solo').toLowerCase();
        var tTime2 = Number(t2.matchTime) || 0;
        if (tTime2 < now) continue;
        var slots2 = Number(t2.maxSlots) || 1;
        var joined2 = Number(t2.joinedSlots) || 0;
        if (joined2 >= slots2) continue;
        if (tMode2 === mode && tTime2 < bestTime) {
          best = t2; bestTime = tTime2;
        }
      }
    }
    return best;
  }

  function showRematchSuggestion(completedMatchId) {
    if (!window.MT) return;
    var completed = window.MT[completedMatchId];
    if (!completed) return;

    var rematch = findRematch(completed);
    if (!rematch) {
      if (window.toast) window.toast('Abhi koi rematch available nahi hai', 'inf');
      return;
    }

    var fee = Number(rematch.entryFee) || 0;
    var et = (rematch.entryType || '').toLowerCase();
    var feeStr = et === 'coin' ? '🪙' + fee : '₹' + fee;
    var mode = (rematch.mode || rematch.type || 'solo').toUpperCase();

    var h = '<div style="text-align:center;padding:8px 0">';
    h += '<div style="font-size:32px;margin-bottom:8px">🔄</div>';
    h += '<div style="font-size:16px;font-weight:800;margin-bottom:4px">Rematch Available!</div>';
    h += '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">' + rematch.name + '</div>';
    h += '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px">';
    h += '<span style="padding:4px 12px;border-radius:20px;background:rgba(0,255,156,.1);color:var(--green);font-size:12px;font-weight:700">' + mode + '</span>';
    h += '<span style="padding:4px 12px;border-radius:20px;background:rgba(255,170,0,.1);color:#ffaa00;font-size:12px;font-weight:700">' + feeStr + ' Entry</span>';
    h += '<span style="padding:4px 12px;border-radius:20px;background:rgba(185,100,255,.1);color:var(--purple);font-size:12px;font-weight:700">₹' + (rematch.prizePool || 0) + ' Pool</span>';
    h += '</div>';
    h += '<button onclick="if(window.cJoin)cJoin(\'' + rematch.id + '\');if(window.closeModal)closeModal();" style="width:100%;padding:14px;border-radius:14px;background:linear-gradient(135deg,#00ff9c,#00cc7a);color:#000;font-weight:800;font-size:15px;border:none;cursor:pointer">⚡ Join Rematch</button>';
    h += '<button onclick="if(window.closeModal)closeModal();" style="width:100%;padding:10px;border-radius:14px;background:transparent;color:var(--txt2);font-size:13px;border:none;cursor:pointer;margin-top:8px">No Thanks</button>';
    h += '</div>';

    if (window.openModal) window.openModal('🔄 Quick Rematch', h);
  }

  // Hook into renderMM to add rematch button on completed matches
  function hookRenderMM() {
    var orig = window.renderMM;
    if (!orig || window._f05Hooked) return;
    window._f05Hooked = true;

    window.renderMM = function() {
      orig.apply(this, arguments);

      // After render, add rematch buttons to completed match cards
      setTimeout(function() {
        var list = document.getElementById('mmList');
        if (!list) return;
        // Find completed match cards and add rematch button
        var cards = list.querySelectorAll('.m-card');
        cards.forEach(function(card) {
          // Find the match id from timer element
          var timerEl = card.querySelector('[id^="timer-"]');
          if (!timerEl) return;
          var mid = timerEl.id.replace('timer-', '');
          var match = window.MT && window.MT[mid];
          if (!match) return;
          var es = window.effSt ? window.effSt(match) : (match.status || '');
          if (es !== 'completed') return;
          if (card.querySelector('.f05-rematch-btn')) return;

          var btn = document.createElement('button');
          btn.className = 'f05-rematch-btn';
          btn.style.cssText = 'width:calc(100% - 24px);margin:0 12px 12px;padding:10px;border-radius:12px;background:linear-gradient(135deg,rgba(0,212,255,.15),rgba(0,255,156,.08));color:#00d4ff;border:1px solid rgba(0,212,255,.3);font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px';
          btn.innerHTML = '🔄 Quick Rematch';
          btn.onclick = function() { showRematchSuggestion(mid); };
          card.appendChild(btn);
        });
      }, 300);
    };
  }

  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.renderMM) { clearInterval(_check); hookRenderMM(); }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f05Rematch = { show: showRematchSuggestion, find: findRematch };
})();
