/* FEATURE 38: Rich Result Card in Match History
   Completed match row mein rank+kills+prize card + share button. */
(function(){
'use strict';
function build(jr,mid){
  var r=jr.result||{};
  var rank=r.rank||jr.rank; var kills=r.kills||jr.kills||0; var prize=r.prize||r.winnings||jr.reward||0;
  if(!rank&&!kills&&!prize) return '';
  var medal=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'#'+rank;
  return '<div style="margin-top:8px;background:linear-gradient(135deg,rgba(255,215,0,.07),transparent);border:1px solid rgba(255,215,0,.2);border-radius:12px;padding:10px 12px">'
    +'<div style="display:flex;align-items:center;gap:12px">'
    +'<div style="text-align:center;min-width:40px"><div style="font-size:22px">'+medal+'</div><div style="font-size:9px;color:var(--txt2)">Rank</div></div>'
    +'<div style="text-align:center;min-width:40px"><div style="font-size:18px;font-weight:900;color:#ff6b6b">'+kills+'💀</div><div style="font-size:9px;color:var(--txt2)">Kills</div></div>'
    +(prize>0?'<div style="text-align:center;min-width:40px"><div style="font-size:18px;font-weight:900;color:var(--primary,#00ff9c)">₹'+prize+'</div><div style="font-size:9px;color:var(--txt2)">Won</div></div>':'')
    +(jr.cashbackGiven?'<div style="text-align:center;min-width:40px"><div style="font-size:14px;color:#ffd700;font-weight:700">🪙CB</div><div style="font-size:9px;color:var(--txt2)">Cashback</div></div>':'')
    +'<div style="margin-left:auto"><button onclick="f38.share(\''+mid+'\','+rank+','+kills+','+prize+')" style="padding:6px 10px;border-radius:8px;background:rgba(0,255,156,.1);border:1px solid rgba(0,255,156,.2);color:var(--primary,#00ff9c);font-size:10px;cursor:pointer"><i class=\'fas fa-share-alt\'></i></button></div>'
    +'</div></div>';
}
function share(mid,rank,kills,prize){
  var t=window.MT&&window.MT[mid];
  var txt='🎮 Mini eSports Result!\n🏆 '+(t?t.name:'Match')+'\n#'+rank+' · '+kills+' Kills'+(prize>0?' · ₹'+prize+' Won!':'')+'\n📱 Play now on Mini eSports!';
  if(navigator.share) navigator.share({text:txt});
  else{ navigator.clipboard&&navigator.clipboard.writeText(txt); if(window.toast)toast('Result copied!','ok'); }
}
window.f38={build:build,share:share}; window.buildResultCard=build;
})();
