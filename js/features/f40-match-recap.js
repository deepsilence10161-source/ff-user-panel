/* FEATURE 40: Post-Match Recap Summary (User Panel)
   Match complete hone ke baad ek beautiful recap popup — rank, kills, earnings, stats change. */
(function(){
'use strict';
function showRecap(resultData){
  if(!window.openModal||!resultData) return;
  var rank=resultData.rank||0;
  var kills=resultData.kills||0;
  var prize=resultData.winnings||resultData.prize||0;
  var matchName=resultData.matchName||'Match';
  var medal=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':rank?'#'+rank:'';
  var isWin=prize>0;
  var h='<div style="text-align:center;padding:8px">'
    +'<div style="font-size:48px;margin-bottom:4px">'+(isWin?'🏆':'🎮')+'</div>'
    +'<div style="font-size:12px;color:var(--txt2);margin-bottom:2px">'+matchName+'</div>'
    +'<div style="font-size:24px;font-weight:900;margin-bottom:14px;color:'+(isWin?'var(--primary,#00ff9c)':'var(--txt)')+'">'+(isWin?'Winner!':'Match Done')+'</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:14px">'
    +'<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px"><div style="font-size:22px">'+medal+'</div><div style="font-size:10px;color:var(--txt2)">Rank</div></div>'
    +'<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px"><div style="font-size:20px;font-weight:800;color:#ff6b6b">'+kills+'</div><div style="font-size:10px;color:var(--txt2)">Kills</div></div>'
    +'<div style="background:rgba(255,255,255,.04);border-radius:10px;padding:10px"><div style="font-size:18px;font-weight:800;color:'+(prize>0?'var(--primary,#00ff9c)':'var(--txt2)')+'">₹'+prize+'</div><div style="font-size:10px;color:var(--txt2)">Won</div></div>'
    +'</div>'
    +'<button onclick="f40.share(\''+matchName+'\','+rank+','+kills+','+prize+')" style="width:100%;padding:11px;border-radius:12px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);color:var(--primary,#00ff9c);font-weight:700;border:none;cursor:pointer;margin-bottom:8px;font-size:13px">📤 Share Result</button>'
    +'<button onclick="if(window.closeModal)closeModal()" style="width:100%;padding:10px;border-radius:12px;background:transparent;border:1px solid var(--border);color:var(--txt2);font-size:13px;cursor:pointer">Close</button>'
    +'</div>';
  window.openModal('📊 Match Recap',h);
}
function share(name,rank,kills,prize){
  var txt='🎮 Mini eSports\n'+name+'\nRank: #'+rank+' · Kills: '+kills+(prize>0?' · Won ₹'+prize:'');
  if(navigator.share)navigator.share({text:txt});
  else{ navigator.clipboard&&navigator.clipboard.writeText(txt); if(window.toast)toast('Copied!','ok'); }
}
// Auto-show when new result arrives
var _t=0,_i=setInterval(function(){
  _t++;
  if(window.db&&window.U){ clearInterval(_i);
    window.db.ref('users/'+window.U.uid+'/lastResult').on('value',function(s){
      var d=s.val(); if(d&&!d._recapShown){ d._recapShown=true; showRecap(d); }
    });
  }
  if(_t>60)clearInterval(_i);
},1000);
window.f40={show:showRecap,share:share};
})();
