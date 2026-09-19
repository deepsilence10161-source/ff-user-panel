/* ================================================================
   HOT STREAK BADGE v2.0 — 100% Supabase (users table)
   Uses users.win_streak column
================================================================ */
(function(){ 'use strict';
function _s(){ return window._supa; }
function _uid(){ return window.U&&window.U.uid; }

window.STREAK_BADGES=[
  {min:3,max:4,emoji:'🔥',label:'Hot Streak',color:'#ff6b00',bg:'rgba(255,107,0,.12)'},
  {min:5,max:6,emoji:'⚡',label:'On Fire',color:'#ffdd00',bg:'rgba(255,221,0,.12)'},
  {min:7,max:99,emoji:'💀',label:'Unstoppable',color:'#ff4444',bg:'rgba(255,68,68,.12)'}
];

window.getStreakBadge=function(streak){
  streak=Number(streak)||0;
  for(var i=window.STREAK_BADGES.length-1;i>=0;i--){ var b=window.STREAK_BADGES[i];if(streak>=b.min)return b; }
  return null;
};

window.updateWinStreak=function(isWin){
  if(!_s()||!_uid())return;
  var ud=window.UD||{};
  var cur=Number(ud.win_streak||ud._winStreak||0);
  var newStreak=isWin?cur+1:0;
  _s().from('users').update({win_streak:newStreak}).eq('id',_uid())
  .then(function(){
    if(window.UD){ window.UD.win_streak=newStreak; window.UD._winStreak=newStreak; }
    var badge=window.getStreakBadge(newStreak);
    if(badge&&isWin)_showStreakToast(badge,newStreak);
    _injectStreakBadge(newStreak);
    if(window.logActivity&&badge&&isWin)logActivity('streak',badge.emoji+' '+newStreak+' win streak! '+badge.label);
  }).catch(function(){
    // Fallback: just update locally
    if(window.UD){ window.UD.win_streak=newStreak; window.UD._winStreak=newStreak; }
    _injectStreakBadge(newStreak);
  });
};

function _showStreakToast(badge,streak){
  var d=document.createElement('div');
  d.style.cssText='position:fixed;top:80px;left:50%;transform:translateX(-50%) scale(.7);z-index:99999;text-align:center;animation:_strk .5s cubic-bezier(.175,.885,.32,1.275) forwards';
  d.innerHTML='<div style="background:linear-gradient(135deg,'+badge.color+'33,rgba(0,0,0,.9));border:2px solid '+badge.color+';border-radius:20px;padding:14px 24px;backdrop-filter:blur(10px)"><div style="font-size:32px;margin-bottom:4px">'+badge.emoji+'</div><div style="font-size:16px;font-weight:900;color:'+badge.color+'">'+streak+' WIN STREAK!</div><div style="font-size:12px;color:rgba(255,255,255,.7)">'+badge.label+'</div></div>';
  if(!document.getElementById('_streakStyle')){var s=document.createElement('style');s.id='_streakStyle';s.textContent='@keyframes _strk{from{transform:translateX(-50%) scale(.7);opacity:0}to{transform:translateX(-50%) scale(1);opacity:1}}';document.head.appendChild(s);}
  document.body.appendChild(d);
  setTimeout(function(){d.style.transition='opacity .4s';d.style.opacity='0';setTimeout(function(){d.remove();},400);},3500);
}

function _injectStreakBadge(streak){
  var badge=window.getStreakBadge(streak);
  var existing=document.getElementById('_streakHeaderBadge');
  if(!badge){if(existing)existing.remove();return;}
  if(!existing){
    existing=document.createElement('div');existing.id='_streakHeaderBadge';
    existing.style.cssText='cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:11px;font-weight:800;margin-left:6px';
    existing.onclick=function(){_showStreakModal(streak,badge);};
    var hdr=document.querySelector('.hdr-right,.header-right,header .right');
    if(hdr)hdr.appendChild(existing);
  }
  existing.style.background=badge.bg;existing.style.color=badge.color;existing.style.border='1px solid '+badge.color+'44';
  existing.innerHTML=badge.emoji+' '+streak;
}

function _showStreakModal(streak,badge){
  var h='<div style="text-align:center;padding:16px 0"><div style="font-size:64px;margin-bottom:8px;filter:drop-shadow(0 0 20px '+badge.color+'88)">'+badge.emoji+'</div>';
  h+='<div style="font-size:26px;font-weight:900;color:'+badge.color+'">'+streak+' Win Streak!</div>';
  h+='<div style="font-size:14px;color:var(--txt2);margin-top:4px">'+badge.label+'</div></div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px">';
  [{s:3,l:'🔥 Hot'},{s:5,l:'⚡ On Fire'},{s:7,l:'💀 Unstoppable'}].forEach(function(t){
    h+='<div style="text-align:center;padding:12px 8px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);opacity:'+(streak<t.s?.5:1)+'"><div style="font-size:22px">'+t.l.split(' ')[0]+'</div><div style="font-size:10px;color:var(--txt2)">'+t.l.split(' ').slice(1).join(' ')+'</div><div style="font-size:11px;font-weight:800;color:var(--txt);margin-top:4px">'+t.s+' Wins</div></div>';
  });
  h+='</div><div style="background:rgba(255,255,255,.04);border-radius:12px;padding:12px;font-size:12px;color:var(--txt2);text-align:center">Ek baar haarne par reset ho jaata hai.</div>';
  if(window.openModal)openModal('🔥 Win Streak',h);
}

// Load on login
var _si=0,_st=setInterval(function(){
  _si++;if(_si>80){clearInterval(_st);return;}
  if(!_s()||!window.U)return;
  clearInterval(_st);
  var streak=Number((window.UD&&(window.UD.win_streak||window.UD._winStreak))||0);
  if(streak>0)_injectStreakBadge(streak);
},500);
})();
