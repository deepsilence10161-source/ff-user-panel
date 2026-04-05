/* =============================================
   FEATURE 04: Dynamic Prize Pool
   - Jab match me dynamic:true ho, prize pool entry fees se badhta hai
   - Match card pe animated prize counter dikhta hai
   - Formula: basePrize + (joinedSlots * entryFee * 0.7)
   ============================================= */
(function() {
  'use strict';

  function calcDynamicPrize(match) {
    if (!match.dynamicPrize) return null;
    var base = Number(match.basePrize || match.prizePool || 0);
    var fee = Number(match.entryFee || 0);
    var joined = Number(match.joinedSlots || 0);
    return Math.round(base + joined * fee * 0.7);
  }

  function hookMcHTML() {
    var orig = window.mcHTML;
    if (!orig || window._f04Hooked) return;
    window._f04Hooked = true;

    window.mcHTML = function(t) {
      if (!t || !t.dynamicPrize) return orig.call(this, t);

      // Temporarily override prizePool for render
      var origPrize = t.prizePool;
      t.prizePool = calcDynamicPrize(t);
      var html = orig.call(this, t);
      t.prizePool = origPrize;

      // Add "Growing" indicator to prize
      html = html.replace(
        /(<label>🏆 Prize Pool<\/label><span class="prize">₹)([\d,]+)(<\/span>)/,
        '$1$2$3<span style="font-size:8px;color:#00ff9c;display:block;margin-top:1px;font-weight:700">📈 Growing!</span>'
      );
      return html;
    };
  }

  var _try = 0;
  var _check = setInterval(function() {
    _try++;
    if (window.mcHTML) { clearInterval(_check); hookMcHTML(); }
    if (_try > 20) clearInterval(_check);
  }, 500);

  window.f04DynamicPrize = { calc: calcDynamicPrize };
})();
