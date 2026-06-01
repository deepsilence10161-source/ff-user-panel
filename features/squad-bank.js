/* ================================================================
   SQUAD BANK v2.0 — 100% Supabase
   Uses clans table: squad_bank_gd, squad_bank_unlocked (jsonb), squad_bank_contributors (jsonb)
================================================================ */
(function(){ 'use strict';
function _s(){ return window._supa; }
function _uid(){ return window.U&&window.U.uid; }
function _ud(){ return window.UD||{}; }

var COSMETICS=[
  {id:'banner_fire',name:'Fire Banner',icon:'🔥',cost:50,type:'banner',desc:'Fire theme clan banner'},
  {id:'banner_neon',name:'Neon Banner',icon:'💜',cost:80,type:'banner',desc:'Purple neon clan banner'},
  {id:'badge_champion',name:'Champion Badge',icon:'🏆',cost:120,type:'badge',desc:'Clan badge for all members'},
  {id:'tag_elite',name:'[ELITE] Tag',icon:'⭐',cost:150,type:'tag',desc:'[ELITE] prefix for all members'},
  {id:'room_theme',name:'Gold Room',icon:'✨',cost:200,type:'theme',desc:'Gold theme in clan matches'},
  {id:'badge_ghost',name:'Ghost Badge',icon:'👻',cost:100,type:'badge',desc:'Ghost badge for all members'},
  {id:'banner_ice',name:'Ice Banner',icon:'❄️',cost:60,type:'banner',desc:'Ice clan banner'},
  {id:'tag_shadow',name:'[SHADOW] Tag',icon:'🌑',cost:180,type:'tag',desc:'[SHADOW] dark glow tag'},
];

window.showSquadBank=function(){
  if(!_uid()){if(window.toast)toast('Login karo','err');return;}
  var clanId=_ud().clan_id||_ud().clanId;
  if(!clanId){if(window.toast)toast('Pehle clan join ya create karo!','err');return;}
  openModal('💰 Squad Bank','<div id="sbContent"><div style="text-align:center;padding:20px;color:var(--txt2)"><i class="fas fa-spinner fa-spin"></i></div></div>');
  if(!_s()){document.getElementById('sbContent').innerHTML='<p style="color:#ff6b6b;text-align:center">Service unavailable</p>';return;}
  _s().from('clans').select('id,name,squad_bank_gd,squad_bank_unlocked,squad_bank_contributors').eq('id',clanId).single()
  .then(function(r){_renderSquadBank(clanId,r.data||{});})
  .catch(function(){_renderSquadBank(clanId,{});});
};

function _renderSquadBank(clanId,clan){
  var c=document.getElementById('sbContent');if(!c)return;
  var gd=Number(clan.squad_bank_gd||0);
  var unlocked=clan.squad_bank_unlocked||{};
  var contributors=clan.squad_bank_contributors||{};
  var myGd=Number(_ud().green_diamonds||0);
  var topContrib=Object.entries(contributors).sort(function(a,b){return(b[1].gd||0)-(a[1].gd||0)})[0];
  var h='<div style="background:linear-gradient(135deg,rgba(0,255,156,.08),rgba(0,212,255,.04));border:1.5px solid rgba(0,255,156,.2);border-radius:16px;padding:16px;margin-bottom:14px">';
  h+='<div style="display:flex;align-items:center;justify-content:space-between">';
  h+='<div><div style="font-size:11px;color:var(--txt2);font-weight:700;margin-bottom:3px">SQUAD BANK</div><div style="font-size:26px;font-weight:900;color:var(--green)">💎 '+gd+' GD</div><div style="font-size:11px;color:var(--txt2);">'+(clan.name||'Clan')+' ka shared pool</div></div>';
  h+='<button onclick="window.contributeToBank(\''+clanId+'\')" style="padding:10px 14px;border-radius:11px;border:1px solid rgba(0,255,156,.3);background:rgba(0,255,156,.15);color:var(--green);font-size:12px;font-weight:800;cursor:pointer">➕ Contribute</button>';
  h+='</div><div style="margin-top:10px;font-size:11px;color:var(--txt2)">Mera balance: 💎 '+myGd+' GD'+(topContrib?' · Top: '+topContrib[1].ign:'')+'</div></div>';
  h+='<div style="font-size:13px;font-weight:800;color:var(--txt);margin-bottom:10px">🎨 Clan Cosmetics</div>';
  h+='<div style="display:flex;flex-direction:column;gap:8px">';
  COSMETICS.forEach(function(item){
    var isUnlocked=!!(unlocked[item.id]);
    var canAfford=gd>=item.cost;
    h+='<div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:13px;background:'+(isUnlocked?'rgba(0,255,156,.06)':'var(--card)')+';border:1.5px solid '+(isUnlocked?'rgba(0,255,156,.25)':'var(--border)')+'">';
    h+='<div style="font-size:28px;width:36px;text-align:center">'+item.icon+'</div>';
    h+='<div style="flex:1"><div style="font-size:13px;font-weight:800">'+item.name+'</div><div style="font-size:11px;color:var(--txt2)">'+item.desc+'</div><div style="font-size:11px;color:#00d4ff;margin-top:3px">'+item.type+'</div></div>';
    h+=isUnlocked?'<div style="text-align:center"><div style="font-size:18px">✅</div><div style="font-size:10px;color:var(--green);font-weight:700">Unlocked</div></div>':'<div style="text-align:center"><div style="font-size:13px;font-weight:900;color:#00d4ff;margin-bottom:5px">💎 '+item.cost+'</div><button onclick="window.unlockClanCosmetic(\''+clanId+'\',\''+item.id+'\','+item.cost+')" style="padding:7px 12px;border-radius:9px;border:1px solid '+(canAfford?'rgba(0,212,255,.4)':'rgba(255,255,255,.1)')+';background:'+(canAfford?'rgba(0,212,255,.1)':'transparent')+';color:'+(canAfford?'#00d4ff':'var(--txt2)')+';font-size:11px;font-weight:800;cursor:'+(canAfford?'pointer':'not-allowed')+'">Unlock</button></div>';
    h+='</div>';
  });
  h+='</div>';
  // Contributors
  var contribs=Object.entries(contributors).sort(function(a,b){return(b[1].gd||0)-(a[1].gd||0)}).slice(0,5);
  if(contribs.length){
    h+='<div style="margin-top:14px"><div style="font-size:13px;font-weight:800;margin-bottom:8px">👑 Top Contributors</div><div style="display:flex;flex-direction:column;gap:6px">';
    contribs.forEach(function(e,i){
      h+='<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;background:var(--card);border:1px solid var(--border)"><span>'+(i===0?'👑':i===1?'🥈':i===2?'🥉':'#'+(i+1))+'</span><div style="flex:1;font-size:13px;font-weight:700">'+(e[1].ign||'Player')+'</div><span style="font-size:12px;font-weight:800;color:#00d4ff">💎 '+(e[1].gd||0)+'</span></div>';
    });
    h+='</div></div>';
  }
  c.innerHTML=h;
}

window.contributeToBank=function(clanId){
  var myGd=Number(_ud().green_diamonds||0);
  if(myGd<1){if(window.toast)toast('Tumhare paas Green Diamonds nahi hain','err');return;}
  var mb=document.getElementById('modalB');if(!mb)return;
  var h='<div style="text-align:center;margin-bottom:16px"><div style="font-size:40px;margin-bottom:8px">💎</div><div style="font-size:16px;font-weight:800">Contribute karo Squad Bank mein</div><div style="font-size:12px;color:var(--txt2);margin-top:4px">Mera balance: '+myGd+' Green Diamonds</div></div>';
  h+='<div style="margin-bottom:14px"><input id="sbContribIn" type="number" min="1" max="'+myGd+'" value="10" style="width:100%;padding:12px 14px;border-radius:12px;background:var(--card2);border:1px solid var(--border);color:var(--txt);font-size:18px;font-weight:800;text-align:center;box-sizing:border-box"></div>';
  h+='<div style="display:flex;gap:8px;margin-bottom:14px">';
  [5,10,20,50].filter(function(v){return v<=myGd;}).forEach(function(v){h+='<button onclick="document.getElementById(\'sbContribIn\').value='+v+'" style="flex:1;padding:8px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--txt);font-size:13px;font-weight:700;cursor:pointer">'+v+'</button>';});
  h+='</div><button onclick="window._doContribute(\''+clanId+'\')" style="width:100%;padding:13px;border-radius:13px;border:none;background:linear-gradient(135deg,var(--green),#00d4ff);color:#000;font-size:14px;font-weight:900;cursor:pointer">💎 Contribute Karo</button>';
  mb.innerHTML=h;
  setTimeout(function(){var el=document.getElementById('sbContribIn');if(el){el.focus();el.select();}},100);
};

window._doContribute=function(clanId){
  var el=document.getElementById('sbContribIn');if(!el)return;
  var amt=parseInt(el.value)||0;
  var myGd=Number(_ud().green_diamonds||0);
  if(amt<1||amt>myGd){if(window.toast)toast('Invalid amount','err');return;}
  if(!_s()||!_uid()||!_ud()){if(window.toast)toast('Login karo','err');return;}
  var myIgn=_ud().ign||_ud().displayName||'Player';
  // Deduct from user
  _s().from('users').update({green_diamonds:myGd-amt}).eq('id',_uid())
  .then(function(){
    if(window.UD)window.UD.green_diamonds=myGd-amt;
    if(window.updateHdr)updateHdr();
    // Fetch clan current bank
    _s().from('clans').select('squad_bank_gd,squad_bank_contributors').eq('id',clanId).single()
    .then(function(r){
      var cur=r.data||{};
      var newGd=Number(cur.squad_bank_gd||0)+amt;
      var contribs=cur.squad_bank_contributors||{};
      var uid=_uid();
      /* Issue #25 Fix: Write consistent {ign, gd, last_contributed} structure.
         Display code reads contribs[uid].ign — was missing, showed 'Player' always. */
      contribs[uid]={
        ign: myIgn,
        gd: (contribs[uid]&&contribs[uid].gd||0)+amt,
        last_contributed: new Date().toISOString()
      };
      _s().from('clans').update({squad_bank_gd:newGd,squad_bank_contributors:contribs}).eq('id',clanId)
      .then(function(){
        if(window.logActivity)logActivity('join','💎 '+amt+' GD Squad Bank mein contribute kiya');
        if(window.toast)toast('✅ '+amt+' GD contribute kar diye!','ok');
        if(window.closeModal)closeModal();
      }).catch(function(){if(window.toast)toast('Error saving','err');});
    }).catch(function(){if(window.toast)toast('Error','err');});
  }).catch(function(){if(window.toast)toast('Error deducting GD','err');});
};

window.unlockClanCosmetic=function(clanId,itemId,cost){
  if(!_s()||!_uid()){if(window.toast)toast('Login karo','err');return;}
  _s().from('clans').select('squad_bank_gd,squad_bank_unlocked,member_ids').eq('id',clanId).single()
  .then(function(r){
    var clan=r.data||{};
    var gd=Number(clan.squad_bank_gd||0);
    var unlocked=clan.squad_bank_unlocked||{};
    if(gd<cost){if(window.toast)toast('Bank mein itne GD nahi hain!','err');return;}
    if(unlocked[itemId]){if(window.toast)toast('Ye item pehle se unlock hai','err');return;}
    unlocked[itemId]={unlockedAt:new Date().toISOString(),unlockedBy:_uid()};
    _s().from('clans').update({squad_bank_gd:gd-cost,squad_bank_unlocked:unlocked}).eq('id',clanId)
    .then(function(){
      var item=COSMETICS.find(function(c){return c.id===itemId;})||{name:itemId,icon:'🎨'};
      // Notify clan members
      _s().from('clan_members').select('user_id').eq('clan_id',clanId)
      .then(function(m){
        (m.data||[]).forEach(function(mem){
          _s().from('notifications').insert({user_id:mem.user_id,type:'clan_cosmetic',title:item.icon+' Clan Cosmetic Unlock!',body:'"'+item.name+'" squad bank se unlock ho gayi!',ref_id:null,is_read:false}).catch(function(){});
        });
      }).catch(function(){});
      if(window.logActivity)logActivity('win',item.icon+' '+item.name+' clan ke liye unlock hua!');
      if(window.toast)toast('🎉 '+item.icon+' '+item.name+' unlock!','ok');
      if(window.closeModal)closeModal();
    }).catch(function(){if(window.toast)toast('Error','err');});
  }).catch(function(){if(window.toast)toast('Error','err');});
};

// Pill injection
var _i=0,_t=setInterval(function(){
  _i++;if(_i>60){clearInterval(_t);return;}
  var row=document.querySelector('.special-pills');
  if(!row||row.querySelector('#_sbPill')){if(row)clearInterval(_t);return;}
  clearInterval(_t);
  var p=document.createElement('div');p.id='_sbPill';p.className='special-pill';
  p.style.cssText='background:rgba(0,255,156,.08);border:1px solid rgba(0,255,156,.2);color:var(--green)';
  p.innerHTML='<i class="fas fa-coins" style="font-size:11px"></i> Squad Bank';
  p.onclick=function(){if(window.showSquadBank)showSquadBank();};
  row.appendChild(p);
},400);
})();
