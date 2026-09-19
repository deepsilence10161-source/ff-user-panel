/* ================================================================
   FRIENDS SYSTEM v2.0 — 100% Supabase
   Tables: friendships(user_a,user_b), user_activities(uid,ign,type,text), notifications
================================================================ */
(function(){ 'use strict';
function _s(){ return window._supa; }
function _uid(){ return window.U&&window.U.uid; }
function _ud(){ return window.UD||{}; }
function _timeAgo(ts){ var d=Date.now()-new Date(ts).getTime(),m=Math.floor(d/60000); if(m<1)return'Just now';if(m<60)return m+'m ago';var h=Math.floor(m/60);if(h<24)return h+'h ago';return Math.floor(h/24)+'d ago'; }
/* BUG #27 FIX (2026-07): same fix as mentor.js — derives from the canonical rank system. */
function _ri(p){ var t=(window.getRankTier?window.getRankTier(p):{name:'Bronze',emoji:'🏅',color:'#cd7f32',bg:'rgba(205,127,50,.12)'}); return {b:t.name,e:t.emoji,c:t.color,bg:t.bg}; }

window.showFriends=function(){
  if(!_uid()){ if(window.toast)toast('Pehle login karo','err');return; }
  var h='<div style="display:flex;gap:8px;margin-bottom:12px">';
  [{l:'Friends',ic:'fa-user-friends'},{l:'Activity',ic:'fa-stream'},{l:'Add',ic:'fa-user-plus'}].forEach(function(tab,i){
    h+='<button id="frTab'+i+'" onclick="frTab('+i+')" style="flex:1;padding:9px;border-radius:11px;border:none;font-size:12px;font-weight:800;cursor:pointer;background:'+(i===0?'var(--green)':'rgba(255,255,255,.06)')+';color:'+(i===0?'#000':'var(--txt)')+'"><i class="fas '+tab.ic+'" style="margin-right:4px"></i>'+tab.l+'</button>';
  });
  h+='</div><div id="frContent"></div>';
  openModal('👥 Friends',h); frTab(0);
};

window.frTab=function(idx){
  [0,1,2].forEach(function(i){ var b=document.getElementById('frTab'+i);if(!b)return;b.style.background=i===idx?'var(--green)':'rgba(255,255,255,.06)';b.style.color=i===idx?'#000':'var(--txt)'; });
  var c=document.getElementById('frContent');if(!c)return;
  if(idx===0)_frList(c); else if(idx===1)_frActivity(c); else _frAdd(c);
};

function _frList(c){
  c.innerHTML='<div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>';
  if(!_s()||!_uid()){c.innerHTML='<p style="color:#ff6b6b;text-align:center">Login required</p>';return;}
  _s().from('friendships').select('user_a,user_b').or('user_a.eq.'+_uid()+',user_b.eq.'+_uid())
  .then(function(r){
    var ids=(r.data||[]).map(function(f){return f.user_a===_uid()?f.user_b:f.user_a;});
    if(!ids.length){c.innerHTML='<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:36px;opacity:.3">👥</div><p style="font-size:13px">Koi friend nahi<br><small>Add tab se dhundho!</small></p></div>';return;}
    _s().from('user_public_profiles').select('id,ign,avatar_url,rank_points,total_matches,total_wins').in('id',ids) /* BUG #38 FIX */
    .then(function(u){
      var list=u.data||[];
      if(!list.length){c.innerHTML='<div style="text-align:center;padding:20px;color:var(--txt2)">Friends data nahi mila</div>';return;}
      var h='<div style="display:flex;flex-direction:column;gap:8px">';
      list.forEach(function(d){
        var ri=_ri(d.rank_points||0);
        var av=d.avatar_url?'<img src="'+d.avatar_url+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover">':'<span style="font-size:15px;font-weight:800">'+((d.ign||'P').charAt(0))+'</span>';
        h+='<div style="display:flex;align-items:center;gap:12px;padding:12px;border-radius:13px;background:var(--card);border:1px solid var(--border)">';
        h+='<div style="width:46px;height:46px;border-radius:50%;background:'+ri.bg+';border:2px solid '+ri.c+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+av+'</div>';
        h+='<div style="flex:1"><div style="font-size:14px;font-weight:800">'+(d.ign||'Player')+'</div><div style="font-size:11px;color:var(--txt2)">'+ri.e+' '+ri.b+' · '+(d.total_matches||0)+' matches</div></div>';
        h+='<div style="display:flex;flex-direction:column;gap:5px">';
        h+='<button onclick="window.sendDuelChallenge(\''+d.id+'\',\''+(d.ign||'Player').replace(/'/g,"\\'")+'\');" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,107,107,.4);background:rgba(255,107,107,.08);color:#ff6b6b;font-size:10px;font-weight:700;cursor:pointer">⚔️ Duel</button>';
        h+='<button onclick="window.removeFriend(\''+d.id+'\')" style="padding:5px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:transparent;color:var(--txt2);font-size:10px;cursor:pointer">Remove</button>';
        h+='</div></div>';
      });
      h+='</div>'; c.innerHTML=h;
    }).catch(function(){c.innerHTML='<div style="color:#ff6b6b;text-align:center">Error loading friends</div>';});
  }).catch(function(){c.innerHTML='<div style="color:#ff6b6b;text-align:center">Error</div>';});
}

function _frActivity(c){
  c.innerHTML='<div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>';
  if(!_s()||!_uid()){c.innerHTML='<p style="color:#ff6b6b;text-align:center">Login required</p>';return;}
  // Get my friends first
  _s().from('friendships').select('user_a,user_b').or('user_a.eq.'+_uid()+',user_b.eq.'+_uid())
  .then(function(r){
    var ids=[_uid()].concat((r.data||[]).map(function(f){return f.user_a===_uid()?f.user_b:f.user_a;}));
    _s().from('user_activities').select('*').in('user_id',ids).order('created_at',{ascending:false}).limit(30)
    .then(function(ar){
      var acts=ar.data||[];
      if(!acts.length){c.innerHTML='<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:30px;opacity:.3">📰</div><p style="font-size:13px">Koi activity nahi<br><small>Zyada friends add karo!</small></p></div>';return;}
      var icons={win:'🏆',kill:'💀',rank_up:'📈',join:'🎮',streak:'🔥',clan:'🛡️'};
      var h='<div style="display:flex;flex-direction:column;gap:7px">';
      acts.forEach(function(a){
        var isSelf=a.uid===_uid();
        h+='<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:12px;background:'+(isSelf?'rgba(0,255,156,.04)':'var(--card)')+';border:1px solid '+(isSelf?'rgba(0,255,156,.12)':'var(--border)')+'">';
        h+='<div style="font-size:20px;min-width:28px;text-align:center">'+(icons[a.type]||'🎮')+'</div>';
        h+='<div style="flex:1"><div style="font-size:13px;font-weight:700">'+(isSelf?'You':(a.ign||'Player'))+'</div><div style="font-size:12px;color:var(--txt2)">'+(a.text||'')+'</div></div>';
        h+='<div style="font-size:10px;color:var(--txt2)">'+_timeAgo(a.created_at)+'</div></div>';
      });
      h+='</div>'; c.innerHTML=h;
    }).catch(function(){c.innerHTML='<div style="color:#ff6b6b;text-align:center">Error loading activity</div>';});
  }).catch(function(){c.innerHTML='<div style="color:#ff6b6b;text-align:center">Error</div>';});
}

function _frAdd(c){
  c.innerHTML='<div style="position:relative;margin-bottom:10px"><input id="frSearchIn" type="text" placeholder="IGN ya FF UID se search karo..." oninput="frSearchUser(this.value)" style="width:100%;padding:12px 40px 12px 14px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;box-sizing:border-box"><i class="fas fa-search" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);color:var(--txt2)"></i></div><div id="frSearchResults"><div style="text-align:center;padding:20px;color:var(--txt2);font-size:12px">Type karo search ke liye...</div></div>';
  setTimeout(function(){ var el=document.getElementById('frSearchIn');if(el){el.focus();} },150);
}

var _frTimer=null;
/* Issue #30 Fix: Consistent name _frSearchReqId (underscore prefix) used everywhere.
   Bug report flagged a mismatch — confirmed all usages are consistent. */
var _frSearchReqId = 0;
window.frSearchUser=function(q){
  q=(q||'').trim(); var r=document.getElementById('frSearchResults');if(!r)return;
  if(q.length<2){r.innerHTML='<div style="text-align:center;padding:20px;color:var(--txt2);font-size:12px">2+ characters type karo...</div>';return;}
  r.innerHTML='<div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>';
  clearTimeout(_frTimer);
  var _myReqId = ++_frSearchReqId; /* Increment for this request */
  _frTimer=setTimeout(function(){
    if(_myReqId !== _frSearchReqId) return; /* ✅ Stale request — discard */
    if(!_s()){r.innerHTML='<div style="color:#ff6b6b;text-align:center">Service unavailable</div>';return;}
    _s().from('user_public_profiles').select('id,ign,ff_uid,avatar_url,rank_points,total_matches').or('ign.ilike.%'+q+'%,ff_uid.ilike.%'+q+'%').eq('is_banned',false).neq('id',_uid()).limit(10) /* BUG #38 FIX */
    .then(function(res){
      if(_myReqId !== _frSearchReqId) return; /* ✅ Stale response — discard */
      var users=res.data||[];
      if(!users.length){r.innerHTML='<div style="text-align:center;padding:20px;color:var(--txt2)">Koi nahi mila</div>';return;}
      _s().from('friendships').select('user_a,user_b').or('user_a.eq.'+_uid()+',user_b.eq.'+_uid())
      .then(function(fr){
        if(_myReqId !== _frSearchReqId) return; /* ✅ Stale response — discard */
        var myFriends={};(fr.data||[]).forEach(function(f){var fid=f.user_a===_uid()?f.user_b:f.user_a;myFriends[fid]=true;});
        var h='<div style="display:flex;flex-direction:column;gap:7px">';
        users.forEach(function(u){
          var ri=_ri(u.rank_points||0);
          var av=u.avatar_url?'<img src="'+u.avatar_url+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover">':'<span style="font-size:15px;font-weight:800">'+((u.ign||'P').charAt(0))+'</span>';
          h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--card);border:1px solid var(--border)">';
          h+='<div style="width:42px;height:42px;border-radius:50%;background:'+ri.bg+';border:2px solid '+ri.c+';display:flex;align-items:center;justify-content:center;flex-shrink:0">'+av+'</div>';
          h+='<div style="flex:1"><div style="font-size:13px;font-weight:800">'+(u.ign||'Player')+'</div><div style="font-size:11px;color:var(--txt2)">'+ri.e+' '+ri.b+' · '+(u.total_matches||0)+' matches</div></div>';
          h+=myFriends[u.id]?'<span style="font-size:11px;color:var(--green);font-weight:700">✅ Friend</span>':'<button onclick="window.addFriend(\''+u.id+'\',\''+(u.ign||'Player').replace(/'/g,"\\'")+'\',this)" style="padding:7px 12px;border-radius:10px;border:1.5px solid rgba(0,255,156,.4);background:rgba(0,255,156,.08);color:var(--green);font-size:11px;font-weight:800;cursor:pointer">+ Add</button>';
          h+='</div>';
        });
        h+='</div>'; r.innerHTML=h;
      }).catch(function(){r.innerHTML='<div style="color:#ff6b6b;text-align:center">Error</div>';});
    }).catch(function(){r.innerHTML='<div style="text-align:center;color:#ff6b6b">Error hua</div>';});
  },350);
};

window.addFriend=function(uid,ign,btn){
  if(!_s()||!_uid()){if(window.toast)toast('Login karo','err');return;}
  if(btn){btn.disabled=true;btn.textContent='Adding...';}
  var myIgn=_ud().ign||_ud().displayName||'Player';
  // Insert both directions for easy querying
  _s().from('friendships').upsert([{user_a:_uid(),user_b:uid},{user_a:uid,user_b:_uid()}],{onConflict:'user_a,user_b',ignoreDuplicates:true})
  .then(function(){
    _s().from('notifications').insert({user_id:uid,type:'friend_add',title:'👥 New Friend!',body:myIgn+' ne tumhe friend add kiya!',ref_id:_uid(),is_read:false}).catch(function(){});
    if(window.logActivity)logActivity('join','Friend '+ign+' add kar liya!');
    if(btn){btn.textContent='✅ Added';btn.style.background='rgba(0,255,156,.15)';}
    if(window.toast)toast('✅ '+ign+' friend ban gaya!','ok');
  }).catch(function(e){if(btn){btn.disabled=false;btn.textContent='+ Add';}if(window.toast)toast('Error','err');});
};

window.removeFriend=function(uid){
  if(!_s()||!_uid())return;
  if(!confirm('Is friend ko remove karo?'))return;
  _s().from('friendships').delete().or('and(user_a.eq.'+_uid()+',user_b.eq.'+uid+'),and(user_a.eq.'+uid+',user_b.eq.'+_uid()+')')
  .then(function(){if(window.toast)toast('Friend remove ho gaya','ok');var c=document.getElementById('frContent');if(c)_frList(c);})
  .catch(function(){if(window.toast)toast('Error','err');});
};

window.logActivity=function(type,text){
  if(!_s()||!_uid()||!_ud().ign)return;
  _s().from('user_activities').insert({user_id:_uid(),ign:_ud().ign||_ud().displayName||'Player',type:type,message:text})
  .catch(function(){});
};
/* Flush any queued activity calls from before friends.js loaded */
if (window._flushActivityQueue) window._flushActivityQueue();

// Pill injection
var _i=0,_t=setInterval(function(){
  _i++;if(_i>60){clearInterval(_t);return;}
  var row=document.querySelector('.special-pills');
  if(!row||row.querySelector('#_frPill')){if(row)clearInterval(_t);return;}
  clearInterval(_t);
  var p=document.createElement('div');p.id='_frPill';p.className='special-pill';
  p.style.cssText='background:rgba(185,100,255,.08);border:1px solid rgba(185,100,255,.2);color:#b964ff';
  p.innerHTML='<i class="fas fa-user-friends" style="font-size:11px"></i> Friends';
  p.onclick=function(){if(window.showFriends)showFriends();};
  try{row.insertBefore(p,row.firstChild);}catch(e){}
},400);
})();
