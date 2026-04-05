/* =============================================
   FEATURE 75: Smart Match Sort
   Sort row removed per owner request
   Default sort: by time
   ============================================= */
(function() {
  'use strict';

  function sortMatches(arr) {
    // Default: sort by time
    return arr.slice().sort(function(a, b) {
      return (Number(a.matchTime)||0) - (Number(b.matchTime)||0);
    });
  }

  window.f75Filter = {
    setSort: function() {},
    sort: sortMatches,
    renderBar: function() { return ''; }
  };

})();
