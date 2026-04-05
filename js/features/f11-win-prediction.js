/* =============================================
   FEATURE 11: Match Win Prediction
   - Match detail popup me "Win Chance" % dikhta hai
   - User ke stats + match difficulty se calculate
   - Animated circular progress indicator
   ============================================= */
(function() {
  'use strict';

  function calcWinChance(match) {
    if (!window.UD) return 40;
    var st = window.UD.stats || {};
    var matches = Number(st.matches) || 0;
    var wins = Number(st.wins) || 0;
    var kills = Number(st.kills) || 0;

    // Base win rate
    var wr = matches > 0 ? wins / matches : 0.3;
    var kpm = matches > 0 ? kills / matches : 1; // kills per match

    // Difficulty modifier
    var diff = (match.difficulty || 'intermediate').toLowerCase();
    var diffMod = { beginner: 1.3, intermediate: 1.0, pro: 0.75, expert: 0.55 }[diff] || 1.0;

    // Mode modifier (solo vs squad)
    var mode = (match.mode || match.type || 'solo').toLowerCase();
    var modeMod = mode === 'solo' ? 1.0 : mode === 'duo' ? 0.85 : 0.7;

    // Slots competition modifier
    var slots = Number(match.maxSlots) || 10;
    var basePrior = 1 / slots; // base chance with equal skill

    // Combined score
    var score = (wr * 0.5 + basePrior * 0.3 + Math.min(kpm/5, 0.2)) * diffMod * modeMod;
    var pct = Math.min(Math.round(score * 100), 92);
    return Math.max(pct, 8); // clamp 8-92%
  }

  function getWinLabel(pct) {
    if (pct >= 70) return { label: 'Excellent!', color: '#00ff9c' };
    if (pct >= 50) return { label: 'Good Chance', color: '#ffaa00' };
    if (pct >= 30) return { label: 'Average', color: '#00d4ff' };
    return { label: 'Tough Match', color: '#ff2d55' };
  }

  function buildPredictionHTML(match) {
    var pct = calcWinChance(match);
    var lbl = getWinLabel(pct);
    var circumference = 2 * Math.PI * 30; // radius 30
    var offset = circumference - (pct / 100) * circumference;

    return '<div style="text-align:center;padding:12px;background:linear-gradient(135deg,rgba(255,255,255,.03),rgba(255,255,255,.01));border:1px solid var(--border);border-radius:14px;margin-bottom:10px">' +
      '<div style="font-size:11px;color:var(--txt2);margin-bottom:8px">🎯 Tumhara Win Chance</div>' +
      '<div style="position:relative;display:inline-block;width:80px;height:80px">' +
      '<svg width="80" height="80" style="transform:rotate(-90deg)">' +
      '<circle cx="40" cy="40" r="30" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="6"/>' +
      '<circle cx="40" cy="40" r="30" fill="none" stroke="' + lbl.color + '" stroke-width="6" ' +
        'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" ' +
        'stroke-linecap="round" style="transition:stroke-dashoffset 1s ease"/>' +
      '</svg>' +
      '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
      '<span style="font-size:18px;font-weight:900;color:' + lbl.color + '">' + pct + '%</span>' +
      '</div></div>' +
      '<div style="font-size:12px;font-weight:700;color:' + lbl.color + ';margin-top:4px">' + lbl.label + '</div>' +
      '</div>';
  }

  // Hook into showDet function
  function hookShowDet() {
    var orig = window.showDet;
    if (!orig || window._f11Hooked) return;
    window._f11Hooked = true;

    window.showDet = function(mid) {
      orig.call(this, mid);

      // Inject prediction into modal after it opens
      setTimeout(function() {
        var match = window.MT && window.MT[mid];
        if (!match) return;

        // Find join button area in modal and inject before it
        var modal = document.getElementById('mainModal');
        if (!modal) return;
        var content = modal.querySelector('.modal-body') || modal.querySelector('[id="mainModalBody"]');
        if (!content) return;
        if (content.querySelector('.f11-prediction')) return;

        var predDiv = document.createElement('div');
        predDiv.className = 'f11-prediction';
        predDiv.innerHTML = buildPredictionHTML(match);

        // Inject before join button
        var joinBtn = content.querySelector('.mc-join, button[onclick*="cJoin"]');
        if (joinBtn) joinBtn.parentNode.insertBefore(predDiv, joinBtn);
        else content.appendChild(predDiv);
      }, 200);
    };
  }

  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.showDet) { clearInterval(_check); hookShowDet(); }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f11WinPrediction = { calc: calcWinChance, buildHTML: buildPredictionHTML };
})();
