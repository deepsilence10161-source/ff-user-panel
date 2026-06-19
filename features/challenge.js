/* ================================================================
   1v1 CHALLENGE / DUEL SYSTEM v2.0 — 100% Supabase
   Tables: duel_challenges(id,challenger_id,challenger_ign,challengee_id,challengee_ign,mode,taunt,status)
           duel_records(id,user_id,opponent_id,wins,losses)
================================================================ */
(function(){ 'use strict';
function _s(){ return window._supa; }
function _uid(){ return window.U&&window.U.uid; }
function _ud(){ return window.UD||{}; }

/* Bug #68 Fix: Track challenge cooldowns per target to prevent spam */
var _duelCooldowns = {};

window.sendDuelChallenge=function(toUid,toIgn){
  if(!_uid()||!_ud()){ if(window.toast)toast('Login karo','err');return; }
  if(toUid===_uid()){ if(window.toast)toast('Khud ko challenge nahi kar sakte!','err');return; }
  /* 30-second cooldown per target */
  var _now = Date.now();
  if (_duelCooldowns[toUid] && (_now - _duelCooldowns[toUid]) < 30000) {
    var _secsLeft = Math.ceil((30000 - (_now - _duelCooldowns[toUid])) / 1000);
    if (window.toast) toast('⏳ ' + _secsLeft + 's wait karo, phir challenge karo!', 'err');
    return;
  }
  _duelCooldowns[toUid] = _now;
  var myIgn=_ud().ign||_ud().displayName||'Player';
  var h='<div style="text-align:center;padding:10px 0 16px"><div style="font-size:48px;margin-bottom:8px">⚔️</div>';
  h+='<div style="font-size:18px;font-weight:900">'+toIgn+' ko Challenge Karo</div>';
  h+='<div style="font-size:12px;color:var(--txt2);margin-top:4px">Same match mein khelo — score compare hoga</div></div>';
  h+='<div style="margin-bottom:14px"><div style="font-size:12px;color:var(--txt2);font-weight:700;margin-bottom:8px">Match Type</div><div style="display:flex;gap:8px">';
  [['solo','🎯 Solo','Highest kills wins'],['duo','👥 Duo','Combined kills'],['squad','💣 Squad','Best rank wins']].forEach(function(m,i){
    h+='<button onclick="_duelSelMode(this,\''+m[0]+'\')" class="_duelModeBtn" style="flex:1;padding:10px 6px;border-radius:12px;border:1.5px solid var(--border);background:'+(i===0?'var(--primary)':'transparent')+';color:'+(i===0?'#000':'var(--txt)')+';font-size:11px;font-weight:700;cursor:pointer;line-height:1.4" data-sel="'+(i===0?m[0]:'')+'">'+m[1]+'<br><span style="font-size:9px;opacity:.7">'+m[2]+'</span></button>';
  });
  h+='</div></div>';
  h+='<div style="margin-bottom:14px"><div style="font-size:12px;color:var(--txt2);font-weight:700;margin-bottom:7px">Taunt (optional)</div>';
  h+='<input id="duelTauntIn" type="text" maxlength="50" placeholder="e.g. Haaraaunga tujhe..." style="width:100%;padding:11px 14px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:13px;box-sizing:border-box"></div>';
  h+='<div id="duelRecordCard" style="margin-bottom:14px"></div>';
  h+='<button onclick="window._submitDuelChallenge(\''+toUid+'\',\''+toIgn.replace(/'/g,"\\'")+'\');" style="width:100%;padding:14px;border-radius:13px;border:none;background:linear-gradient(135deg,#ff6b6b,#ff4444);color:#fff;font-size:14px;font-weight:900;cursor:pointer">⚔️ Challenge Bhejo!</button>';
  openModal('⚔️ Duel Challenge',h);
  setTimeout(function(){
    var btns=document.querySelectorAll('._duelModeBtn');
    if(btns[0]){btns[0].style.background='var(--primary)';btns[0].style.color='#000';btns[0].dataset.sel='solo';}
    _loadDuelRecord(toUid,toIgn);
  },80);
};

window._duelSelMode=function(btn,val){
  document.querySelectorAll('._duelModeBtn').forEach(function(b){b.style.background='transparent';b.style.color='var(--txt)';b.dataset.sel='';});
  btn.style.background='var(--primary)';btn.style.color='#000';btn.dataset.sel=val;
};

function _loadDuelRecord(toUid,toIgn){
  var card=document.getElementById('duelRecordCard');if(!card||!_s()||!_uid())return;
  _s().from('duel_records').select('wins,losses').eq('user_id',_uid()).eq('opponent_id',toUid).single()
  .then(function(r){
    var rec=r.data||{wins:0,losses:0};
    var total=(rec.wins||0)+(rec.losses||0);
    if(!total){card.innerHTML='';return;}
    card.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid var(--border)"><span style="font-size:12px;color:var(--txt2)">vs '+toIgn+':</span><span style="font-size:14px;font-weight:800;color:var(--green)">'+(rec.wins||0)+' W</span><span style="color:var(--txt2)"> / </span><span style="font-size:14px;font-weight:800;color:#ff6b6b">'+(rec.losses||0)+' L</span><span style="margin-left:auto;font-size:10px;color:var(--txt2)">'+total+' duels</span></div>';
  }).catch(function(){card.innerHTML='';});
}

window._submitDuelChallenge=function(toUid,toIgn){
  if(!_s()||!_uid()||!_ud()){if(window.toast)toast('Login karo','err');return;}
  var modeSel=document.querySelector('._duelModeBtn[data-sel]:not([data-sel=""])');
  var mode=modeSel?modeSel.dataset.sel:'solo';
  var taunt=(document.getElementById('duelTauntIn')||{}).value||'';
  var myIgn=_ud().ign||_ud().displayName||'Player';
  _s().from('duel_challenges').insert({challenger_id:_uid(),challenger_ign:myIgn,challengee_id:toUid,challengee_ign:toIgn,mode:mode,taunt:taunt.trim(),status:'pending'})
  .then(function(r){
    var cid=(r.data&&r.data[0]&&r.data[0].id)||null;
    _s().from('notifications').insert({user_id:toUid,type:'duel_challenge',title:'⚔️ Duel Challenge!',body:myIgn+' ne tumhe 1v1 challenge bheja! ('+mode.toUpperCase()+')'+(taunt?' — "'+taunt+'"':''),ref_id:cid?String(cid):null,is_read:false}).catch(function(){});
    if(window.logActivity)logActivity('join','⚔️ '+toIgn+' ko duel challenge bheja');
    if(window.toast)toast('⚔️ Challenge bhej diya '+toIgn+' ko!','ok');
    if(window.closeModal)closeModal();
  }).catch(function(e){if(window.toast)toast('Error: '+(e.message||'Try again'),'err');});
};

window.showMyChallenges=function(){
  if(!_uid()){if(window.toast)toast('Login karo','err');return;}
  openModal('⚔️ My Challenges','<div id="chalContent"><div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div></div>');
  _loadMyChallenges();
};

function _loadMyChallenges(){
  var c=document.getElementById('chalContent');if(!c||!_s()||!_uid())return;
  _s().from('duel_challenges').select('*').or('challenger_id.eq.'+_uid()+',challengee_id.eq.'+_uid()).order('created_at',{ascending:false}).limit(20)
  .then(function(r){
    var all=r.data||[];
    var incoming=all.filter(function(d){return d.challengee_id===_uid()&&d.status==='pending';});
    var history=all.filter(function(d){return d.status!=='pending';});
    var h='';
    if(incoming.length){
      h+='<div style="font-size:13px;font-weight:800;color:#ff6b6b;margin-bottom:8px">🔔 Incoming ('+incoming.length+')</div>';
      incoming.forEach(function(d){h+=_chalCard(d,true);});
    }
    if(history.length){
      h+='<div style="font-size:13px;font-weight:800;color:var(--txt2);margin:14px 0 8px">📜 History</div>';
      history.slice(0,10).forEach(function(d){
        var isChallenger=d.challenger_id===_uid();
        var won=(isChallenger&&d.result==='challenger_win')||(!isChallenger&&d.result==='challengee_win');
        h+='<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:var(--card);border:1px solid var(--border);margin-bottom:7px">';
        h+='<span style="font-size:20px">'+(won?'🏆':'💀')+'</span>';
        h+='<div style="flex:1"><div style="font-size:13px;font-weight:700">vs '+(isChallenger?d.challengee_ign:d.challenger_ign)+'</div>';
        h+='<div style="font-size:11px;color:var(--txt2)">'+(d.mode||'solo').toUpperCase()+'</div></div>';
        h+='<span style="font-size:12px;font-weight:800;color:'+(won?'var(--green)':'#ff6b6b')+'">'+(won?'WIN':'LOSS')+'</span></div>';
      });
    }
    if(!h)h='<div style="text-align:center;padding:30px;color:var(--txt2)"><div style="font-size:36px;opacity:.3">⚔️</div><p>Koi challenges nahi</p></div>';
    c.innerHTML=h;
  }).catch(function(){c.innerHTML='<div style="color:#ff6b6b;text-align:center;padding:20px">Error loading challenges</div>';});
}

function _chalCard(d,isIncoming){
  var h='<div style="padding:14px;border-radius:14px;background:rgba(255,107,107,.06);border:1.5px solid rgba(255,107,107,.25);margin-bottom:10px">';
  h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="font-size:28px">⚔️</div>';
  h+='<div><div style="font-size:14px;font-weight:800">'+(isIncoming?d.challenger_ign:d.challengee_ign)+' ka Challenge!</div>';
  h+='<div style="font-size:12px;color:var(--txt2)">'+(d.mode||'solo').toUpperCase()+'</div>';
  if(d.taunt)h+='<div style="font-size:11px;color:#ff9f1c;font-style:italic">"'+d.taunt+'"</div>';
  h+='</div></div>';
  if(isIncoming){
    h+='<div style="display:flex;gap:8px">';
    h+='<button onclick="window.acceptDuel('+d.id+')" style="flex:1;padding:10px;border-radius:11px;border:none;background:var(--green);color:#000;font-size:13px;font-weight:800;cursor:pointer">✅ Accept</button>';
    h+='<button onclick="window.declineDuel('+d.id+')" style="flex:1;padding:10px;border-radius:11px;border:1px solid var(--border);background:transparent;color:var(--txt);font-size:13px;font-weight:700;cursor:pointer">❌ Decline</button>';
    h+='</div>';
  }
  h+='</div>';return h;
}

window.acceptDuel=function(cid){
  if(!_s()||!_uid())return;
  _s().from('duel_challenges').select('challenger_id,challenger_ign').eq('id',cid).single()
  .then(function(r){
    var d=r.data;if(!d)return;
    _s().from('duel_challenges').update({status:'accepted'}).eq('id',cid).then(function(){
      _s().from('notifications').insert({user_id:d.challenger_id,type:'duel_accepted',title:'⚔️ Challenge Accepted!',body:(_ud().ign||'Player')+' ne tumhara duel accept kar liya!',ref_id:String(cid),is_read:false}).catch(function(){});
      if(window.toast)toast('✅ Challenge accept! Agle match mein milo.','ok');
      if(window.closeModal)closeModal();
    });
  }).catch(function(){if(window.toast)toast('Error','err');});
};

window.declineDuel=function(cid){
  if(!_s()||!_uid())return;
  _s().from('duel_challenges').update({status:'declined'}).eq('id',cid)
  .then(function(){if(window.toast)toast('Challenge decline ho gaya','ok');if(window.closeModal)closeModal();});
};

window.updateDuelRecord=function(challengeId,myResult){
  if(!_s()||!_uid())return;
  _s().from('duel_challenges').select('challenger_id,challengee_id,challenger_ign,challengee_ign').eq('id',challengeId).single()
  .then(function(r){
    var d=r.data;if(!d)return;
    var isChallenger=d.challenger_id===_uid();
    var oppUid=isChallenger?d.challengee_id:d.challenger_id;
    var oppIgn=isChallenger?d.challengee_ign:d.challenger_ign;
    var won=myResult==='win';
    var result=won?(isChallenger?'challenger_win':'challengee_win'):(isChallenger?'challengee_win':'challenger_win');
    _s().from('duel_challenges').update({status:'completed',result:result}).eq('id',challengeId).catch(function(){});
    // Update my duel record
    _s().from('duel_records').upsert({user_id:_uid(),opponent_id:oppUid,wins:won?1:0,losses:won?0:1},{onConflict:'user_id,opponent_id'}).catch(function(){});
    if(window.logActivity)logActivity(won?'win':'kill',(won?'⚔️ Duel Jeet liya':'⚔️ Duel Haare')+' vs '+oppIgn);
  }).catch(function(){});
};

// Pill injection
var _i=0,_t=setInterval(function(){
  _i++;if(_i>60){clearInterval(_t);return;}
  var row=document.querySelector('.special-pills');
  if(!row||row.querySelector('#_chalPill')){if(row)clearInterval(_t);return;}
  clearInterval(_t);
  var p=document.createElement('div');p.id='_chalPill';p.className='special-pill';
  p.style.cssText='background:rgba(255,107,107,.08);border:1px solid rgba(255,107,107,.25);color:#ff6b6b';
  p.innerHTML='<i class="fas fa-times-circle" style="font-size:11px"></i> Duel';
  p.onclick=function(){if(window.showMyChallenges)showMyChallenges();};
  row.appendChild(p);
},400);
})();
