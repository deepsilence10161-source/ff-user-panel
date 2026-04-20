/* FEATURE 37: Per-Match Reminder Bell
   Join karne ke baad — bell tap → 5/15/30 min pehle reminder set karo. localStorage + browser notif. */
(function(){
'use strict';
var _rem=JSON.parse(localStorage.getItem('f37rem')||'{}');

function set(id,min){
  var t=window.MT&&window.MT[id]; if(!t||!t.matchTime) return;
  var trig=Number(t.matchTime)-(min*60000);
  if(trig<=Date.now()){ if(window.toast)toast('Match bahut paas hai!','err'); return; }
  _rem[id]={name:t.name,trig:trig,min:min};
  localStorage.setItem('f37rem',JSON.stringify(_rem));
  setTimeout(function(){ fire(id); }, trig-Date.now());
  if(window.toast)toast('⏰ Reminder: '+min+' min pehle!','ok');
  if(window.closeModal)closeModal();
}

function fire(id){
  var r=_rem[id]; if(!r) return;
  if(window.toast)toast('⏰ '+(r.name||'Match')+' shuru hone wala hai!','ok');
  if('Notification'in window&&Notification.permission==='granted')
    new Notification('⏰ Match Alert!',{body:(r.name||'Match')+' '+r.min+'m mein!',icon:'/favicon.ico'});
  delete _rem[id]; localStorage.setItem('f37rem',JSON.stringify(_rem));
}

function pick(id){
  var t=window.MT&&window.MT[id]; if(!window.openModal) return;
  var ex=_rem[id];
  var h='<div>'
    +(ex?'<div style="text-align:center;background:rgba(0,255,156,.08);border-radius:10px;padding:8px;margin-bottom:12px;font-size:12px;color:var(--primary,#00ff9c)">✅ '+ex.min+' min pehle set hai</div>':'')
    +'<div style="font-size:13px;color:var(--txt2);text-align:center;margin-bottom:14px">'+(t?t.name:'Match')+' ke liye:</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px">';
  [5,15,30].forEach(function(m){
    h+='<button onclick="f37.set(\''+id+'\','+m+')" style="padding:12px;border-radius:12px;background:var(--card2,#1a1a2e);border:1px solid var(--border);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer">⏰ '+m+' min pehle</button>';
  });
  h+='</div></div>';
  window.openModal('⏰ Set Reminder',h);
}

// Restore on load
Object.keys(_rem).forEach(function(id){
  var r=_rem[id]; var delay=r.trig-Date.now();
  if(delay>0) setTimeout(function(){fire(id);},delay); else delete _rem[id];
});
localStorage.setItem('f37rem',JSON.stringify(_rem));

window.f37={set:set,pick:pick}; window.showMatchReminderPicker=pick;
})();
