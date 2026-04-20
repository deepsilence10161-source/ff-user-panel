/* FEATURE 42: Coin Transaction History
   Coins ki detailed history — har credit/debit with reason. */
(function(){
'use strict';
function showHistory(){
  if(!window.db||!window.U||!window.openModal) return;
  window.db.ref('users/'+window.U.uid+'/coinHistory').orderByChild('timestamp').limitToLast(20)
    .once('value',function(s){
      var list=[];
      if(s.exists()) s.forEach(function(c){ var d=c.val(); d._k=c.key; list.push(d); });
      list.reverse();
      var h='<div>';
      if(!list.length){ h+='<div style="text-align:center;padding:24px;color:var(--txt2)">Koi coin activity nahi abhi</div>'; }
      list.forEach(function(t){
        var positive=t.amount>0;
        var ts=new Date(t.timestamp||0);
        var timeStr=ts.toLocaleDateString('en-IN',{day:'numeric',month:'short'})+' '+ts.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
        h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
          +'<div style="font-size:22px;flex-shrink:0">'+(positive?'🟢':'🔴')+'</div>'
          +'<div style="flex:1"><div style="font-size:13px;font-weight:600">'+(t.reason||'Coin Transaction')+'</div>'
          +'<div style="font-size:11px;color:var(--txt2)">'+timeStr+'</div></div>'
          +'<div style="font-size:15px;font-weight:800;color:'+(positive?'var(--primary,#00ff9c)':'#ff6b6b')+'">'+(positive?'+':'')+t.amount+' 🪙</div>'
          +'</div>';
      });
      h+='</div>';
      window.openModal('🪙 Coin History',h);
    });
}
window.f42CoinHistory={show:showHistory}; window.showCoinHistory=showHistory;
})();
