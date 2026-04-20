/* FEATURE 34: In-App Notification Center
   Bell icon → slide panel. Unread badge. Mark all read. */
(function(){
'use strict';
var _un=0;

function load(cb){
  if(!window.db||!window.U) return;
  window.db.ref('users/'+window.U.uid+'/notifications').orderByChild('timestamp').limitToLast(30)
    .once('value',function(s){
      var list=[]; if(s.exists()) s.forEach(function(c){ var d=c.val(); d._k=c.key; list.push(d); });
      list.reverse(); _un=list.filter(function(n){return !n.read;}).length; badge(); if(cb)cb(list);
    });
}

function badge(){
  var b=document.getElementById('f34badge'); if(!b) return;
  b.style.display=_un>0?'flex':'none'; b.textContent=_un>9?'9+':_un||'';
}

function ago(ts){
  if(!ts) return '';
  var d=Date.now()-ts;
  if(d<60000) return 'Abhi';
  if(d<3600000) return Math.floor(d/60000)+'m pehle';
  if(d<86400000) return Math.floor(d/3600000)+'h pehle';
  return Math.floor(d/86400000)+'d pehle';
}

function open(){
  if(!window.openModal) return;
  load(function(list){
    var icons={result:'🏆',cashback:'🪙',referral:'🎁',system:'📢'};
    var h='<div>';
    if(!list.length){ h+='<div style="text-align:center;padding:30px;color:var(--txt2)">Koi notification nahi 👀</div>'; }
    else list.forEach(function(n){
      h+='<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);opacity:'+(n.read?.6:1)+'">'
        +'<div style="font-size:20px;flex-shrink:0">'+(icons[n.type]||'🔔')+'</div>'
        +'<div style="flex:1"><div style="font-size:13px;font-weight:'+(n.read?400:700)+'">'+((n.title)||'Notification')+'</div>'
        +'<div style="font-size:11px;color:var(--txt2);margin-top:2px">'+((n.message||n.body)||'')+'</div>'
        +'<div style="font-size:10px;color:var(--txt2);margin-top:3px">'+ago(n.timestamp||n.createdAt)+'</div></div>'
        +(!n.read?'<div style="width:7px;height:7px;border-radius:50%;background:var(--primary,#00ff9c);margin-top:4px;flex-shrink:0"></div>':'')
        +'</div>';
    });
    if(list.length) h+='<button onclick="f34.markAll()" style="width:100%;padding:10px;margin-top:10px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid var(--border);color:var(--txt2);font-size:12px;cursor:pointer">✅ Mark all read</button>';
    h+='</div>';
    window.openModal('🔔 Notifications',h);
    // mark read in bg
    if(window.U&&window.db){
      var uid=window.U.uid;
      list.filter(function(n){return !n.read;}).forEach(function(n){
        window.db.ref('users/'+uid+'/notifications/'+n._k+'/read').set(true);
      });
      _un=0; badge();
    }
  });
}

function markAll(){
  if(!window.U||!window.db) return;
  window.db.ref('users/'+window.U.uid+'/notifications').once('value',function(s){
    var u={}; s.forEach(function(c){ if(!c.val().read) u[c.key+'/read']=true; });
    window.db.ref('users/'+window.U.uid+'/notifications').update(u);
    _un=0; badge(); if(window.toast)toast('✅ All read','ok'); if(window.closeModal)closeModal();
  });
}

// Auto-refresh badge
var _t=0,_i=setInterval(function(){
  _t++;
  if(window.db&&window.U){ clearInterval(_i); load(function(){}); setInterval(function(){load(function(){});},60000); }
  if(_t>60)clearInterval(_i);
},1000);

window.f34={open:open,markAll:markAll,badge:badge,load:load};
window.openNotifPanel=open;
})();
