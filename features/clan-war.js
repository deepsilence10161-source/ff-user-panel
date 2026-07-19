/* ================================================================
   CLAN WAR v2.0 — 100% Supabase
   Tables: clan_wars(id,week,clan_a_id,clan_a_name,clan_b_id,clan_b_name,clan_a_score,clan_b_score,status,winner_id)
           clan_war_challenges(id,week,from_clan,from_name,to_clan,to_name,status)
================================================================ */
(function(){ 'use strict';
function _s(){ return window._supa; }
function _uid(){ return window.U&&window.U.uid; }
function _ud(){ return window.UD||{}; }
function _week(){ var d=new Date(),day=d.getDay(),mon=new Date(d);mon.setDate(d.getDate()-((day===0?7:day)-1));mon.setHours(0,0,0,0);return mon.toISOString().substring(0,10); }

window.showClanWar=function(){
  if(!_uid()){if(window.toast)toast('Login karo','err');return;}
  var clanId=_ud().clan_id||_ud().clanId;
  if(!clanId){openModal('⚔️ Clan War','<div style="text-align:center;padding:24px;color:var(--txt2)"><div style="font-size:36px;margin-bottom:10px">⚔️</div><p>Clan join karo pehle!</p><button onclick="navTo(\'clan\')" style="margin-top:10px;padding:11px 22px;border-radius:12px;border:none;background:var(--green);color:#000;font-weight:800;cursor:pointer">Clan Join Karo</button></div>');return;}
  openModal('⚔️ Clan War','<div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div>');
  _loadClanWarData(clanId);
};

function _loadClanWarData(myClanId){
  var mb=document.getElementById('modalB');if(!mb)return;
  if(!_s()){mb.innerHTML='<p style="color:#ff6b6b;text-align:center">Service unavailable</p>';return;}
  var week=_week();
  _s().from('clan_wars').select('*').eq('week',week).or('clan_a_id.eq.'+myClanId+',clan_b_id.eq.'+myClanId).eq('status','active').single()
  .then(function(r){ _renderActiveWar(mb,myClanId,r.data,week); })
  .catch(function(){ _renderWarLobby(mb,myClanId,week); });
}

function _renderActiveWar(mb,myClanId,war,week){
  if(!war){_renderWarLobby(mb,myClanId,week);return;}
  var isClan1=war.clan_a_id===myClanId;
  var myClanName=isClan1?war.clan_a_name:war.clan_b_name;
  var oppName=isClan1?war.clan_b_name:war.clan_a_name;
  var myScore=isClan1?(war.clan_a_score||0):(war.clan_b_score||0);
  var oppScore=isClan1?(war.clan_b_score||0):(war.clan_a_score||0);
  var winning=myScore>oppScore;
  var total=myScore+oppScore||1; var myPct=Math.round(myScore/total*100);
  var h='<div style="background:linear-gradient(135deg,rgba(255,68,68,.08),rgba(255,107,0,.04));border:1.5px solid rgba(255,68,68,.2);border-radius:16px;padding:14px;margin-bottom:14px;text-align:center">';
  h+='<div style="font-size:11px;color:rgba(255,107,107,.7);font-weight:800;letter-spacing:2px">WEEKLY WAR</div>';
  var dEnd=new Date(_week());dEnd.setDate(dEnd.getDate()+6);var dleft=Math.ceil((dEnd-new Date())/86400000);
  h+='<div style="font-size:11px;color:rgba(255,165,0,.8)">⏰ '+Math.max(0,dleft)+' days left</div></div>';
  h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">';
  h+='<div style="flex:1;text-align:center;padding:12px;border-radius:13px;background:rgba(0,255,156,.06);border:1.5px solid rgba(0,255,156,.25)"><div style="font-size:24px;font-weight:900;color:var(--green)">'+myScore+'</div><div style="font-size:12px;font-weight:700">'+myClanName+'</div><div style="font-size:10px;color:var(--green)">YOU</div></div>';
  h+='<div style="text-align:center;padding:8px"><div style="font-size:18px;font-weight:900;color:#ff6b6b">VS</div><div style="font-size:11px;color:'+(winning?'var(--green)':'#ff6b6b')+';font-weight:700">'+(winning?'WINNING':'LOSING')+'</div></div>';
  h+='<div style="flex:1;text-align:center;padding:12px;border-radius:13px;background:rgba(255,68,68,.06);border:1.5px solid rgba(255,68,68,.2)"><div style="font-size:24px;font-weight:900;color:#ff6b6b">'+oppScore+'</div><div style="font-size:12px;font-weight:700">'+oppName+'</div></div>';
  h+='</div>';
  h+='<div style="height:8px;background:rgba(255,68,68,.3);border-radius:8px;overflow:hidden;margin-bottom:14px"><div style="height:100%;width:'+myPct+'%;background:linear-gradient(90deg,var(--green),#00d4ff);border-radius:8px"></div></div>';
  h+='<div style="padding:10px 14px;border-radius:12px;background:rgba(255,165,0,.06);border:1px solid rgba(255,165,0,.2);font-size:11px;color:var(--txt2)">⚔️ Win=15pts · Kill=2pts · Match=1pt<br>🏆 Winner clan ko exclusive War Champion badge!</div>';
  mb.innerHTML=h;
}

function _renderWarLobby(mb,myClanId,week){
  if(!_s()){mb.innerHTML='<p style="color:#ff6b6b;text-align:center">Service unavailable</p>';return;}
  var h='<div style="font-size:13px;font-weight:800;color:var(--txt);margin-bottom:8px">🏆 Weekly Standings</div>';
  h+='<div id="cwStandList"><div style="text-align:center;padding:12px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div></div>';
  h+='<div style="margin-top:12px"><button onclick="window.challengeClanToWar(\''+myClanId+'\')" style="width:100%;padding:13px;border-radius:13px;border:none;background:linear-gradient(135deg,#ff6b6b,#ff4444);color:#fff;font-size:14px;font-weight:900;cursor:pointer">⚔️ Kisi Clan ko Challenge Karo</button></div>';
  mb.innerHTML=h;
  _s().from('clan_wars').select('clan_a_id,clan_a_name,clan_b_id,clan_b_name,clan_a_score,clan_b_score').eq('week',week)
  .then(function(r){
    var wars=r.data||[]; var cityScores={};
    wars.forEach(function(w){
      if(!cityScores[w.clan_a_id])cityScores[w.clan_a_id]={name:w.clan_a_name,score:0};
      if(!cityScores[w.clan_b_id])cityScores[w.clan_b_id]={name:w.clan_b_name,score:0};
      cityScores[w.clan_a_id].score+=(w.clan_a_score||0);
      cityScores[w.clan_b_id].score+=(w.clan_b_score||0);
    });
    var sorted=Object.entries(cityScores).sort(function(a,b){return b[1].score-a[1].score;});
    var ll=document.getElementById('cwStandList');if(!ll)return;
    if(!sorted.length){ll.innerHTML='<div style="text-align:center;font-size:12px;color:var(--txt2)">Abhi koi clan registered nahi</div>';return;}
    var lh='<div style="display:flex;flex-direction:column;gap:6px">';
    sorted.forEach(function(e,i){
      var isMe=e[0]===myClanId;
      lh+='<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:11px;background:'+(isMe?'rgba(0,255,156,.06)':'var(--card)')+';border:1px solid '+(isMe?'rgba(0,255,156,.25)':'var(--border)')+'">';
      lh+='<span>'+(i===0?'🥇':i===1?'🥈':i===2?'🥉':'#'+(i+1))+'</span><div style="flex:1;font-size:13px;font-weight:700">'+e[1].name+'</div>';
      lh+='<span style="font-size:13px;font-weight:900;color:'+(isMe?'var(--green)':'var(--txt)')+'">'+e[1].score+'</span></div>';
    });
    lh+='</div>';ll.innerHTML=lh;
  }).catch(function(){var ll=document.getElementById('cwStandList');if(ll)ll.innerHTML='<div style="color:#ff6b6b;text-align:center;font-size:12px">Error</div>';});
}

window.challengeClanToWar=function(myClanId){
  if(!_s())return;
  openModal('⚔️ Clan Challenge','<div id="cwClanPickWrap"><div style="text-align:center;padding:16px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div></div>');
  _s().from('clans').select('id,name,total_members').neq('id',myClanId).order('total_members',{ascending:false}).limit(15)
  .then(function(r){
    var clans=r.data||[];var w=document.getElementById('cwClanPickWrap');if(!w)return;
    if(!clans.length){w.innerHTML='<div style="text-align:center;padding:20px;color:var(--txt2)">Koi clan available nahi</div>';return;}
    var myClanName=_ud().clanName||'My Clan';
    var h='<div style="display:flex;flex-direction:column;gap:8px">';
    clans.forEach(function(c){
      h+='<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:13px;background:var(--card);border:1px solid var(--border)">';
      h+='<div style="font-size:28px">🛡️</div><div style="flex:1"><div style="font-size:13px;font-weight:800">'+(c.name||'Clan')+'</div><div style="font-size:11px;color:var(--txt2)">👥 '+(c.total_members||0)+' members</div></div>';
      h+='<button onclick="window._sendWarChallenge(\''+myClanId+'\',\''+c.id+'\',\''+(c.name||'Clan').replace(/'/g,"\\'")+'\',\''+myClanName.replace(/'/g,"\\'")+'\',this)" style="padding:8px 12px;border-radius:9px;border:1px solid rgba(255,107,107,.3);background:rgba(255,107,107,.08);color:#ff6b6b;font-size:11px;font-weight:800;cursor:pointer">⚔️ Challenge</button></div>';
    });
    h+='</div>';w.innerHTML=h;
  }).catch(function(){var w=document.getElementById('cwClanPickWrap');if(w)w.innerHTML='<div style="color:#ff6b6b;text-align:center">Error</div>';});
};

window._sendWarChallenge=function(fromId,toId,toName,fromName,btn){
  if(!_s())return;
  if(btn){btn.disabled=true;btn.textContent='Sending...';}
  var week=_week();
  _s().from('clan_war_challenges').insert({week:week,from_clan:fromId,from_name:fromName,to_clan:toId,to_name:toName,status:'pending',expires_at:new Date(Date.now()+7*24*60*60*1000).toISOString()}) /* Bug M-9 Fix: 7-day expiry */
  .then(function(){
    // Notify clan leader
    _s().from('clans').select('leader_uid').eq('id',toId).single().then(function(r){
      if(r.data&&r.data.leader_uid){
        _s().from('notifications').insert({user_id:r.data.leader_uid,type:'clan_war_challenge',title:'⚔️ Clan War Challenge!',body:fromName+' ne tumhare clan ko war challenge bheja!',ref_id:null,is_read:false}).catch(function(){});
      }
    }).catch(function(){});
    if(window.toast)toast('⚔️ Challenge bhej diya '+toName+' ko!','ok');
    if(window.closeModal)closeModal();
  }).catch(function(e){if(btn){btn.disabled=false;btn.textContent='⚔️ Challenge';}if(window.toast)toast('Error','err');});
};

window.updateClanWarScore=function(wins,kills){
  if(!_s()||!_uid()||!window.UD)return;
  var clanId=window.UD.clan_id||window.UD.clanId;if(!clanId)return;
  var week=_week();var score=(wins?15:0)+(kills||0)*2+1;
  _s().from('clan_wars').select('id,clan_a_id,clan_a_score,clan_b_score').eq('week',week).or('clan_a_id.eq.'+clanId+',clan_b_id.eq.'+clanId).eq('status','active').single()
  .then(function(r){
    if(!r.data)return;
    var isClan1=r.data.clan_a_id===clanId;
    var col=isClan1?'clan_a_score':'clan_b_score';
    var curScore=r.data[col]||0;
    var upd={};upd[col]=curScore+score;
    _s().from('clan_wars').update(upd).eq('id',r.data.id).catch(function(){});
  }).catch(function(){});
};

// Pill injection
var _i=0,_t=setInterval(function(){
  _i++;if(_i>80){clearInterval(_t);return;}
  if(!window.UD)return;
  var clanId=window.UD.clan_id||window.UD.clanId;if(!clanId)return;
  var row=document.querySelector('.special-pills');
  if(!row||row.querySelector('#_cwPill')){if(row)clearInterval(_t);return;}
  clearInterval(_t);
  var p=document.createElement('div');p.id='_cwPill';p.className='special-pill';
  p.style.cssText='background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.25);color:#ff6b6b';
  p.innerHTML='<i class="fas fa-shield-alt" style="font-size:11px"></i> Clan War';
  p.onclick=function(){if(window.showClanWar)showClanWar();};
  row.appendChild(p);
},600);
})();
