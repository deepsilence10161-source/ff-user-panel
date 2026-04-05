/* FEATURE 30: Smart Match Filter & Sort - Sort buttons removed by design */
(function(){
'use strict';

function sortMatches(arr){
  // Always sort by time
  return arr.slice().sort(function(a,b){
    return (Number(a.matchTime)||0)-(Number(b.matchTime)||0);
  });
}

window.f30={sort:sortMatches,setSort:function(){}};
})();
